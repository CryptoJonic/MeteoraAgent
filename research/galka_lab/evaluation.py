from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .config import (
    DEPTH_THRESHOLDS_PCT,
    MAKER_FEE,
    MIN_SAMPLE,
    SLIPPAGE,
    TAKER_FEE,
)


def _normalized(values: np.ndarray) -> np.ndarray:
    values = np.maximum(values.astype(float), 1e-12)
    return values / values.sum()


def _is_true(value) -> bool:
    return bool(value) if pd.notna(value) else False


def derive_grid_profiles(events: pd.DataFrame) -> dict[str, dict[str, dict]]:
    fit = events[(events["split"].isin(("train", "validation"))) & (events["activated"] == True)]  # noqa: E712
    profiles: dict[str, dict[str, dict]] = {}
    for galka_type, group in fit.groupby("galka_type", sort=True):
        successful = group[group["returned"] == True]["mae_pct"].dropna().to_numpy(float)  # noqa: E712
        complete = group[(group["returned"] == True) | (group["outcome_censored"] == False)]  # noqa: E712
        source = successful if len(successful) >= MIN_SAMPLE else complete["mae_pct"].dropna().to_numpy(float)
        if not len(source):
            source = np.array([0.60, 1.50, 3.50])
        p75, p90, p95 = np.quantile(source, (0.75, 0.90, 0.95))
        maximums = {
            "Conservative": float(np.clip(p75, 0.60, 1.50)),
            "Balanced": float(np.clip(p90, 0.90, 3.50)),
            "Aggressive": float(np.clip(p95, 1.50, 5.00)),
        }
        type_profiles = {}
        for name, maximum in maximums.items():
            levels = np.arange(0.15, maximum + 1e-9, 0.15)
            if name == "Conservative":
                weights = _normalized(np.exp(-levels / max(maximum, 0.15)))
                effective_leverage = 2.0
            elif name == "Balanced":
                histogram, edges = np.histogram(source, bins=np.r_[levels - 0.075, levels[-1] + 0.075])
                weights = _normalized(histogram + max(1, len(source) * 0.0025))
                effective_leverage = 3.0
            else:
                weights = _normalized(np.linspace(0.7, 1.4, len(levels)))
                effective_leverage = 4.0
            type_profiles[name] = {
                "depths_pct": [round(float(value), 4) for value in levels],
                "weights": [float(value) for value in weights],
                "maximum_depth_pct": maximum,
                "effective_leverage": effective_leverage,
                "paper_only": name == "Aggressive",
                "fit_sample": int(len(source)),
            }
        profiles[str(galka_type)] = type_profiles
    return profiles


def _entry_from_profile(mae_pct: float, profile: dict) -> tuple[float, float, int]:
    depths = np.asarray(profile["depths_pct"], dtype=float)
    weights = np.asarray(profile["weights"], dtype=float)
    filled = depths <= mae_pct + 1e-12
    if not filled.any():
        return (math.nan, 0.0, 0)
    prices = 1 - depths[filled] / 100
    notionals = weights[filled]
    quantities = notionals / prices
    return float(notionals.sum() / quantities.sum()), float(notionals.sum()), int(filled.sum())


def _net_return(entry: float, fill_fraction: float, exit_pct: float, maker_exit: bool = False) -> float:
    if not np.isfinite(entry) or fill_fraction <= 0 or not np.isfinite(exit_pct):
        return math.nan
    exit_price = (1 + exit_pct / 100) * (1 if maker_exit else 1 - SLIPPAGE)
    gross = exit_price / entry - 1
    fee = MAKER_FEE + (MAKER_FEE if maker_exit else TAKER_FEE)
    return (gross - fee) * 100


def _probability_stops(fit: pd.DataFrame) -> dict[str, float]:
    stops = {}
    for galka_type, group in fit.groupby("galka_type", sort=True):
        selected = 3.50
        for depth in DEPTH_THRESHOLDS_PCT:
            suffix = str(depth).replace(".", "_")
            reached = group[group[f"depth_{suffix}_reached"] == True]  # noqa: E712
            observed = reached[
                reached["returned"]
                | ((reached["available_minutes"] - reached[f"depth_{suffix}_minutes"]) >= 24 * 60)
            ]
            if len(observed) < MIN_SAMPLE:
                continue
            recovered = (
                observed["returned"]
                & ((observed["return_minutes"] - observed[f"depth_{suffix}_minutes"]) <= 24 * 60)
            )
            if recovered.mean() < 0.55:
                selected = float(depth)
                break
        stops[str(galka_type)] = selected
    return stops


def evaluate_profiles(events: pd.DataFrame, profiles: dict[str, dict[str, dict]]) -> tuple[pd.DataFrame, dict]:
    output = events.copy()
    fit = output[output["split"].isin(("train", "validation"))]
    percentile_stops = {
        str(key): float(group["mae_pct"].dropna().quantile(0.95))
        for key, group in fit.groupby("galka_type", sort=True)
    }
    probability_stops = _probability_stops(fit[fit["activated"] == True])  # noqa: E712
    for profile_name in ("Conservative", "Balanced", "Aggressive"):
        prefix = profile_name.lower()
        returns = []
        fill_fractions = []
        fill_counts = []
        averages = []
        for event in output.itertuples(index=False):
            profile = profiles.get(str(event.galka_type), {}).get(profile_name)
            if not profile or not _is_true(event.activated) or not np.isfinite(event.mae_pct):
                averages.append(math.nan);fill_fractions.append(0.0);fill_counts.append(0);returns.append(math.nan)
                continue
            entry, fraction, count = _entry_from_profile(float(event.mae_pct), profile)
            exit_pct = getattr(event, "trail_075_exit_pct", math.nan)
            averages.append(entry);fill_fractions.append(fraction);fill_counts.append(count)
            returns.append(_net_return(entry, fraction, exit_pct))
        output[f"{prefix}_average_entry_ratio"] = averages
        output[f"{prefix}_fill_fraction"] = fill_fractions
        output[f"{prefix}_levels_filled"] = fill_counts
        output[f"{prefix}_net_return_pct"] = returns

    stop_columns = {name: [] for name in ("fixed", "percentile", "atr", "time", "probability", "hybrid", "no_stop")}
    for event in output.itertuples(index=False):
        profile = profiles.get(str(event.galka_type), {}).get("Balanced")
        if not profile or not _is_true(event.activated) or not np.isfinite(event.mae_pct):
            for values in stop_columns.values(): values.append(math.nan)
            continue
        entry, fraction, _ = _entry_from_profile(float(event.mae_pct), profile)
        if fraction <= 0:
            for values in stop_columns.values(): values.append(math.nan)
            continue
        percentile = percentile_stops.get(str(event.galka_type), 3.50)
        probability = probability_stops.get(str(event.galka_type), 3.50)
        atr_stop = float(np.clip(2 * event.atr_pct, 0.75, 5.0))
        depth_stops = {"fixed": 2.0, "percentile": percentile, "atr": atr_stop, "probability": probability}
        for name, threshold in depth_stops.items():
            exit_pct = -threshold if event.mae_pct >= threshold else getattr(event, "trail_075_exit_pct", math.nan)
            stop_columns[name].append(_net_return(entry, fraction, exit_pct))
        time_exit = 0.0 if _is_true(getattr(event, "return_24h", False)) else event.close_24h_pct
        stop_columns["time"].append(_net_return(entry, fraction, time_exit))
        hybrid_depth = min(percentile, probability, max(0.75, atr_stop))
        if event.mae_pct >= hybrid_depth:
            hybrid_exit = -hybrid_depth
        elif _is_true(getattr(event, "return_48h", False)):
            hybrid_exit = getattr(event, "trail_075_exit_pct", 0.0)
        else:
            hybrid_exit = event.close_48h_pct
        stop_columns["hybrid"].append(_net_return(entry, fraction, hybrid_exit))
        no_stop_exit = getattr(event, "trail_075_exit_pct", math.nan)
        if not np.isfinite(no_stop_exit):
            no_stop_exit = event.close_48h_pct
        stop_columns["no_stop"].append(_net_return(entry, fraction, no_stop_exit))
    for name, values in stop_columns.items():
        output[f"stop_{name}_net_return_pct"] = values

    grid_rows = []
    grid_groups = list(output.groupby(["galka_type", "split"], sort=True)) + [
        ((galka_type, "all"), group) for galka_type, group in output.groupby("galka_type", sort=True)
    ]
    for keys, group in grid_groups:
        for profile_name in ("Conservative", "Balanced", "Aggressive"):
            column = f"{profile_name.lower()}_net_return_pct"
            values = group[column].dropna().to_numpy(float)
            if not len(values):
                continue
            tail_count = max(1, int(np.ceil(len(values) * 0.05)))
            grid_rows.append(
                {
                    "galka_type": keys[0],
                    "split": keys[1],
                    "profile": profile_name,
                    "count": int(len(values)),
                    "mean_net_return_pct": float(values.mean()),
                    "median_net_return_pct": float(np.median(values)),
                    "win_rate": float((values > 0).mean()),
                    "cvar_95_pct": float(np.sort(values)[:tail_count].mean()),
                    "paper_only": profile_name == "Aggressive",
                }
            )
    stop_rows = []
    stop_groups = list(output.groupby(["galka_type", "split"], sort=True)) + [
        ((galka_type, "all"), group) for galka_type, group in output.groupby("galka_type", sort=True)
    ]
    for keys, group in stop_groups:
        for name in stop_columns:
            values = group[f"stop_{name}_net_return_pct"].dropna().to_numpy(float)
            if not len(values):
                continue
            tail_count = max(1, int(np.ceil(len(values) * 0.05)))
            stop_rows.append(
                {
                    "galka_type": keys[0],
                    "split": keys[1],
                    "stop": name,
                    "count": int(len(values)),
                    "mean_net_return_pct": float(values.mean()),
                    "win_rate": float((values > 0).mean()),
                    "cvar_95_pct": float(np.sort(values)[:tail_count].mean()),
                }
            )
    metadata = {
        "profiles": profiles,
        "percentile_stops": percentile_stops,
        "probability_stops": probability_stops,
        "grid_summary": grid_rows,
        "stop_summary": stop_rows,
        "fees": {"maker": MAKER_FEE, "taker": TAKER_FEE, "slippage": SLIPPAGE},
    }
    return output, metadata
