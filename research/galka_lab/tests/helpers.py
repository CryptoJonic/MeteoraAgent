from __future__ import annotations

import numpy as np
import pandas as pd

from galka_lab.config import CLUSTER_FEATURES, DEPTH_THRESHOLDS_PCT, HORIZON_HOURS


def feature_rows(count: int = 480) -> pd.DataFrame:
    rng = np.random.default_rng(20260712)
    rows = []
    for index in range(count):
        cluster = index % 4
        center = np.zeros(len(CLUSTER_FEATURES))
        center[cluster * 4 : cluster * 4 + 4] = 3.5
        values = center + rng.normal(0, 0.18, len(CLUSTER_FEATURES))
        row = dict(zip(CLUSTER_FEATURES, values))
        row.update(
            {
                "candidate_id": f"C{index:05d}",
                "symbol": ("BTCUSDT", "ETHUSDT", "SOLUSDT")[index % 3],
                "interval": ("5m", "15m")[index % 2],
                "confirmation_time": pd.Timestamp("2020-01-01", tz="UTC") + pd.Timedelta(hours=index),
                "activation_time": pd.Timestamp("2020-01-01", tz="UTC") + pd.Timedelta(hours=index, minutes=5),
                "split": "train" if index < 300 else "validation" if index < 400 else "final_oos",
                "activated": True,
                "activation_censored": False,
                "returned": index % 5 != 0,
                "outcome_censored": False,
                "mae_pct": 0.2 + cluster * 0.45 + (index % 7) * 0.03,
                "return_minutes": 30 + cluster * 90 + index % 60,
                "mfe_after_return_pct": 0.4 + cluster * 0.2,
                "mfe_after_reclaim_pct": 0.3 + cluster * 0.2,
                "time_under_level_minutes": 20 + cluster * 30,
                "available_minutes": 20_160,
                "atr_pct": max(0.2, abs(row["atr_pct"])),
                "regime": ("uptrend", "range", "downtrend")[index % 3],
                "volatility_regime": ("low", "normal", "high")[index % 3],
                "trail_075_exit_pct": 0.5 if index % 5 != 0 else -1.8,
                "trail_075_minutes": 180.0,
                "close_12h_pct": 0.1 if index % 5 != 0 else -0.8,
                "close_24h_pct": 0.2 if index % 5 != 0 else -1.2,
                "close_48h_pct": 0.3 if index % 5 != 0 else -1.4,
            }
        )
        for hours in HORIZON_HOURS:
            row[f"return_{hours}h"] = bool(row["returned"] and row["return_minutes"] <= hours * 60)
        for depth in DEPTH_THRESHOLDS_PCT:
            suffix = str(depth).replace(".", "_")
            reached = row["mae_pct"] >= depth
            row[f"depth_{suffix}_reached"] = reached
            row[f"depth_{suffix}_minutes"] = depth * 60 if reached else np.nan
        for buffer in (0.00, 0.10, 0.20):
            for distance in (0.15, 0.30, 0.50, 0.75, 1.00):
                key = f"reclaim_{int(round(buffer * 100)):03d}_trail_{int(round(distance * 100)):03d}"
                row[f"{key}_exit_pct"] = row["trail_075_exit_pct"] + (distance - 0.75) * 0.1
                row[f"{key}_minutes"] = 180.0
        for kind in ("atr", "swing"):
            row[f"reclaim_010_trail_{kind}_exit_pct"] = row["trail_075_exit_pct"]
            row[f"reclaim_010_trail_{kind}_minutes"] = 180.0
        rows.append(row)
    return pd.DataFrame(rows)
