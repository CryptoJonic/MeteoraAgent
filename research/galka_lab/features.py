from __future__ import annotations

import numpy as np
import pandas as pd

from .config import INTERVAL_MS


def _periods(interval: str, hours: float) -> int:
    return max(1, round(hours * 3_600_000 / INTERVAL_MS[interval]))


def build_market_features(frame: pd.DataFrame, interval: str) -> pd.DataFrame:
    """Build only backward-looking market context columns."""
    if interval not in INTERVAL_MS:
        raise ValueError(f"unsupported interval {interval}")
    result = frame.copy()
    previous_close = result["close"].shift()
    true_range = pd.concat(
        (
            result["high"] - result["low"],
            (result["high"] - previous_close).abs(),
            (result["low"] - previous_close).abs(),
        ),
        axis=1,
    ).max(axis=1)
    result["atr"] = true_range.rolling(14, min_periods=14).mean()
    result["atr_pct"] = result["atr"] / result["close"] * 100
    result["ema20"] = result["close"].ewm(span=20, adjust=False, min_periods=20).mean()
    result["ema50"] = result["close"].ewm(span=50, adjust=False, min_periods=50).mean()
    typical = (result["high"] + result["low"] + result["close"]) / 3
    rolling_volume = result["volume"].rolling(_periods(interval, 24), min_periods=10).sum()
    result["vwap24h"] = (typical * result["volume"]).rolling(
        _periods(interval, 24), min_periods=10
    ).sum() / rolling_volume.replace(0, np.nan)
    result["volume_ratio"] = result["volume"] / result["volume"].shift().rolling(
        20, min_periods=10
    ).median()
    result["ret_1h"] = result["close"].pct_change(_periods(interval, 1))
    result["ret_6h"] = result["close"].pct_change(_periods(interval, 6))
    result["ret_24h"] = result["close"].pct_change(_periods(interval, 24))
    slope_bars = _periods(interval, 3)
    result["trend_slope_atr"] = (
        (result["ema20"] - result["ema20"].shift(slope_bars))
        / result["atr"].replace(0, np.nan)
        / slope_bars
    )
    volatility_window = _periods(interval, 14 * 24)
    result["volatility_percentile"] = result["atr_pct"].rolling(
        volatility_window, min_periods=max(50, volatility_window // 5)
    ).rank(pct=True)
    result["ema_distance_atr"] = (result["close"] - result["ema20"]) / result["atr"]
    result["vwap_distance_atr"] = (result["close"] - result["vwap24h"]) / result["atr"]
    local_high = result["high"].shift().rolling(_periods(interval, 24), min_periods=10).max()
    result["distance_from_high_atr"] = (local_high - result["close"]) / result["atr"]
    result["regime"] = np.select(
        (
            result["trend_slope_atr"] > 0.025,
            result["trend_slope_atr"] < -0.025,
        ),
        ("uptrend", "downtrend"),
        default="range",
    )
    result["volatility_regime"] = np.select(
        (
            result["volatility_percentile"] >= 0.80,
            result["volatility_percentile"] <= 0.20,
        ),
        ("high", "low"),
        default="normal",
    )
    return result


def enrich_cross_asset(candidates: pd.DataFrame, contexts: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Attach same-time public market context without looking beyond confirmation time."""
    if candidates.empty:
        return candidates.copy()
    output = candidates.copy().sort_values("confirmation_time")
    market_columns: list[str] = []
    for symbol, context in sorted(contexts.items()):
        right = context[["time", "ret_1h", "ret_24h", "atr_pct"]].copy().sort_values("time")
        names = {
            "time": "market_time",
            "ret_1h": f"{symbol}_ret_1h",
            "ret_24h": f"{symbol}_ret_24h",
            "atr_pct": f"{symbol}_atr_pct",
        }
        right = right.rename(columns=names)
        output = pd.merge_asof(
            output.sort_values("confirmation_time"),
            right,
            left_on="confirmation_time",
            right_on="market_time",
            direction="backward",
            allow_exact_matches=True,
        ).drop(columns="market_time")
        market_columns.append(symbol)
    one_hour = [f"{symbol}_ret_1h" for symbol in market_columns]
    one_day = [f"{symbol}_ret_24h" for symbol in market_columns]
    output["market_return_1h"] = output[one_hour].mean(axis=1, skipna=True)
    output["market_return_24h"] = output[one_day].mean(axis=1, skipna=True)
    output["local_vs_market_1h"] = output["prior_return_1h"] - output["market_return_1h"]
    output["sync_selloff_count"] = (output[one_hour] < -0.005).sum(axis=1)
    output["market_selloff"] = output["market_return_1h"] < -0.0075
    return output.sort_values(["symbol", "interval", "confirmation_time", "candidate_id"]).reset_index(
        drop=True
    )
