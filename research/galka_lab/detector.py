from __future__ import annotations

import numpy as np
import pandas as pd

from .config import CANDIDATE, INTERVAL_MS
from .utils import iso_utc


def _finite(value, fallback=0.0):
    return float(value) if np.isfinite(value) else fallback


def extract_candidates(
    frame: pd.DataFrame,
    symbol: str,
    interval: str,
    config: dict | None = None,
) -> pd.DataFrame:
    """High-recall local-low detector; outcomes are deliberately absent."""
    cfg = {**CANDIDATE, **(config or {})}
    left = int(cfg["left_bars"])
    right = int(cfg["right_bars"])
    context_bars = int(cfg["context_bars"])
    minimum_index = max(left, 50)
    if len(frame) <= minimum_index + right:
        return pd.DataFrame()

    low = frame["low"].to_numpy(float)
    high = frame["high"].to_numpy(float)
    open_ = frame["open"].to_numpy(float)
    close = frame["close"].to_numpy(float)
    volume = frame["volume"].to_numpy(float)
    atr = frame["atr"].to_numpy(float)
    time = pd.to_datetime(frame["time"], utc=True)
    time_ms = time.astype("int64").to_numpy() // 1_000_000
    discontinuities = np.diff(time_ms) != INTERVAL_MS[interval]
    candidates: list[dict] = []

    for pivot in range(minimum_index, len(frame) - right):
        if not np.isfinite(atr[pivot]) or atr[pivot] <= 0:
            continue
        window_low = np.nanmin(low[pivot - left : pivot + right + 1])
        tolerance = max(1e-12, abs(low[pivot]) * 1e-10)
        if low[pivot] > window_low + tolerance:
            continue
        left_slice = slice(pivot - left, pivot)
        right_slice = slice(pivot + 1, pivot + right + 1)
        left_high = float(np.nanmax(high[left_slice]))
        right_high = float(np.nanmax(high[right_slice]))
        drop = left_high - low[pivot]
        if drop < float(cfg["minimum_drop_atr"]) * atr[pivot]:
            continue
        recovery = (right_high - low[pivot]) / max(drop, 1e-12)
        if recovery < float(cfg["minimum_recovery_ratio"]):
            continue

        confirmation = pivot + right
        continuity_start = max(0, pivot - context_bars)
        if discontinuities[continuity_start:confirmation].any():
            continue
        left_high_offset = int(np.nanargmax(high[left_slice]))
        right_high_offset = int(np.nanargmax(high[right_slice]))
        left_bars = left - left_high_offset
        right_bars = right_high_offset + 1
        neighbour_low = min(low[pivot - 1], low[pivot + 1])
        near_band = low[pivot] + 0.25 * atr[pivot]
        shape_window = low[pivot - left : pivot + right + 1]
        near_count = int((shape_window <= near_band).sum())
        candle_range = max(high[pivot] - low[pivot], 1e-12)
        lower_wick = max(0.0, min(open_[pivot], close[pivot]) - low[pivot])
        body = abs(close[pivot] - open_[pivot])
        second_tests = int(
            (low[pivot + 1 : pivot + right + 1] <= low[pivot] + 0.15 * atr[pivot]).sum()
        )
        past_start = max(0, pivot - context_bars)
        past_low = low[past_start:pivot]
        touch_band = 0.15 * atr[pivot]
        touches = np.flatnonzero(np.abs(past_low - low[pivot]) <= touch_band)
        prior_touches = int(len(touches))
        level_age = int(pivot - (past_start + touches[0])) if len(touches) else 0
        row = frame.iloc[confirmation]
        pivot_time = time.iloc[pivot]
        confirmation_time = time.iloc[confirmation]
        event_epoch = int(pivot_time.timestamp())
        candidate_id = f"G-{symbol}-{interval}-{event_epoch}"
        candidate_record = {
                "candidate_id": candidate_id,
                "event_family_id": candidate_id,
                "symbol": symbol,
                "interval": interval,
                "pivot_index": pivot,
                "confirmation_index": confirmation,
                "pivot_time": pivot_time,
                "confirmation_time": confirmation_time,
                "level": float(low[pivot]),
                "atr": float(atr[pivot]),
                "drop_pct": float(drop / left_high * 100),
                "drop_atr": float(drop / atr[pivot]),
                "recovery_ratio": float(recovery),
                "left_shoulder_bars": left_bars,
                "right_shoulder_bars": right_bars,
                "shoulder_balance": float(min(left_bars, right_bars) / max(left_bars, right_bars)),
                "fall_speed_atr": float(drop / atr[pivot] / max(left_bars, 1)),
                "recovery_speed_atr": float((right_high - low[pivot]) / atr[pivot] / max(right_bars, 1)),
                "sharpness_atr": float(max(0.0, neighbour_low - low[pivot]) / atr[pivot]),
                "base_width_bars": near_count,
                "near_low_bars": near_count,
                "one_candle_pivot": near_count <= 2,
                "wick_ratio": float(lower_wick / candle_range),
                "body_ratio": float(body / candle_range),
                "close_lift_atr": float(max(0.0, close[pivot] - low[pivot]) / atr[pivot]),
                "second_tests": second_tests,
                "prior_touches": prior_touches,
                "level_age_bars": level_age,
                "consumed_score": float(min(1.0, prior_touches / 5)),
                "atr_pct": _finite(row.get("atr_pct")),
                "volume_ratio": _finite(row.get("volume_ratio"), 1.0),
                "volume_spike": _finite(row.get("volume_ratio"), 1.0) >= 2.0,
                "trend_slope_atr": _finite(row.get("trend_slope_atr")),
                "ema_distance_atr": _finite(row.get("ema_distance_atr")),
                "vwap_distance_atr": _finite(row.get("vwap_distance_atr")),
                "distance_from_high_atr": _finite(row.get("distance_from_high_atr")),
                "prior_return_1h": _finite(row.get("ret_1h")),
                "prior_return_6h": _finite(row.get("ret_6h")),
                "prior_return_24h": _finite(row.get("ret_24h")),
                "volatility_percentile": _finite(row.get("volatility_percentile"), 0.5),
                "regime": str(row.get("regime", "range")),
                "volatility_regime": str(row.get("volatility_regime", "normal")),
                "hour_utc": int(confirmation_time.hour),
                "weekday_utc": int(confirmation_time.weekday()),
                "detector_left_bars": left,
                "detector_right_bars": right,
                "feature_cutoff_time": confirmation_time,
                "lookahead_bars": right,
        }
        for offset in range(-left, right + 1):
            side = "m" if offset < 0 else "p"
            candidate_record[f"shape_{side}{abs(offset):02d}"] = float(
                (close[pivot + offset] / low[pivot] - 1) * 100
            )
        candidates.append(candidate_record)

    if not candidates:
        return pd.DataFrame()
    result = pd.DataFrame(candidates).sort_values("pivot_index").reset_index(drop=True)
    family_number = 0
    previous = None
    for index, candidate in result.iterrows():
        same_family = False
        if previous is not None:
            same_family = (
                candidate["pivot_index"] - previous["pivot_index"] <= int(cfg["family_bars"])
                and abs(candidate["level"] - previous["level"])
                <= float(cfg["family_price_atr"]) * candidate["atr"]
            )
        if not same_family:
            family_number += 1
        family_id = f"GF-{symbol}-{interval}-{family_number:07d}"
        result.at[index, "event_family_id"] = family_id
        previous = candidate
    result["pivot_time"] = pd.to_datetime(result["pivot_time"], utc=True)
    result["confirmation_time"] = pd.to_datetime(result["confirmation_time"], utc=True)
    result["feature_cutoff_time"] = pd.to_datetime(result["feature_cutoff_time"], utc=True)
    result["pivot_time_iso"] = result["pivot_time"].map(iso_utc)
    result["confirmation_time_iso"] = result["confirmation_time"].map(iso_utc)
    return result
