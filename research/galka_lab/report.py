from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .config import MIN_SAMPLE, MODEL_VERSION
from .pack import json_safe
from .statistics import summarize_group
from .utils import write_json


def markdown_table(frame: pd.DataFrame, columns: list[str], limit: int | None = None) -> str:
    shown = frame.loc[:, [column for column in columns if column in frame]].copy()
    if limit is not None:
        shown = shown.head(limit)
    if shown.empty:
        return "_No rows._"
    for column in shown:
        if pd.api.types.is_float_dtype(shown[column]):
            shown[column] = shown[column].map(lambda value: "—" if pd.isna(value) else f"{value:.4f}")
        else:
            shown[column] = shown[column].map(lambda value: "—" if pd.isna(value) else str(value))
    header = "| " + " | ".join(shown.columns) + " |"
    divider = "|" + "|".join("---" for _ in shown.columns) + "|"
    rows = ["| " + " | ".join(row) + " |" for row in shown.astype(str).to_numpy()]
    return "\n".join((header, divider, *rows))


def _select(frame: pd.DataFrame, **matches) -> pd.DataFrame:
    """Filter optional report tables without treating a scalar False as a column name."""
    if frame.empty or any(column not in frame for column in matches):
        return frame.iloc[0:0].copy()
    mask = pd.Series(True, index=frame.index)
    for column, value in matches.items():
        mask &= frame[column] == value
    return frame[mask].copy()


def _type_summary(events: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for keys, group in events.groupby(["galka_type", "split"], sort=True):
        summary = summarize_group(group)
        rows.append({"galka_type": keys[0], "split": keys[1], **summary})
    return pd.DataFrame(rows)


def _summary_by(events: pd.DataFrame, dimensions: list[str]) -> pd.DataFrame:
    rows = []
    for keys, group in events.groupby(dimensions, sort=True):
        keys = keys if isinstance(keys, tuple) else (keys,)
        rows.append(
            {
                **dict(zip(dimensions, keys)),
                **summarize_group(group),
            }
        )
    return pd.DataFrame(rows)


def _dense_zone_rows(profiles: dict) -> pd.DataFrame:
    rows = []
    for galka_type, type_profiles in sorted(profiles.items()):
        for profile_name, profile in type_profiles.items():
            pairs = sorted(
                zip(
                    profile.get("depths_pct", []),
                    profile.get("density_weights", profile.get("weights", [])),
                ),
                key=lambda item: item[1],
                reverse=True,
            )[:3]
            rows.append(
                {
                    "galka_type": galka_type,
                    "profile": profile_name,
                    "statistically_dense_zones": ", ".join(
                        f"{depth:.2f}% ({weight * 100:.1f}%)" for depth, weight in pairs
                    ),
                    "maximum_depth_pct": profile.get("maximum_depth_pct"),
                    "percentile_stop_pct": profile.get("percentile_stop_pct"),
                    "risk_per_1000_usd": profile.get(
                        "max_risk_per_1000_usd_at_percentile_stop"
                    ),
                    "liquidation_buffer_pct": profile.get("grid_to_liquidation_buffer_pct"),
                    "paper_only": profile.get("paper_only", True),
                    "stress_test_only": profile.get("stress_test_only", False),
                }
            )
    return pd.DataFrame(rows)


def write_reports(
    output: Path,
    *,
    events: pd.DataFrame,
    statistics: dict[str, pd.DataFrame],
    model: dict,
    evaluation: dict,
    manifest: dict,
    run_metadata: dict,
) -> None:
    output.mkdir(parents=True, exist_ok=True)
    type_summary = _type_summary(events)
    oos = type_summary[type_summary["split"] == "final_oos"].sort_values(
        ["return_24h_probability", "depth_success_p75"], ascending=[False, True]
    )
    selection = pd.DataFrame(model.get("selection", []))
    grid = pd.DataFrame(evaluation.get("grid_summary", []))
    stops = pd.DataFrame(evaluation.get("stop_summary", []))
    exits = pd.DataFrame(evaluation.get("trailing_summary", []))
    recent = statistics.get("recent", pd.DataFrame())
    cliffs = statistics.get("cliffs", pd.DataFrame())
    regimes = statistics.get("regimes", pd.DataFrame())
    correlations = statistics.get("correlation_stability", pd.DataFrame())
    block_bootstrap = statistics.get("block_bootstrap", pd.DataFrame())
    dense_zones = _dense_zone_rows(evaluation.get("profiles", {}))
    split_inventory = _summary_by(events, ["split"])
    source_quality = pd.DataFrame(
        [
            {
                "symbol": item.get("symbol"),
                "interval": item.get("interval"),
                "rows": item.get("row_count"),
                "start": item.get("start"),
                "end": item.get("end"),
                "gaps": item.get("gaps"),
                "missing_bars": item.get("missing_bars"),
                "duplicates": item.get("duplicates"),
                "invalid_ohlc": item.get("invalid_ohlc"),
            }
            for item in manifest.get("datasets", [])
        ]
    )
    oos_events = events[events["split"] == "final_oos"]
    symbol_oos = _summary_by(oos_events, ["galka_type", "symbol"])
    interval_oos = _summary_by(oos_events, ["galka_type", "interval"])
    grid_oos = _select(grid, split="final_oos")
    balanced_oos = _select(grid_oos, profile="Balanced")
    balanced_columns = [
        "galka_type",
        "mean_net_return_pct",
        "cvar_95_pct",
        "mean_fixed_risk_r",
    ]
    promotion = oos.merge(
        balanced_oos.reindex(columns=balanced_columns),
        on="galka_type",
        how="left",
    )
    promotion["historical_screen_pass"] = (
        (promotion["count_complete"] >= MIN_SAMPLE)
        & (promotion["mean_net_return_pct"] > 0)
        & (promotion["mean_fixed_risk_r"] > 0)
    )
    promotion["auto_paper_eligible"] = False
    promotion["decision"] = np.where(
        promotion["historical_screen_pass"],
        "historical screen only; blocked pending live shadow thresholds",
        "not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive",
    )

    interim = [
        "# Galka Lab interim statistical report",
        "",
        f"Model: `{MODEL_VERSION}` · hash `{model.get('model_hash')}`.",
        "",
        "This report is generated after dataset/outcome construction and before UI integration. "
        "Final OOS rows were not used to choose the cluster count, centroids, grids, or stops.",
        "",
        "## Data inventory",
        "",
        f"- Range: {manifest.get('start')} → {manifest.get('end')}",
        f"- Symbols: {', '.join(manifest.get('symbols', []))}",
        f"- Candidate intervals: {', '.join(manifest.get('intervals', []))}",
        f"- Execution interval: {manifest.get('execution_interval')}",
        f"- Broad candidates: {manifest.get('candidate_count', len(events)):,}",
        f"- Independent within-timeframe family representatives: {manifest.get('family_representative_count', len(events)):,}",
        f"- Embargo-purged family events: {run_metadata.get('purged_event_count', 0):,}",
        f"- Retained statistical events: {len(events):,}",
        f"- Activated events: {int((events['activated'] == True).sum()):,}",  # noqa: E712
        f"- Censored outcomes: {int((events.get('outcome_censored', False) == True).sum()):,}",  # noqa: E712
        "",
        "## Chronological split inventory",
        "",
        markdown_table(split_inventory, ["split", "count_candidates", "count_activated", "count_complete", "return_24h_probability", "insufficient_data"]),
        "",
        "## Cluster selection (train + validation only)",
        "",
        markdown_table(selection, ["k", "train_silhouette", "validation_silhouette", "stability_ari", "minimum_cluster", "sample_ok", "selection_score"]),
        "",
        "## Final OOS type summary",
        "",
        markdown_table(oos, ["galka_type", "count_complete", "return_1h_probability", "return_3h_probability", "return_6h_probability", "return_12h_probability", "return_24h_probability", "return_48h_probability", "return_24h_ci_low", "return_24h_ci_high", "depth_success_p50", "depth_success_p75", "depth_success_p90", "depth_success_p95", "depth_success_p99", "return_minutes_p50", "return_minutes_p75", "return_minutes_p90", "mae_mean_pct", "mfe_after_return_mean_pct", "mfe_after_reclaim_mean_pct", "insufficient_data"]),
        "",
        "## Data-quality gates",
        "",
        "Every source interval is hashed and checked for duplicates, chronology, gaps, and OHLC validity. "
        "Candidate context never crosses a source-data gap. Rows below the minimum sample threshold are marked insufficient rather than promoted as evidence.",
        "",
        markdown_table(source_quality, ["symbol", "interval", "rows", "start", "end", "gaps", "missing_bars", "duplicates", "invalid_ohlc"]),
        "",
        "## Interim warning",
        "",
        "Type names are human-readable labels for train-fitted centroids, not causal market laws. "
        "A strong in-sample cluster is not accepted unless walk-forward and final OOS remain directionally consistent.",
    ]
    (output / "INTERIM_STATISTICAL_REPORT.md").write_text("\n".join(interim) + "\n")

    best = oos[oos["count_complete"] >= MIN_SAMPLE].head(3)
    weak = promotion[promotion["historical_screen_pass"] == False]  # noqa: E712
    significant_cliffs = _select(
        _select(cliffs, split="final_oos"), window="all", significant_cliff=True
    )
    regime_oos = _select(regimes, split="final_oos")
    regime_oos = (
        regime_oos[regime_oos["count_complete"] >= MIN_SAMPLE]
        if "count_complete" in regime_oos
        else regime_oos.iloc[0:0].copy()
    )
    best_regimes = regime_oos.sort_values(
        ["balanced_net_return_pct_mean", "return_24h_probability"], ascending=False
    ).head(8) if not regime_oos.empty else regime_oos
    worst_regimes = regime_oos.sort_values(
        ["balanced_net_return_pct_mean", "return_24h_probability"], ascending=True
    ).head(8) if not regime_oos.empty else regime_oos
    exit_oos = _select(exits, split="final_oos")
    mandatory_exits = (
        exit_oos[
            exit_oos["exit"].isin(
                (
                    "galka_tp_48h",
                    "reclaim_010_trail_075",
                    "reclaim_010_trail_atr",
                    "reclaim_010_trail_swing",
                    "partial_galka_runner",
                    "max_hold_12h",
                    "max_hold_24h",
                    "max_hold_48h",
                )
            )
        ]
        if not exit_oos.empty and "exit" in exit_oos
        else exit_oos
    )
    best_exits = (
        exit_oos.sort_values("mean_net_return_pct", ascending=False)
        .groupby("galka_type", as_index=False)
        .head(3)
        if not exit_oos.empty
        else exit_oos
    )
    shown_exits = pd.concat((mandatory_exits, best_exits), ignore_index=True).drop_duplicates(
        ["galka_type", "exit"]
    ) if not exit_oos.empty else exit_oos
    stable_correlations = (
        correlations[correlations["stable_direction"] == True]  # noqa: E712
        .assign(abs_oos=lambda value: value["final_oos_spearman"].abs())
        .sort_values("abs_oos", ascending=False)
        .head(15)
        if not correlations.empty
        and "stable_direction" in correlations
        and "final_oos_spearman" in correlations
        else correlations
    )
    block_oos = _select(
        _select(block_bootstrap, split="final_oos"), scope="cross_symbol"
    )
    block_oos = (
        block_oos.sort_values("galka_type")
        if not block_oos.empty and "galka_type" in block_oos
        else block_oos
    )
    decision = [
        "# Galka Lab decision report",
        "",
        "## Promotion decision",
        "",
        "Return frequency is not treated as profitability. A type is not eligible for auto-paper when its "
        "fee-adjusted Balanced fixed-notional OOS EV or fixed-risk result is non-positive. Live shadow validation remains mandatory even after a historical threshold passes.",
        "",
        markdown_table(promotion, ["galka_type", "count_complete", "return_24h_probability", "mean_net_return_pct", "mean_fixed_risk_r", "cvar_95_pct", "historical_screen_pass", "auto_paper_eligible", "decision"]),
        "",
        "Auto-paper remains disabled; this report cannot enable it.",
        "",
        "## Most stable observational return types on untouched final OOS",
        "",
        markdown_table(best, ["galka_type", "count_complete", "return_6h_probability", "return_24h_probability", "return_24h_ci_low", "return_24h_ci_high", "depth_success_p75", "depth_success_p90", "depth_success_p95", "depth_success_p99", "return_minutes_p50"]),
        "",
        "## Day-block bootstrap uncertainty on untouched final OOS",
        "",
        "UTC activation days are resampled as blocks, keeping same-day BTC/ETH/SOL and cross-timeframe events together. These intervals are the primary uncertainty view; event-level Wilson intervals remain a secondary screening aid.",
        "",
        markdown_table(block_oos, ["galka_type", "event_count", "activated_count", "returned_count", "block_count", "return_1h_probability", "return_1h_block_ci_low", "return_1h_block_ci_high", "return_24h_probability", "return_24h_block_ci_low", "return_24h_block_ci_high", "return_48h_probability", "return_48h_block_ci_low", "return_48h_block_ci_high", "depth_success_p50", "depth_success_p50_block_ci_low", "depth_success_p50_block_ci_high", "depth_success_p75", "depth_success_p75_block_ci_low", "depth_success_p75_block_ci_high", "depth_success_p90", "depth_success_p90_block_ci_low", "depth_success_p90_block_ci_high", "insufficient_data"]),
        "",
        "## Types that should not be promoted",
        "",
        markdown_table(weak, ["galka_type", "count_complete", "return_24h_probability", "mean_net_return_pct", "mean_fixed_risk_r", "cvar_95_pct", "decision"]),
        "",
        "## Significant conditional-return cliffs (≥5 percentage points)",
        "",
        markdown_table(significant_cliffs, ["symbol", "interval", "galka_type", "window", "cliff_depth_pct", "probability_before", "probability_after", "probability_drop", "significant_cliff", "insufficient_data"], 60),
        "",
        "The full conditional depth × horizon table, including recovery time and probability of the next deeper band, is retained in the JSON outputs and terminal pack.",
        "",
        "## Statistically dense entry zones and normalized risk",
        "",
        markdown_table(dense_zones, ["galka_type", "profile", "statistically_dense_zones", "maximum_depth_pct", "percentile_stop_pct", "risk_per_1000_usd", "liquidation_buffer_pct", "paper_only", "stress_test_only"]),
        "",
        "## Grid profiles",
        "",
        "Fixed-notional EV is candidate-level: observable non-activations and fully unfilled grids are 0%, while unresolved censored candidates are excluded. Return on filled capital and filled win rate remain conditional on a fill.",
        "",
        markdown_table(grid_oos, ["galka_type", "profile", "eligible_count", "count", "fill_probability", "fill_probability_given_activation", "full_fill_probability", "expected_fill_fraction", "expected_mae_pct", "mean_net_return_pct", "median_net_return_pct", "mean_return_on_filled_pct", "mean_fixed_risk_r", "win_rate", "filled_win_rate", "cvar_95_pct", "cvar_95_fixed_risk_r", "paper_only", "stress_test_only"]),
        "",
        "## Stop trade-offs",
        "",
        markdown_table(_select(stops, split="final_oos"), ["galka_type", "stop", "eligible_count", "count", "filled_count", "mean_net_return_pct", "win_rate", "cvar_95_pct"]),
        "",
        "## Exit and trailing trade-offs",
        "",
        markdown_table(shown_exits, ["galka_type", "exit", "eligible_count", "count", "filled_count", "mean_net_return_pct", "median_net_return_pct", "win_rate", "cvar_95_pct", "paper_only"]),
        "",
        "All reclaim buffers (0.00/0.10/0.20%), fixed trails (0.15/0.30/0.50/0.75/1.00%), ATR trail, two-bar-confirmed local-minimum trail, fixed GALKA TP, partial runner, and maximum holds remain in evaluation.json.",
        "",
        "## Cross-symbol portability on final OOS",
        "",
        markdown_table(symbol_oos, ["galka_type", "symbol", "count_complete", "return_24h_probability", "return_24h_ci_low", "return_24h_ci_high", "depth_success_p75", "balanced_net_return_pct_mean", "insufficient_data"]),
        "",
        "## Timeframe robustness on final OOS",
        "",
        markdown_table(interval_oos, ["galka_type", "interval", "count_complete", "return_24h_probability", "depth_success_p75", "balanced_net_return_pct_mean", "insufficient_data"]),
        "",
        "## Best and worst final-OOS regimes",
        "",
        "Best by Balanced fixed-notional EV:",
        "",
        markdown_table(best_regimes, ["galka_type", "regime", "volatility_regime", "count_complete", "return_24h_probability", "depth_success_p75", "balanced_net_return_pct_mean", "insufficient_data"]),
        "",
        "Worst by Balanced fixed-notional EV:",
        "",
        markdown_table(worst_regimes, ["galka_type", "regime", "volatility_regime", "count_complete", "return_24h_probability", "depth_success_p75", "balanced_net_return_pct_mean", "insufficient_data"]),
        "",
        "## Recent drift",
        "",
        markdown_table(recent, ["galka_type", "window", "count", "depth_p75", "historical_depth_p75", "depth_p75_delta", "return_24h_probability", "insufficient_data"], 50),
        "",
        "## Stable versus unstable feature relationships",
        "",
        markdown_table(stable_correlations, ["feature", "target", "train_spearman", "validation_spearman", "final_oos_spearman", "stable_direction"]),
        "",
        "Only same-direction train/validation/final-OOS Spearman relationships with |ρ| ≥ 0.02 in every split are listed as stable. Omitted relationships are not promoted as evidence; multiple-testing risk still applies.",
        "",
        "No profile in this report changes production paper defaults. Every grid and exit experiment is paper-only; Aggressive is stress-test-only; auto-paper remains disabled.",
    ]
    (output / "DECISION_REPORT.md").write_text("\n".join(decision) + "\n")

    limitations = """# Honest limitations

- Binance public OHLCV is not an order-book or queue-position record.
- One-minute execution replay uses a deterministic directional OHLC path; ticks inside a minute are unknown.
- Resting virtual limits fill at their level after the candle reaches it; spread and partial queue fills are omitted.
- Maker/taker fees and fixed slippage are modeled; funding, latency and liquidation-engine details are omitted.
- Right-side bars are used only to confirm a candidate; trading outcomes start strictly after confirmation.
- End-of-data outcomes are censored instead of counted as losses.
- Depth-conditioned return uses only depth reached before the first return; later re-tests are not backfilled into the original event.
- Nearby candidates are de-duplicated within a symbol/timeframe family, but simultaneous cross-timeframe events are correlated and must not be read as independent trials.
- Primary final-OOS uncertainty uses UTC-day block bootstrap so same-day BTC/ETH/SOL and cross-timeframe dependence stays together. Conditional depth tables retain event-level Wilson intervals as a screening aid, not an independent-trial guarantee.
- Source gaps are recorded and candidate context crossing a gap is excluded; missing bars are not interpolated.
- One-minute activation/outcome/trailing replay stops at a source-gap boundary; candles after the gap cannot complete the earlier event.
- Market regimes drift. Seven-day and rare-crisis samples can be too small for stable conclusions.
- Clustering is descriptive. Human names do not prove causality or persistence.
- Cluster silhouette and stability metrics must be read together: stable reruns can still have overlapping, weakly separated types.
- Multiple grid/stop/trailing comparisons create multiple-testing risk; failed variants remain in outputs.
- Candidate-level fixed-notional results count observable non-activations and fully unfilled grids as 0% cash returns; unresolved censored candidates are excluded. Return-on-filled is reported separately.
- Candidate-level fixed-risk results count no-fill candidates as 0R and use a train-fitted percentile stop.
- Liquidation distance is only a normalized approximation with a stated maintenance-margin assumption, not an exchange liquidation calculation.
- Paper results cannot be assumed to transfer to real trading. This repository contains no real-order path.
"""
    (output / "HONEST_LIMITATIONS.md").write_text(limitations)

    model_card = [
        "# Galka Lab model card",
        "",
        f"- Model version: `{MODEL_VERSION}`",
        f"- Model hash: `{model.get('model_hash')}`",
        f"- Algorithm: {model.get('algorithm')}",
        f"- Types: {model.get('selected_k')}",
        f"- Seed: {model.get('seed')}",
        f"- Fit split: {model.get('fit_split')}",
        f"- Selection: {model.get('selection_uses')}",
        "- Intended use: research, manual assistance, and isolated shadow paper only.",
        "- Prohibited use: real orders or an unstated production-strategy change.",
        "",
        "## Type mapping",
        "",
        *[f"- Cluster {cluster}: {name}" for cluster, name in model.get("type_names", {}).items()],
        "",
        "Type labels are descriptive centroid names. Formal geometry is stored in `centers_raw`; representative train, validation, and final-OOS examples are stored in `statistics_examples.json`.",
    ]
    (output / "MODEL_CARD.md").write_text("\n".join(model_card) + "\n")

    write_json(output / "run_metadata.json", run_metadata)
    write_json(output / "model.json", model)
    write_json(output / "evaluation.json", json_safe(evaluation))
    write_json(output / "type_summary.json", json_safe(type_summary.to_dict(orient="records")))
    for name, frame in statistics.items():
        write_json(output / f"statistics_{name}.json", json_safe(frame.to_dict(orient="records")))
