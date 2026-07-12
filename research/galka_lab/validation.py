from __future__ import annotations

import numpy as np
import pandas as pd

from .clustering import apply_types, fit_types
from .statistics import summarize_group


def walk_forward_validate(frame: pd.DataFrame, selected_k: int, folds: int = 4) -> list[dict]:
    pre_oos = frame[frame["split"] != "final_oos"].sort_values(
        ["confirmation_time", "candidate_id"]
    )
    if len(pre_oos) < 300:
        return []
    unique_times = pd.Index(pd.to_datetime(pre_oos["confirmation_time"], utc=True).unique()).sort_values()
    if len(unique_times) < folds + 2:
        return []
    initial = max(1, int(len(unique_times) * 0.40))
    remaining = len(unique_times) - initial
    block = max(1, remaining // folds)
    rows = []
    for fold in range(folds):
        validation_start_index = initial + fold * block
        validation_end_index = (
            len(unique_times) if fold == folds - 1 else min(len(unique_times), validation_start_index + block)
        )
        validation_start_time = unique_times[validation_start_index]
        validation_end_time = unique_times[validation_end_index - 1]
        train = pre_oos[pre_oos["confirmation_time"] < validation_start_time].copy()
        validation = pre_oos[
            (pre_oos["confirmation_time"] >= validation_start_time)
            & (pre_oos["confirmation_time"] <= validation_end_time)
        ].copy()
        if "observation_end_time" in pre_oos:
            train = train[
                pd.to_datetime(train["observation_end_time"], utc=True)
                < validation_start_time
            ]
            validation = validation[
                pd.to_datetime(validation["observation_end_time"], utc=True)
                <= validation_end_time
            ]
        if len(train) < 100 or len(validation) < 20:
            continue
        if pd.Timestamp(train["confirmation_time"].max()) >= pd.Timestamp(
            validation["confirmation_time"].min()
        ):
            raise AssertionError("walk-forward chronology overlap")
        combined = pd.concat((train, validation), ignore_index=True)
        combined["split"] = ["train"] * len(train) + ["validation"] * len(validation)
        fitted = fit_types(
            combined,
            minimum_k=selected_k,
            maximum_k=selected_k,
            seed=20260712 + fold,
        )
        predicted = apply_types(validation, fitted.model)
        summary = summarize_group(predicted)
        type_probabilities = {}
        for galka_type, group in predicted.groupby("galka_type", sort=True):
            type_summary = summarize_group(group)
            type_probabilities[str(galka_type)] = {
                "n": type_summary["count_complete"],
                "return_24h": type_summary["return_24h_probability"],
            }
        rows.append(
            {
                "fold": fold + 1,
                "train_count": len(train),
                "validation_count": len(validation),
                "train_end": pd.Timestamp(train["confirmation_time"].max()).isoformat(),
                "validation_start": pd.Timestamp(validation["confirmation_time"].min()).isoformat(),
                "validation_end": pd.Timestamp(validation["confirmation_time"].max()).isoformat(),
                "return_24h_probability": summary["return_24h_probability"],
                "depth_success_p75": summary["depth_success_p75"],
                "types": type_probabilities,
                "model_hash": fitted.model["model_hash"],
            }
        )
    return rows
