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


def _type_summary(events: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for keys, group in events.groupby(["galka_type", "split"], sort=True):
        summary = summarize_group(group)
        rows.append({"galka_type": keys[0], "split": keys[1], **summary})
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
    recent = statistics.get("recent", pd.DataFrame())
    cliffs = statistics.get("cliffs", pd.DataFrame())

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
        f"- Candidates: {len(events):,}",
        f"- Activated events: {int((events['activated'] == True).sum()):,}",  # noqa: E712
        f"- Censored outcomes: {int((events.get('outcome_censored', False) == True).sum()):,}",  # noqa: E712
        "",
        "## Cluster selection (train + validation only)",
        "",
        markdown_table(selection, ["k", "train_silhouette", "validation_silhouette", "stability_ari", "minimum_cluster", "sample_ok", "selection_score"]),
        "",
        "## Final OOS type summary",
        "",
        markdown_table(oos, ["galka_type", "count_complete", "return_6h_probability", "return_24h_probability", "depth_success_p50", "depth_success_p75", "depth_success_p90", "return_minutes_p50", "mfe_after_return_mean_pct", "insufficient_data"]),
        "",
        "## Data-quality gates",
        "",
        "Every source interval is hashed and checked for duplicates, chronology, gaps, and OHLC validity. "
        "Rows below the minimum sample threshold are marked insufficient rather than promoted as evidence.",
        "",
        "## Interim warning",
        "",
        "Type names are human-readable labels for train-fitted centroids, not causal market laws. "
        "A strong in-sample cluster is not accepted unless walk-forward and final OOS remain directionally consistent.",
    ]
    (output / "INTERIM_STATISTICAL_REPORT.md").write_text("\n".join(interim) + "\n")

    best = oos[oos["count_complete"] >= MIN_SAMPLE].head(3)
    weak = oos[(oos["count_complete"] >= MIN_SAMPLE) & (oos["return_24h_probability"] < 0.55)]
    decision = [
        "# Galka Lab decision report",
        "",
        "## Most robust types on untouched final OOS",
        "",
        markdown_table(best, ["galka_type", "count_complete", "return_6h_probability", "return_24h_probability", "depth_success_p75", "depth_success_p95", "return_minutes_p50"]),
        "",
        "## Types that should not be promoted",
        "",
        markdown_table(weak, ["galka_type", "count_complete", "return_24h_probability", "depth_success_p90", "adverse_all_p95", "insufficient_data"]),
        "",
        "## Conditional-return cliffs",
        "",
        markdown_table(cliffs[cliffs.get("split", "") == "final_oos"] if not cliffs.empty else cliffs, ["symbol", "interval", "galka_type", "window", "cliff_depth_pct", "probability_before", "probability_after", "probability_drop", "insufficient_data"], 40),
        "",
        "## Grid profiles",
        "",
        markdown_table(grid[grid.get("split", "") == "final_oos"] if not grid.empty else grid, ["galka_type", "profile", "count", "mean_net_return_pct", "median_net_return_pct", "win_rate", "cvar_95_pct", "paper_only"]),
        "",
        "## Stop trade-offs",
        "",
        markdown_table(stops[stops.get("split", "") == "final_oos"] if not stops.empty else stops, ["galka_type", "stop", "count", "mean_net_return_pct", "win_rate", "cvar_95_pct"]),
        "",
        "## Recent drift",
        "",
        markdown_table(recent, ["galka_type", "window", "count", "depth_p75", "historical_depth_p75", "depth_p75_delta", "return_24h_probability", "insufficient_data"], 50),
        "",
        "No profile in this report changes production paper defaults. Aggressive is paper-only; auto-paper remains disabled.",
    ]
    (output / "DECISION_REPORT.md").write_text("\n".join(decision) + "\n")

    limitations = """# Honest limitations

- Binance public OHLCV is not an order-book or queue-position record.
- One-minute execution replay uses a deterministic directional OHLC path; ticks inside a minute are unknown.
- Resting virtual limits fill at their level after the candle reaches it; spread and partial queue fills are omitted.
- Maker/taker fees and fixed slippage are modeled; funding, latency and liquidation-engine details are omitted.
- Right-side bars are used only to confirm a candidate; trading outcomes start strictly after confirmation.
- End-of-data outcomes are censored instead of counted as losses.
- Market regimes drift. Seven-day and rare-crisis samples can be too small for stable conclusions.
- Clustering is descriptive. Human names do not prove causality or persistence.
- Multiple grid/stop/trailing comparisons create multiple-testing risk; failed variants remain in outputs.
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
    ]
    (output / "MODEL_CARD.md").write_text("\n".join(model_card) + "\n")

    write_json(output / "run_metadata.json", run_metadata)
    write_json(output / "model.json", model)
    write_json(output / "evaluation.json", json_safe(evaluation))
    write_json(output / "type_summary.json", json_safe(type_summary.to_dict(orient="records")))
    for name, frame in statistics.items():
        write_json(output / f"statistics_{name}.json", json_safe(frame.to_dict(orient="records")))
