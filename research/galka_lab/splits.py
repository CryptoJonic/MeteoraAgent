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
    groups = ["symbol", "interval"] if {"symbol", "interval"}.issubset(output.columns) else []
    iterator = output.groupby(groups, sort=True) if groups else [("all", output)]
    for _, group in iterator:
        ordered = group.sort_values([time_column, "candidate_id"]).index.to_numpy()
        count = len(ordered)
        train_end = max(1, int(np.floor(count * train_fraction)))
        validation_end = max(train_end + 1, int(np.floor(count * (train_fraction + validation_fraction))))
        validation_end = min(validation_end, count)
        output.loc[ordered[:train_end], "split"] = "train"
        output.loc[ordered[train_end:validation_end], "split"] = "validation"
        output.loc[ordered[validation_end:], "split"] = "final_oos"
    return output


def walk_forward_splits(
    frame: pd.DataFrame,
    *,
    time_column: str = "confirmation_time",
    folds: int = 4,
    final_oos_fraction: float = 0.20,
) -> list[dict]:
    ordered = frame.sort_values([time_column, "candidate_id"]).reset_index()
    pre_oos_count = int(np.floor(len(ordered) * (1 - final_oos_fraction)))
    pre_oos = ordered.iloc[:pre_oos_count]
    if len(pre_oos) < folds + 2:
        return []
    chunk = max(1, len(pre_oos) // (folds + 1))
    result = []
    for fold in range(folds):
        train_end = chunk * (fold + 1)
        validation_end = len(pre_oos) if fold == folds - 1 else min(len(pre_oos), train_end + chunk)
        train = pre_oos.iloc[:train_end]
        validation = pre_oos.iloc[train_end:validation_end]
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
    for _, group in frame.groupby(["symbol", "interval"], sort=True):
        train_validation = group[group["split"].isin(("train", "validation"))]
        oos = group[group["split"] == "final_oos"]
        if train_validation.empty or oos.empty:
            continue
        if pd.Timestamp(train_validation[time_column].max()) > pd.Timestamp(oos[time_column].min()):
            raise AssertionError("final OOS overlaps train/validation chronology")
