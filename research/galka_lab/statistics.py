from __future__ import annotations

import math
from typing import Iterable

import numpy as np
import pandas as pd

from .config import (
    BOOTSTRAP_SAMPLES,
    DEPTH_QUANTILES,
    DEPTH_THRESHOLDS_PCT,
    HORIZON_HOURS,
    MIN_SAMPLE,
    RECENT_WINDOWS_DAYS,
    SEED,
)


def wilson_interval(successes: int, total: int, z: float = 1.959963984540054) -> tuple[float, float]:
    if total <= 0:
        return (math.nan, math.nan)
    probability = successes / total
    denominator = 1 + z * z / total
    center = (probability + z * z / (2 * total)) / denominator
    margin = z * math.sqrt(probability * (1 - probability) / total + z * z / (4 * total**2)) / denominator
    return (max(0.0, center - margin), min(1.0, center + margin))


def bootstrap_quantile_interval(
    values: Iterable[float], quantile: float, *, seed: int = SEED, samples: int = BOOTSTRAP_SAMPLES
) -> tuple[float, float]:
    array = np.asarray(list(values), dtype=float)
    array = array[np.isfinite(array)]
    if len(array) < 2:
        value = float(array[0]) if len(array) else math.nan
        return value, value
    rng = np.random.default_rng(seed + round(quantile * 1000) + len(array))
    estimates = np.empty(samples)
    for index in range(samples):
        estimates[index] = np.quantile(rng.choice(array, size=len(array), replace=True), quantile)
    return tuple(float(value) for value in np.quantile(estimates, (0.025, 0.975)))


def _complete_for_horizon(group: pd.DataFrame, hours: int) -> pd.DataFrame:
    column = f"return_{hours}h"
    return group[group[column].notna()]


def summarize_group(group: pd.DataFrame) -> dict:
    activated = group[group["activated"] == True]  # noqa: E712
    activation_observable = group[
        (group["activated"] == True) | (group["activation_censored"] == False)  # noqa: E712
    ]
    complete = activated[(activated["returned"] == True) | (activated["outcome_censored"] == False)]  # noqa: E712
    successful = activated[activated["returned"] == True]  # noqa: E712
    summary = {
        "count_candidates": int(len(group)),
        "count_activation_observable": int(len(activation_observable)),
        "count_activation_censored": int((group["activation_censored"] == True).sum()),  # noqa: E712
        "count_activated": int(len(activated)),
        "count_complete": int(len(complete)),
        "count_returned": int(len(successful)),
        "activation_rate": (
            float(len(activated) / len(activation_observable)) if len(activation_observable) else math.nan
        ),
        "return_rate_any": float(len(successful) / len(complete)) if len(complete) else math.nan,
        "insufficient_data": bool(len(complete) < MIN_SAMPLE),
    }
    depth_success = successful["mae_pct"].dropna().to_numpy(float)
    depth_all = complete["mae_pct"].dropna().to_numpy(float)
    for quantile in DEPTH_QUANTILES:
        suffix = f"p{round(quantile * 100)}"
        summary[f"depth_success_{suffix}"] = (
            float(np.quantile(depth_success, quantile)) if len(depth_success) else math.nan
        )
        summary[f"adverse_all_{suffix}"] = (
            float(np.quantile(depth_all, quantile)) if len(depth_all) else math.nan
        )
    if len(depth_success):
        low, high = bootstrap_quantile_interval(depth_success, 0.75)
        summary["depth_success_p75_ci_low"] = low
        summary["depth_success_p75_ci_high"] = high
    else:
        summary["depth_success_p75_ci_low"] = math.nan
        summary["depth_success_p75_ci_high"] = math.nan
    times = successful["return_minutes"].dropna().to_numpy(float)
    summary["return_minutes_p50"] = float(np.quantile(times, 0.50)) if len(times) else math.nan
    summary["return_minutes_p75"] = float(np.quantile(times, 0.75)) if len(times) else math.nan
    summary["return_minutes_p90"] = float(np.quantile(times, 0.90)) if len(times) else math.nan
    summary["mae_mean_pct"] = float(complete["mae_pct"].mean()) if len(complete) else math.nan
    summary["mfe_after_return_mean_pct"] = (
        float(successful["mfe_after_return_pct"].mean()) if len(successful) else math.nan
    )
    summary["mfe_after_reclaim_mean_pct"] = (
        float(successful["mfe_after_reclaim_pct"].mean()) if len(successful) else math.nan
    )
    summary["time_under_level_p50_minutes"] = (
        float(successful["time_under_level_minutes"].median()) if len(successful) else math.nan
    )
    for hours in HORIZON_HOURS:
        eligible = _complete_for_horizon(activated, hours)
        successes = int((eligible[f"return_{hours}h"] == True).sum())  # noqa: E712
        total = int(len(eligible))
        low, high = wilson_interval(successes, total)
        summary[f"return_{hours}h_probability"] = successes / total if total else math.nan
        summary[f"return_{hours}h_ci_low"] = low
        summary[f"return_{hours}h_ci_high"] = high
        summary[f"return_{hours}h_n"] = total
    for column in (
        "balanced_net_return_pct",
        "conservative_net_return_pct",
        "aggressive_net_return_pct",
    ):
        if column in activated:
            summary[f"{column}_mean"] = float(activated[column].dropna().mean())
    return summary


def _group_rows(frame: pd.DataFrame, dimensions: list[str], window: str) -> list[dict]:
    rows = []
    for keys, group in frame.groupby(dimensions, dropna=False, sort=True):
        keys = keys if isinstance(keys, tuple) else (keys,)
        row = {dimension: key for dimension, key in zip(dimensions, keys)}
        row["window"] = window
        row.update(summarize_group(group))
        rows.append(row)
    return rows


def conditional_return_curves(frame: pd.DataFrame, *, window: str = "all") -> pd.DataFrame:
    activated = frame[frame["activated"] == True]  # noqa: E712
    rows = []
    base_dimensions = ["symbol", "interval", "galka_type"]
    groupings = [(base_dimensions + ["split"], False), (base_dimensions, True)]
    for dimensions, combined_split in groupings:
        for keys, group in activated.groupby(dimensions, dropna=False, sort=True):
            keys = keys if isinstance(keys, tuple) else (keys,)
            identity = dict(zip(dimensions, keys))
            if combined_split:
                identity["split"] = "all"
            for depth in DEPTH_THRESHOLDS_PCT:
                suffix = str(depth).replace(".", "_")
                reached = group[group[f"depth_{suffix}_reached"] == True]  # noqa: E712
                for hours in HORIZON_HOURS:
                    depth_minutes = reached[f"depth_{suffix}_minutes"]
                    returned_after = reached["return_minutes"] - depth_minutes
                    observed = reached[
                        reached["returned"]
                        | ((reached["available_minutes"] - depth_minutes) >= hours * 60)
                    ]
                    observed_return = returned_after.loc[observed.index]
                    successes = int((observed_return <= hours * 60).sum())
                    total = int(len(observed))
                    low, high = wilson_interval(successes, total)
                    rows.append(
                        {
                            **identity,
                            "window": window,
                            "depth_pct": depth,
                            "horizon_hours_after_depth": hours,
                            "reached_count": int(len(reached)),
                            "observed_count": total,
                            "return_probability": successes / total if total else math.nan,
                            "ci_low": low,
                            "ci_high": high,
                            "insufficient_data": total < MIN_SAMPLE,
                        }
                    )
    return pd.DataFrame(rows)


def probability_cliffs(curves: pd.DataFrame, horizon: int = 24) -> pd.DataFrame:
    rows = []
    subset = curves[curves["horizon_hours_after_depth"] == horizon]
    dimensions = ["symbol", "interval", "galka_type", "split", "window"]
    for keys, group in subset.groupby(dimensions, dropna=False, sort=True):
        ordered = group.sort_values("depth_pct")
        valid = ordered[(ordered["observed_count"] >= MIN_SAMPLE) & ordered["return_probability"].notna()]
        if len(valid) < 2:
            rows.append({**dict(zip(dimensions, keys)), "cliff_depth_pct": math.nan, "probability_drop": math.nan, "insufficient_data": True})
            continue
        changes = valid["return_probability"].diff()
        index = changes.idxmin()
        rows.append(
            {
                **dict(zip(dimensions, keys)),
                "cliff_depth_pct": float(valid.loc[index, "depth_pct"]),
                "probability_before": float(valid.loc[valid.index[valid.index.get_loc(index) - 1], "return_probability"]),
                "probability_after": float(valid.loc[index, "return_probability"]),
                "probability_drop": float(-changes.loc[index]),
                "insufficient_data": False,
            }
        )
    return pd.DataFrame(rows)


def build_statistics(frame: pd.DataFrame) -> dict[str, pd.DataFrame]:
    activated_times = pd.to_datetime(frame.loc[frame["activated"] == True, "activation_time"], utc=True)  # noqa: E712
    as_of = activated_times.max() if len(activated_times) else pd.Timestamp.now(tz="UTC")
    global_rows = []
    window_frames: dict[str, pd.DataFrame] = {"all": frame}
    for days in RECENT_WINDOWS_DAYS:
        window_frames[f"{days}d"] = frame[
            pd.to_datetime(frame["confirmation_time"], utc=True) >= as_of - pd.Timedelta(days=days)
        ]
    for window, subset in window_frames.items():
        if subset.empty:
            continue
        global_rows.extend(_group_rows(subset, ["symbol", "interval", "galka_type", "split"], window))
        combined = _group_rows(subset, ["symbol", "interval", "galka_type"], window)
        for row in combined:
            row["split"] = "all"
        global_rows.extend(combined)
    global_stats = pd.DataFrame(global_rows)

    curves = []
    for window, subset in window_frames.items():
        if not subset.empty:
            curves.append(conditional_return_curves(subset, window=window))
    conditional = pd.concat(curves, ignore_index=True) if curves else pd.DataFrame()
    cliffs = probability_cliffs(conditional) if not conditional.empty else pd.DataFrame()

    regime_rows = []
    for keys, group in frame.groupby(
        ["galka_type", "regime", "volatility_regime", "split"], dropna=False, sort=True
    ):
        regime_rows.append(
            {
                "galka_type": keys[0],
                "regime": keys[1],
                "volatility_regime": keys[2],
                "split": keys[3],
                **summarize_group(group),
            }
        )
    for keys, group in frame.groupby(
        ["galka_type", "regime", "volatility_regime"], dropna=False, sort=True
    ):
        regime_rows.append(
            {
                "galka_type": keys[0],
                "regime": keys[1],
                "volatility_regime": keys[2],
                "split": "all",
                **summarize_group(group),
            }
        )
    regimes = pd.DataFrame(regime_rows)

    recent_rows = []
    all_summary = frame.groupby("galka_type", sort=True).apply(
        lambda group: pd.Series(summarize_group(group)), include_groups=False
    )
    for window in ("30d", "90d", "180d", "365d"):
        subset = window_frames.get(window, pd.DataFrame())
        if subset.empty:
            continue
        for galka_type, group in subset.groupby("galka_type", sort=True):
            recent = summarize_group(group)
            history_p75 = all_summary.loc[galka_type, "depth_success_p75"] if galka_type in all_summary.index else math.nan
            recent_rows.append(
                {
                    "galka_type": galka_type,
                    "window": window,
                    "count": recent["count_complete"],
                    "depth_p75": recent["depth_success_p75"],
                    "historical_depth_p75": history_p75,
                    "depth_p75_delta": recent["depth_success_p75"] - history_p75,
                    "return_24h_probability": recent["return_24h_probability"],
                    "insufficient_data": recent["insufficient_data"],
                }
            )
    recent = pd.DataFrame(recent_rows)
    return {
        "global": global_stats,
        "conditional": conditional,
        "cliffs": cliffs,
        "regimes": regimes,
        "recent": recent,
    }
