from __future__ import annotations

import gzip
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import MODEL_VERSION, PACK_SCHEMA_VERSION
from .utils import canonical_json, sha256_bytes


def json_safe(value: Any):
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if value is pd.NaT or (value is not None and not isinstance(value, (str, bool)) and pd.isna(value)):
        return None
    return value


def records(frame: pd.DataFrame) -> list[dict]:
    return json_safe(frame.to_dict(orient="records"))


def compact_conditional(
    frame: pd.DataFrame, *, extra_dimensions: tuple[str, ...] = ()
) -> list[dict]:
    if frame.empty:
        return []
    selected = frame[
        (frame["split"] == "all") & frame["window"].isin(("all", "90d", "365d"))
    ]
    rows = []
    dimensions = ["symbol", "interval", "galka_type", *extra_dimensions, "window"]
    for keys, group in selected.groupby(dimensions, dropna=False, sort=True):
        depths = []
        for depth, depth_group in group.groupby("depth_pct", sort=True):
            horizons = []
            for item in depth_group.sort_values("horizon_hours_after_depth").itertuples(index=False):
                horizons.append(
                    [
                        int(item.horizon_hours_after_depth),
                        json_safe(item.return_probability),
                        json_safe(item.ci_low),
                        json_safe(item.ci_high),
                        int(item.observed_count),
                        bool(item.insufficient_data),
                    ]
                )
            depths.append([float(depth), horizons])
        identity = dict(zip(dimensions, keys))
        identity["type"] = identity.pop("galka_type")
        rows.append({**json_safe(identity), "depths": depths})
    return rows


def build_terminal_pack(
    *,
    statistics: dict[str, pd.DataFrame],
    model: dict,
    evaluation: dict,
    manifest: dict,
    generated_at: str,
) -> dict:
    payload = {
        "schemaVersion": PACK_SCHEMA_VERSION,
        "modelVersion": MODEL_VERSION,
        "generatedAt": generated_at,
        "data": {
            "start": manifest.get("start"),
            "end": manifest.get("end"),
            "symbols": manifest.get("symbols", []),
            "intervals": manifest.get("intervals", []),
            "manifestHash": manifest.get("manifest_hash"),
        },
        "model": json_safe(model),
        "profiles": json_safe(evaluation.get("profiles", {})),
        "stops": {
            "percentile": json_safe(evaluation.get("percentile_stops", {})),
            "probability": json_safe(evaluation.get("probability_stops", {})),
        },
        "statistics": {
            "global": records(statistics["global"][statistics["global"]["split"] == "all"]),
            "finalOos": records(statistics["global"][(statistics["global"]["split"] == "final_oos") & (statistics["global"]["window"] == "all")]),
            "conditional": compact_conditional(statistics["conditional"]),
            "conditionalRegime": compact_conditional(
                statistics["conditional_regime"],
                extra_dimensions=("regime", "volatility_regime"),
            ),
            "cliffs": records(statistics["cliffs"][(statistics["cliffs"]["split"] == "all") & statistics["cliffs"]["window"].isin(("all", "90d"))]),
            "regimes": records(statistics["regimes"][statistics["regimes"]["split"] == "all"]),
            "recent": records(statistics["recent"]),
            "recencyWeighted": records(statistics["recency_weighted"]),
            "histograms": records(statistics["histograms"]),
            "survival": records(statistics["survival"]),
            "shapeProfiles": records(statistics["shape_profiles"]),
            "examples": records(statistics["examples"]),
            "correlationStability": records(statistics["correlation_stability"]),
            "blockBootstrap": records(
                statistics.get("block_bootstrap", pd.DataFrame())
            ),
        },
        "gridComparison": json_safe([row for row in evaluation.get("grid_summary", []) if row.get("split") == "all"]),
        "stopComparison": json_safe([row for row in evaluation.get("stop_summary", []) if row.get("split") == "all"]),
        "exitComparison": json_safe([row for row in evaluation.get("trailing_summary", []) if row.get("split") == "all"]),
        "sizing": json_safe(evaluation.get("sizing", {})),
        "safety": {
            "paperOnly": True,
            "autoPaperDefault": False,
            "realOrders": False,
            "liveShadowRequiredBeforeAutoPaper": True,
            "historicalScreenIsNotAuthorization": True,
            "minimumSample": 40,
        },
    }
    canonical = canonical_json(payload).encode("utf-8")
    return {**payload, "checksum": f"sha256:{sha256_bytes(canonical)}"}


def verify_terminal_pack(pack: dict) -> bool:
    checksum = pack.get("checksum", "")
    payload = {key: value for key, value in pack.items() if key != "checksum"}
    expected = f"sha256:{sha256_bytes(canonical_json(payload).encode('utf-8'))}"
    return checksum == expected


def write_terminal_pack(path: Path, pack: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(pack, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    path.write_text(content)
    with gzip.open(path.with_suffix(path.suffix + ".gz"), "wt", encoding="utf-8", compresslevel=9) as stream:
        stream.write(content)
