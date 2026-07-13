from __future__ import annotations

import numpy as np
import pandas as pd


def assign_chronological_splits(
    frame: pd.DataFrame,
    *,
    time_column: str = "confirmation_time",
    train_fraction: float = 0.60,
    validation_fraction: float = 0.20,
) -> pd.DataFrame:
    if train_fraction <= 0 or validation_fraction <= 0 or train_fraction + validation_fraction >= 1:
        raise ValueError("split fractions must leave a final OOS segment")
    output = frame.copy()
    output["split"] = ""
    timestamps = pd.to_datetime(output[time_column], utc=True)
    unique_times = pd.Index(timestamps.unique()).sort_values()
    if len(unique_times) < 3:
        raise ValueError("at least three distinct timestamps are required for chronological splits")
    train_end = max(1, int(np.floor(len(unique_times) * train_fraction)))
    validation_end = max(
        train_end + 1,
        int(np.floor(len(unique_times) * (train_fraction + validation_fraction))),
    )
    validation_end = min(validation_end, len(unique_times) - 1)
    validation_start_time = unique_times[train_end]
    oos_start_time = unique_times[validation_end]
    output.loc[timestamps < validation_start_time, "split"] = "train"
    output.loc[
        (timestamps >= validation_start_time) & (timestamps < oos_start_time), "split"
    ] = "validation"
    output.loc[timestamps >= oos_start_time, "split"] = "final_oos"
    return output


def walk_forward_splits(
    frame: pd.DataFrame,
    *,
    time_column: str = "confirmation_time",
    folds: int = 4,
    final_oos_fraction: float = 0.20,
) -> list[dict]:
    ordered = frame.sort_values([time_column, "candidate_id"]).reset_index()
    timestamps = pd.to_datetime(ordered[time_column], utc=True)
    unique_times = pd.Index(timestamps.unique()).sort_values()
    pre_oos_time_count = int(np.floor(len(unique_times) * (1 - final_oos_fraction)))
    pre_oos_times = unique_times[:pre_oos_time_count]
    pre_oos = ordered[timestamps.isin(pre_oos_times)]
    if len(pre_oos_times) < folds + 2:
        return []
    chunk = max(1, len(pre_oos_times) // (folds + 1))
    result = []
    for fold in range(folds):
        train_end = chunk * (fold + 1)
        validation_end = (
            len(pre_oos_times)
            if fold == folds - 1
            else min(len(pre_oos_times), train_end + chunk)
        )
        validation_start_time = pre_oos_times[train_end]
        validation_end_time = pre_oos_times[validation_end - 1]
        train = pre_oos[pd.to_datetime(pre_oos[time_column], utc=True) < validation_start_time]
        validation = pre_oos[
            (pd.to_datetime(pre_oos[time_column], utc=True) >= validation_start_time)
            & (pd.to_datetime(pre_oos[time_column], utc=True) <= validation_end_time)
        ]
        if train.empty or validation.empty:
            continue
        result.append(
            {
                "fold": fold + 1,
                "train_index": train["index"].tolist(),
                "validation_index": validation["index"].tolist(),
                "train_start": pd.Timestamp(train[time_column].iloc[0]),
                "train_end": pd.Timestamp(train[time_column].iloc[-1]),
                "validation_start": pd.Timestamp(validation[time_column].iloc[0]),
                "validation_end": pd.Timestamp(validation[time_column].iloc[-1]),
            }
        )
    return result


def assert_oos_isolation(frame: pd.DataFrame, time_column: str = "confirmation_time") -> None:
    train_validation = frame[frame["split"].isin(("train", "validation"))]
    oos = frame[frame["split"] == "final_oos"]
    if not train_validation.empty and not oos.empty:
        if pd.Timestamp(train_validation[time_column].max()) >= pd.Timestamp(
            oos[time_column].min()
        ):
            raise AssertionError("final OOS overlaps global train/validation chronology")
    for _, group in frame.groupby(["symbol", "interval"], sort=True):
        train_validation = group[group["split"].isin(("train", "validation"))]
        oos = group[group["split"] == "final_oos"]
        if train_validation.empty or oos.empty:
            continue
        if pd.Timestamp(train_validation[time_column].max()) >= pd.Timestamp(oos[time_column].min()):
            raise AssertionError("final OOS overlaps train/validation chronology")


def mark_split_embargo(
    frame: pd.DataFrame,
    *,
    time_column: str = "confirmation_time",
    observation_end_column: str = "observation_end_time",
) -> pd.DataFrame:
    """Purge rows whose labeled observation window crosses the next split boundary."""
    output = frame.copy()
    output["purged_for_split"] = False
    starts = {
        split: pd.to_datetime(output.loc[output["split"] == split, time_column], utc=True).min()
        for split in ("validation", "final_oos")
    }
    observation_end = pd.to_datetime(output[observation_end_column], utc=True)
    train_crosses = (output["split"] == "train") & (observation_end >= starts["validation"])
    validation_crosses = (output["split"] == "validation") & (
        observation_end >= starts["final_oos"]
    )
    output.loc[train_crosses | validation_crosses, "purged_for_split"] = True
    return output
