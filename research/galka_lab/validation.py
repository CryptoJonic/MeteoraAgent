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
    initial = max(150, int(len(pre_oos) * 0.40))
    remaining = len(pre_oos) - initial
    block = max(1, remaining // folds)
    rows = []
    for fold in range(folds):
        train_end = initial + fold * block
        validation_end = len(pre_oos) if fold == folds - 1 else min(len(pre_oos), train_end + block)
        train = pre_oos.iloc[:train_end].copy()
        validation = pre_oos.iloc[train_end:validation_end].copy()
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
