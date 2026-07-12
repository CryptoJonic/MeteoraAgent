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
        complete = group[
            (group["returned"] == True) | (group["outcome_censored"] == False)  # noqa: E712
        ]
        source = complete["mae_pct"].dropna().to_numpy(float)
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
            density_histogram, _ = np.histogram(
                source, bins=np.r_[levels - 0.075, levels[-1] + 0.075]
            )
            density_weights = _normalized(density_histogram)
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
                "density_weights": [float(value) for value in density_weights],
                "maximum_depth_pct": maximum,
                "effective_leverage": effective_leverage,
                "paper_only": True,
                "stress_test_only": name == "Aggressive",
                "fit_sample": int(len(source)),
                "fit_scope": "all complete activated events, including non-returns",
                "probability_full_grid_reached": float((source >= maximum).mean()),
                "expected_mae_pct": float(source.mean()),
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
    fit_complete = fit[
        (fit["activated"] == True)  # noqa: E712
        & ((fit["returned"] == True) | (fit["outcome_censored"] == False))  # noqa: E712
    ]
    percentile_stops = {
        str(key): float(group["mae_pct"].dropna().quantile(0.95))
        for key, group in fit_complete.groupby("galka_type", sort=True)
    }
    probability_stops = _probability_stops(fit[fit["activated"] == True])  # noqa: E712
    maintenance_margin_pct = 0.50
    for galka_type, type_profiles in profiles.items():
        percentile_stop = percentile_stops.get(galka_type, 3.50)
        for profile in type_profiles.values():
            leverage = float(profile["effective_leverage"])
            liquidation_distance = max(0.0, (1 / leverage - maintenance_margin_pct / 100) * 100)
            notional_per_1000 = 1_000 * leverage
            profile.update(
                {
                    "paper_only": True,
                    "percentile_stop_pct": percentile_stop,
                    "assumed_maintenance_margin_pct": maintenance_margin_pct,
                    "approx_liquidation_distance_pct": liquidation_distance,
                    "grid_to_liquidation_buffer_pct": max(
                        0.0, liquidation_distance - float(profile["maximum_depth_pct"])
                    ),
                    "max_risk_per_1000_usd_at_percentile_stop": notional_per_1000
                    * (percentile_stop / 100 + MAKER_FEE + TAKER_FEE + SLIPPAGE),
                }
            )
    for profile_name in ("Conservative", "Balanced", "Aggressive"):
        prefix = profile_name.lower()
        returns_on_filled = []
        fixed_notional_returns = []
        fixed_risk_r = []
        fill_fractions = []
        fill_counts = []
        averages = []
        for event in output.itertuples(index=False):
            profile = profiles.get(str(event.galka_type), {}).get(profile_name)
            if not profile or not _is_true(event.activated) or not np.isfinite(event.mae_pct):
                averages.append(math.nan);fill_fractions.append(0.0);fill_counts.append(0)
                returns_on_filled.append(math.nan);fixed_notional_returns.append(math.nan);fixed_risk_r.append(math.nan)
                continue
            entry, fraction, count = _entry_from_profile(float(event.mae_pct), profile)
            exit_pct = getattr(event, "trail_075_exit_pct", math.nan)
            return_on_filled = _net_return(entry, fraction, exit_pct)
            averages.append(entry);fill_fractions.append(fraction);fill_counts.append(count)
            returns_on_filled.append(return_on_filled)
            fixed_notional_returns.append(return_on_filled * fraction if np.isfinite(return_on_filled) else math.nan)

            risk_stop = percentile_stops.get(str(event.galka_type), 3.50)
            risk_entry, risk_fraction, _ = _entry_from_profile(
                min(float(event.mae_pct), max(0.0, risk_stop - 1e-9)), profile
            )
            risk_exit = -risk_stop if event.mae_pct >= risk_stop else exit_pct
            risk_return = _net_return(risk_entry, risk_fraction, risk_exit)
            stop_ratio = 1 - risk_stop / 100
            risk_distance = (
                (risk_entry - stop_ratio) / risk_entry * 100
                if np.isfinite(risk_entry) and risk_entry > stop_ratio
                else math.nan
            )
            fixed_risk_r.append(
                risk_return / risk_distance
                if np.isfinite(risk_return) and np.isfinite(risk_distance) and risk_distance > 0
                else math.nan
            )
        output[f"{prefix}_average_entry_ratio"] = averages
        output[f"{prefix}_fill_fraction"] = fill_fractions
        output[f"{prefix}_levels_filled"] = fill_counts
        output[f"{prefix}_return_on_filled_pct"] = returns_on_filled
        output[f"{prefix}_net_return_pct"] = fixed_notional_returns
        output[f"{prefix}_fixed_risk_r"] = fixed_risk_r

    stop_columns = {name: [] for name in ("fixed", "percentile", "atr", "time", "probability", "hybrid", "no_stop")}
    stop_return_on_filled = {name: [] for name in stop_columns}
    for event in output.itertuples(index=False):
        profile = profiles.get(str(event.galka_type), {}).get("Balanced")
        if not profile or not _is_true(event.activated) or not np.isfinite(event.mae_pct):
            for name in stop_columns:
                stop_columns[name].append(math.nan);stop_return_on_filled[name].append(math.nan)
            continue
        percentile = percentile_stops.get(str(event.galka_type), 3.50)
        probability = probability_stops.get(str(event.galka_type), 3.50)
        atr_stop = float(np.clip(2 * event.atr_pct, 0.75, 5.0))
        depth_stops = {"fixed": 2.0, "percentile": percentile, "atr": atr_stop, "probability": probability}
        for name, threshold in depth_stops.items():
            entry, fraction, _ = _entry_from_profile(
                min(float(event.mae_pct), max(0.0, threshold - 1e-9)), profile
            )
            exit_pct = -threshold if event.mae_pct >= threshold else getattr(event, "trail_075_exit_pct", math.nan)
            raw_return = _net_return(entry, fraction, exit_pct)
            stop_return_on_filled[name].append(raw_return)
            stop_columns[name].append(raw_return * fraction if np.isfinite(raw_return) else math.nan)
        entry, fraction, _ = _entry_from_profile(float(event.mae_pct), profile)
        time_exit = 0.0 if _is_true(getattr(event, "return_24h", False)) else event.close_24h_pct
        raw_return = _net_return(entry, fraction, time_exit)
        stop_return_on_filled["time"].append(raw_return)
        stop_columns["time"].append(raw_return * fraction if np.isfinite(raw_return) else math.nan)
        hybrid_depth = min(percentile, probability, max(0.75, atr_stop))
        hybrid_entry, hybrid_fraction, _ = _entry_from_profile(
            min(float(event.mae_pct), max(0.0, hybrid_depth - 1e-9)), profile
        )
        if event.mae_pct >= hybrid_depth:
            hybrid_exit = -hybrid_depth
        elif _is_true(getattr(event, "return_48h", False)):
            hybrid_exit = getattr(event, "trail_075_exit_pct", 0.0)
        else:
            hybrid_exit = event.close_48h_pct
        raw_return = _net_return(hybrid_entry, hybrid_fraction, hybrid_exit)
        stop_return_on_filled["hybrid"].append(raw_return)
        stop_columns["hybrid"].append(raw_return * hybrid_fraction if np.isfinite(raw_return) else math.nan)
        no_stop_exit = getattr(event, "trail_075_exit_pct", math.nan)
        if not np.isfinite(no_stop_exit):
            no_stop_exit = event.close_48h_pct
        raw_return = _net_return(entry, fraction, no_stop_exit)
        stop_return_on_filled["no_stop"].append(raw_return)
        stop_columns["no_stop"].append(raw_return * fraction if np.isfinite(raw_return) else math.nan)
    for name, values in stop_columns.items():
        output[f"stop_{name}_net_return_pct"] = values
        output[f"stop_{name}_return_on_filled_pct"] = stop_return_on_filled[name]

    trailing_strategies = {
        "galka_tp_48h": None,
        **{
            f"reclaim_{int(round(buffer * 100)):03d}_trail_{int(round(distance * 100)):03d}":
            f"reclaim_{int(round(buffer * 100)):03d}_trail_{int(round(distance * 100)):03d}"
            for buffer in (0.00, 0.10, 0.20)
            for distance in (0.15, 0.30, 0.50, 0.75, 1.00)
        },
        "reclaim_010_trail_atr": "reclaim_010_trail_atr",
        "reclaim_010_trail_swing": "reclaim_010_trail_swing",
        "partial_galka_runner": None,
        "max_hold_12h": None,
        "max_hold_24h": None,
        "max_hold_48h": None,
    }
    trailing_values = {name: [] for name in trailing_strategies}
    for event in output.itertuples(index=False):
        profile = profiles.get(str(event.galka_type), {}).get("Balanced")
        if not profile or not _is_true(event.activated) or not np.isfinite(event.mae_pct):
            for values in trailing_values.values(): values.append(math.nan)
            continue
        entry, fraction, _ = _entry_from_profile(float(event.mae_pct), profile)
        if fraction <= 0:
            for values in trailing_values.values(): values.append(math.nan)
            continue
        fixed_target_exit = (
            0.0
            if _is_true(event.returned) and float(event.return_minutes) <= 48 * 60
            else event.close_48h_pct
        )
        fixed_target_return = _net_return(entry, fraction, fixed_target_exit)
        default_exit = getattr(event, "reclaim_010_trail_075_exit_pct", getattr(event, "trail_075_exit_pct", math.nan))
        default_minutes = getattr(event, "reclaim_010_trail_075_minutes", getattr(event, "trail_075_minutes", math.nan))
        default_return = _net_return(entry, fraction, default_exit)
        for name, source in trailing_strategies.items():
            if source:
                exit_pct = getattr(event, f"{source}_exit_pct", math.nan)
                raw_return = _net_return(entry, fraction, exit_pct)
            elif name == "galka_tp_48h":
                raw_return = fixed_target_return
            elif name == "partial_galka_runner":
                raw_return = (
                    0.5 * fixed_target_return + 0.5 * default_return
                    if np.isfinite(fixed_target_return) and np.isfinite(default_return)
                    else math.nan
                )
            else:
                hours = int(name.removeprefix("max_hold_").removesuffix("h"))
                exit_pct = (
                    default_exit
                    if np.isfinite(default_minutes) and default_minutes <= hours * 60
                    else getattr(event, f"close_{hours}h_pct", math.nan)
                )
                raw_return = _net_return(entry, fraction, exit_pct)
            trailing_values[name].append(
                raw_return * fraction if np.isfinite(raw_return) else math.nan
            )
    for name, values in trailing_values.items():
        output[f"exit_{name}_net_return_pct"] = values

    grid_rows = []
    grid_groups = list(output.groupby(["galka_type", "split"], sort=True)) + [
        ((galka_type, "all"), group) for galka_type, group in output.groupby("galka_type", sort=True)
    ]
    for keys, group in grid_groups:
        for profile_name in ("Conservative", "Balanced", "Aggressive"):
            profile = profiles.get(str(keys[0]), {}).get(profile_name, {})
            column = f"{profile_name.lower()}_net_return_pct"
            values = group[column].dropna().to_numpy(float)
            filled_values = group[f"{profile_name.lower()}_return_on_filled_pct"].dropna().to_numpy(float)
            risk_values = group[f"{profile_name.lower()}_fixed_risk_r"].dropna().to_numpy(float)
            if not len(values):
                continue
            tail_count = max(1, int(np.ceil(len(values) * 0.05)))
            eligible = group[
                (group["activated"] == True)  # noqa: E712
                & ((group["returned"] == True) | (group["outcome_censored"] == False))  # noqa: E712
            ]
            fill_fraction = eligible[f"{profile_name.lower()}_fill_fraction"]
            levels_filled = eligible[f"{profile_name.lower()}_levels_filled"]
            profile_level_count = len(profile.get("depths_pct", []))
            grid_rows.append(
                {
                    "galka_type": keys[0],
                    "split": keys[1],
                    "profile": profile_name,
                    "count": int(len(values)),
                    "mean_net_return_pct": float(values.mean()),
                    "median_net_return_pct": float(np.median(values)),
                    "win_rate": float((values > 0).mean()),
                    "eligible_count": int(len(eligible)),
                    "fill_probability": float((fill_fraction > 0).mean()) if len(eligible) else math.nan,
                    "full_fill_probability": (
                        float((levels_filled >= profile_level_count).mean())
                        if len(eligible) and profile_level_count
                        else math.nan
                    ),
                    "expected_fill_fraction": float(fill_fraction.mean()) if len(eligible) else math.nan,
                    "expected_mae_pct": float(eligible["mae_pct"].mean()) if len(eligible) else math.nan,
                    "cvar_95_pct": float(np.sort(values)[:tail_count].mean()),
                    "mean_return_on_filled_pct": float(filled_values.mean()) if len(filled_values) else math.nan,
                    "mean_fixed_risk_r": float(risk_values.mean()) if len(risk_values) else math.nan,
                    "cvar_95_fixed_risk_r": (
                        float(np.sort(risk_values)[: max(1, int(np.ceil(len(risk_values) * 0.05)))].mean())
                        if len(risk_values)
                        else math.nan
                    ),
                    "paper_only": True,
                    "stress_test_only": profile_name == "Aggressive",
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
    trailing_rows = []
    trailing_groups = list(output.groupby(["galka_type", "split"], sort=True)) + [
        ((galka_type, "all"), group) for galka_type, group in output.groupby("galka_type", sort=True)
    ]
    for keys, group in trailing_groups:
        for name in trailing_strategies:
            values = group[f"exit_{name}_net_return_pct"].dropna().to_numpy(float)
            if not len(values):
                continue
            tail_count = max(1, int(np.ceil(len(values) * 0.05)))
            trailing_rows.append(
                {
                    "galka_type": keys[0],
                    "split": keys[1],
                    "exit": name,
                    "count": int(len(values)),
                    "mean_net_return_pct": float(values.mean()),
                    "median_net_return_pct": float(np.median(values)),
                    "win_rate": float((values > 0).mean()),
                    "cvar_95_pct": float(np.sort(values)[:tail_count].mean()),
                    "paper_only": True,
                }
            )
    metadata = {
        "profiles": profiles,
        "percentile_stops": percentile_stops,
        "probability_stops": probability_stops,
        "grid_summary": grid_rows,
        "stop_summary": stop_rows,
        "trailing_summary": trailing_rows,
        "fees": {"maker": MAKER_FEE, "taker": TAKER_FEE, "slippage": SLIPPAGE},
        "sizing": {
            "fixed_notional": "returns include unfilled reserve as zero-return cash",
            "fixed_risk": "R multiple uses train-fitted percentile stop; 1R is a fixed risk budget",
            "liquidation": "approximation assumes 0.50% maintenance margin and excludes exchange tier details",
        },
    }
    return output, metadata
