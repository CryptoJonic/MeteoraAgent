from __future__ import annotations

import math
from typing import Iterable

import numpy as np
import pandas as pd

from .config import (
    BOOTSTRAP_SAMPLES,
    CLUSTER_FEATURES,
    DEPTH_QUANTILES,
    DEPTH_THRESHOLDS_PCT,
    HORIZON_HOURS,
    MIN_SAMPLE,
    MAX_OUTCOME_HOURS,
    RECENT_WINDOWS_DAYS,
    SEED,
)


SURVIVAL_MINUTES = (15, 30, 60, 180, 360, 720, 1_440, 2_880, 10_080, 20_160)


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


def weighted_quantile(values: np.ndarray, weights: np.ndarray, quantile: float) -> float:
    finite = np.isfinite(values) & np.isfinite(weights) & (weights > 0)
    values = values[finite]
    weights = weights[finite]
    if not len(values):
        return math.nan
    order = np.argsort(values)
    ordered_values = values[order]
    cumulative = np.cumsum(weights[order])
    cutoff = quantile * cumulative[-1]
    return float(ordered_values[min(np.searchsorted(cumulative, cutoff, side="left"), len(ordered_values) - 1)])


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
    strategy_evaluable = (
        group[group["strategy_evaluable"] == True]  # noqa: E712
        if "strategy_evaluable" in group
        else activated
    )
    if "strategy_evaluable" in group:
        summary["strategy_evaluable_count"] = int(len(strategy_evaluable))
    for column in (
        "balanced_net_return_pct",
        "conservative_net_return_pct",
        "aggressive_net_return_pct",
    ):
        if column in strategy_evaluable:
            summary[f"{column}_mean"] = float(
                strategy_evaluable[column].dropna().mean()
            )
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


def _conditional_return_curves(
    frame: pd.DataFrame,
    *,
    window: str,
    base_dimensions: list[str],
    include_all_splits: bool = True,
) -> pd.DataFrame:
    activated = frame[frame["activated"] == True]  # noqa: E712
    rows = []
    groupings = [(base_dimensions, activated, "all")]
    if include_all_splits:
        groupings.insert(0, (base_dimensions + ["split"], activated, None))
    else:
        groupings.append(
            (
                base_dimensions,
                activated[activated["split"] == "final_oos"],
                "final_oos",
            )
        )
    for dimensions, source, forced_split in groupings:
        for keys, group in source.groupby(dimensions, dropna=False, sort=True):
            keys = keys if isinstance(keys, tuple) else (keys,)
            identity = dict(zip(dimensions, keys))
            if forced_split is not None:
                identity["split"] = forced_split
            for depth_index, depth in enumerate(DEPTH_THRESHOLDS_PCT):
                suffix = str(depth).replace(".", "_")
                reached = group[group[f"depth_{suffix}_reached"] == True]  # noqa: E712
                completed_after_depth = reached[
                    (reached["returned"] == True) | (reached["outcome_censored"] == False)  # noqa: E712
                ]
                next_depth = (
                    DEPTH_THRESHOLDS_PCT[depth_index + 1]
                    if depth_index + 1 < len(DEPTH_THRESHOLDS_PCT)
                    else None
                )
                if next_depth is not None and len(completed_after_depth):
                    next_suffix = str(next_depth).replace(".", "_")
                    further_drop_count = int(
                        (completed_after_depth[f"depth_{next_suffix}_reached"] == True).sum()  # noqa: E712
                    )
                    further_drop_probability = further_drop_count / len(completed_after_depth)
                else:
                    further_drop_count = 0
                    further_drop_probability = math.nan
                recovered_after = reached[reached["returned"] == True]  # noqa: E712
                recovery_minutes = (
                    recovered_after["return_minutes"] - recovered_after[f"depth_{suffix}_minutes"]
                ).dropna()
                recovery_minutes = recovery_minutes[recovery_minutes >= 0]
                for hours in HORIZON_HOURS:
                    depth_minutes = reached[f"depth_{suffix}_minutes"]
                    returned_after = reached["return_minutes"] - depth_minutes
                    observed = reached[
                        (reached["returned"] == True)  # noqa: E712
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
                            "recovery_minutes_p50": (
                                float(recovery_minutes.quantile(0.50))
                                if len(recovery_minutes)
                                else math.nan
                            ),
                            "recovery_minutes_p75": (
                                float(recovery_minutes.quantile(0.75))
                                if len(recovery_minutes)
                                else math.nan
                            ),
                            "next_depth_pct": next_depth,
                            "further_drop_count": further_drop_count,
                            "further_drop_probability": further_drop_probability,
                            "insufficient_data": total < MIN_SAMPLE,
                        }
                    )
    return pd.DataFrame(rows)


def conditional_return_curves(frame: pd.DataFrame, *, window: str = "all") -> pd.DataFrame:
    return _conditional_return_curves(
        frame,
        window=window,
        base_dimensions=["symbol", "interval", "galka_type"],
    )


def conditional_return_curves_by_regime(
    frame: pd.DataFrame, *, window: str = "all"
) -> pd.DataFrame:
    return _conditional_return_curves(
        frame,
        window=window,
        base_dimensions=[
            "symbol",
            "interval",
            "galka_type",
            "regime",
            "volatility_regime",
        ],
        include_all_splits=False,
    )


def probability_cliffs(curves: pd.DataFrame, horizon: int = 24) -> pd.DataFrame:
    rows = []
    subset = curves[curves["horizon_hours_after_depth"] == horizon]
    dimensions = ["symbol", "interval", "galka_type", "split", "window"]
    for keys, group in subset.groupby(dimensions, dropna=False, sort=True):
        ordered = group.sort_values("depth_pct")
        valid = ordered[(ordered["observed_count"] >= MIN_SAMPLE) & ordered["return_probability"].notna()]
        if len(valid) < 2:
            rows.append({**dict(zip(dimensions, keys)), "cliff_depth_pct": math.nan, "probability_drop": math.nan, "significant_cliff": False, "insufficient_data": True})
            continue
        changes = valid["return_probability"].diff()
        index = changes.idxmin()
        probability_drop = float(-changes.loc[index])
        rows.append(
            {
                **dict(zip(dimensions, keys)),
                "cliff_depth_pct": float(valid.loc[index, "depth_pct"]),
                "probability_before": float(valid.loc[valid.index[valid.index.get_loc(index) - 1], "return_probability"]),
                "probability_after": float(valid.loc[index, "return_probability"]),
                "probability_drop": probability_drop,
                "significant_cliff": bool(probability_drop >= 0.05),
                "insufficient_data": False,
            }
        )
    return pd.DataFrame(rows)


def recency_weighted_statistics(
    frame: pd.DataFrame,
    *,
    as_of: pd.Timestamp,
    half_life_days: float = 90.0,
) -> pd.DataFrame:
    rows = []
    for keys, group in frame.groupby(["symbol", "interval", "galka_type"], sort=True):
        activated = group[group["activated"] == True].copy()  # noqa: E712
        if activated.empty:
            continue
        times = pd.to_datetime(activated["activation_time"], utc=True)
        ages = np.maximum(0.0, (as_of - times).dt.total_seconds().to_numpy() / 86_400)
        weights = np.exp(-np.log(2) * ages / half_life_days)
        successful = activated[activated["returned"] == True]  # noqa: E712
        successful_weights = weights[(activated["returned"] == True).to_numpy()]  # noqa: E712
        row = {
            "symbol": keys[0],
            "interval": keys[1],
            "galka_type": keys[2],
            "half_life_days": half_life_days,
            "count_activated": int(len(activated)),
            "effective_sample_size": float(weights.sum() ** 2 / np.square(weights).sum()),
            "depth_success_p50": weighted_quantile(
                successful["mae_pct"].to_numpy(float), successful_weights, 0.50
            ),
            "depth_success_p75": weighted_quantile(
                successful["mae_pct"].to_numpy(float), successful_weights, 0.75
            ),
            "depth_success_p90": weighted_quantile(
                successful["mae_pct"].to_numpy(float), successful_weights, 0.90
            ),
        }
        for hours in HORIZON_HOURS:
            column = f"return_{hours}h"
            eligible = activated[column].notna().to_numpy()
            denominator = float(weights[eligible].sum())
            successes = (activated.loc[eligible, column] == True).to_numpy(float)  # noqa: E712
            row[f"return_{hours}h_probability"] = (
                float(np.dot(weights[eligible], successes) / denominator)
                if denominator > 0
                else math.nan
            )
        rows.append(row)
    return pd.DataFrame(rows)


def depth_histograms(frame: pd.DataFrame, *, window: str) -> pd.DataFrame:
    rows = []
    edges = np.asarray((0.0, *DEPTH_THRESHOLDS_PCT, np.inf), dtype=float)
    activated = frame[frame["activated"] == True]  # noqa: E712
    for keys, group in activated.groupby(["symbol", "interval", "galka_type"], sort=True):
        complete = group[
            (group["returned"] == True) | (group["outcome_censored"] == False)  # noqa: E712
        ]
        successful = group[group["returned"] == True]  # noqa: E712
        all_counts, _ = np.histogram(complete["mae_pct"].dropna().to_numpy(float), bins=edges)
        success_counts, _ = np.histogram(successful["mae_pct"].dropna().to_numpy(float), bins=edges)
        for index, lower in enumerate(edges[:-1]):
            rows.append(
                {
                    "symbol": keys[0],
                    "interval": keys[1],
                    "galka_type": keys[2],
                    "window": window,
                    "depth_from_pct": float(lower),
                    "depth_to_pct": float(edges[index + 1]) if np.isfinite(edges[index + 1]) else math.nan,
                    "count_all_complete": int(all_counts[index]),
                    "count_returned": int(success_counts[index]),
                }
            )
    return pd.DataFrame(rows)


def return_survival(frame: pd.DataFrame, *, window: str) -> pd.DataFrame:
    rows = []
    activated = frame[frame["activated"] == True]  # noqa: E712
    for keys, group in activated.groupby(["symbol", "interval", "galka_type"], sort=True):
        returned = (group["returned"] == True).to_numpy()  # noqa: E712
        duration = np.where(
            returned,
            group["return_minutes"].to_numpy(float),
            np.minimum(group["available_minutes"].to_numpy(float), MAX_OUTCOME_HOURS * 60),
        )
        finite = np.isfinite(duration)
        duration = duration[finite]
        returned = returned[finite]
        survival = 1.0
        unique_times, inverse = np.unique(duration, return_inverse=True)
        total_counts = np.bincount(inverse, minlength=len(unique_times))
        event_counts = np.bincount(
            inverse, weights=returned.astype(int), minlength=len(unique_times)
        )
        time_cursor = 0
        at_risk = len(duration)
        for checkpoint in SURVIVAL_MINUTES:
            while time_cursor < len(unique_times) and unique_times[time_cursor] <= checkpoint:
                events_at_time = int(event_counts[time_cursor])
                if at_risk and events_at_time:
                    survival *= 1 - events_at_time / at_risk
                at_risk -= int(total_counts[time_cursor])
                time_cursor += 1
            rows.append(
                {
                    "symbol": keys[0],
                    "interval": keys[1],
                    "galka_type": keys[2],
                    "window": window,
                    "minutes": checkpoint,
                    "survival_probability": float(survival),
                    "cumulative_return_probability": float(1 - survival),
                    "sample": int(len(duration)),
                    "insufficient_data": bool(len(duration) < MIN_SAMPLE),
                }
            )
    return pd.DataFrame(rows)


def shape_profiles(frame: pd.DataFrame) -> pd.DataFrame:
    shape_columns = sorted(
        (column for column in frame.columns if column.startswith("shape_")),
        key=lambda value: (0 if value[6] == "m" else 1, -int(value[7:]) if value[6] == "m" else int(value[7:])),
    )
    if not shape_columns:
        return pd.DataFrame()
    rows = []
    groups = list(frame.groupby(["symbol", "interval", "galka_type"], sort=True))
    for keys, group in groups:
        values = group[shape_columns]
        rows.append(
            {
                "symbol": keys[0],
                "interval": keys[1],
                "galka_type": keys[2],
                "sample": int(len(group)),
                "offsets": [
                    -int(column[7:]) if column[6] == "m" else int(column[7:])
                    for column in shape_columns
                ],
                "p25_pct": [float(value) for value in values.quantile(0.25).to_numpy()],
                "p50_pct": [float(value) for value in values.quantile(0.50).to_numpy()],
                "p75_pct": [float(value) for value in values.quantile(0.75).to_numpy()],
            }
        )
    return pd.DataFrame(rows)


def representative_examples(frame: pd.DataFrame, count: int = 3) -> pd.DataFrame:
    columns = [
        "candidate_id",
        "symbol",
        "interval",
        "pivot_time_iso",
        "confirmation_time_iso",
        "galka_type",
        "type_distance",
        "drop_atr",
        "recovery_ratio",
        "split",
    ]
    rows = []
    for (galka_type, split), group in frame.groupby(["galka_type", "split"], sort=True):
        selected = (
            group.nsmallest(count, "type_distance")
            if "type_distance" in group
            else group.head(count)
        )
        rows.extend(selected[[column for column in columns if column in selected]].to_dict(orient="records"))
    return pd.DataFrame(rows)


def feature_correlations(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    rows = []
    split_frames = {
        split: frame[frame["split"] == split]
        for split in ("train", "validation", "final_oos")
    }
    split_frames["all"] = frame
    targets = {
        "return_24h": "return_24h",
        "mae_pct": "mae_pct",
        "balanced_net_return_pct": "balanced_net_return_pct",
    }
    for split, subset in split_frames.items():
        for feature in CLUSTER_FEATURES:
            for target_name, target in targets.items():
                pair = pd.DataFrame(
                    {
                        feature: pd.to_numeric(subset[feature], errors="coerce"),
                        target: pd.to_numeric(subset[target], errors="coerce"),
                    }
                ).replace([np.inf, -np.inf], np.nan).dropna()
                variable = pair[feature].nunique() >= 2 and pair[target].nunique() >= 2
                rows.append(
                    {
                        "feature": feature,
                        "target": target_name,
                        "split": split,
                        "sample": int(len(pair)),
                        "spearman": (
                            float(pair[feature].corr(pair[target].astype(float), method="spearman"))
                            if len(pair) >= MIN_SAMPLE and variable
                            else math.nan
                        ),
                        "insufficient_data": bool(len(pair) < MIN_SAMPLE),
                    }
                )
    correlations = pd.DataFrame(rows)
    stability_rows = []
    for (feature, target), group in correlations[
        correlations["split"].isin(("train", "validation", "final_oos"))
    ].groupby(["feature", "target"], sort=True):
        values = {
            row.split: row.spearman for row in group.itertuples(index=False)
        }
        finite = [value for value in values.values() if np.isfinite(value)]
        stable = (
            len(finite) == 3
            and min(abs(value) for value in finite) >= 0.02
            and len({int(np.sign(value)) for value in finite}) == 1
        )
        stability_rows.append(
            {
                "feature": feature,
                "target": target,
                "train_spearman": values.get("train", math.nan),
                "validation_spearman": values.get("validation", math.nan),
                "final_oos_spearman": values.get("final_oos", math.nan),
                "stable_direction": bool(stable),
            }
        )
    return correlations, pd.DataFrame(stability_rows)


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
    if not global_stats.empty:
        totals = global_stats.groupby(
            ["symbol", "interval", "split", "window"], dropna=False
        )["count_candidates"].transform("sum")
        global_stats["candidate_frequency"] = global_stats["count_candidates"] / totals.replace(0, np.nan)

    curves = []
    for window, subset in window_frames.items():
        if not subset.empty:
            curves.append(conditional_return_curves(subset, window=window))
    conditional = pd.concat(curves, ignore_index=True) if curves else pd.DataFrame()
    cliffs = probability_cliffs(conditional) if not conditional.empty else pd.DataFrame()
    regime_curves = []
    for window in ("all", "90d"):
        subset = window_frames.get(window, pd.DataFrame())
        if not subset.empty:
            regime_curves.append(conditional_return_curves_by_regime(subset, window=window))
    conditional_regime = (
        pd.concat(regime_curves, ignore_index=True) if regime_curves else pd.DataFrame()
    )

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
    for window in ("7d", "30d", "90d", "180d", "365d"):
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
    recency_weighted = recency_weighted_statistics(frame, as_of=as_of)
    correlations, correlation_stability = feature_correlations(frame)
    histograms = []
    survival = []
    for window in ("all", "90d", "365d"):
        subset = window_frames.get(window, pd.DataFrame())
        if subset.empty:
            continue
        histograms.append(depth_histograms(subset, window=window))
        survival.append(return_survival(subset, window=window))
    return {
        "global": global_stats,
        "conditional": conditional,
        "conditional_regime": conditional_regime,
        "cliffs": cliffs,
        "regimes": regimes,
        "recent": recent,
        "recency_weighted": recency_weighted,
        "histograms": pd.concat(histograms, ignore_index=True) if histograms else pd.DataFrame(),
        "survival": pd.concat(survival, ignore_index=True) if survival else pd.DataFrame(),
        "shape_profiles": shape_profiles(frame),
        "examples": representative_examples(frame),
        "correlations": correlations,
        "correlation_stability": correlation_stability,
    }
