from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import (
    DEPTH_THRESHOLDS_PCT,
    HORIZON_HOURS,
    MAX_ACTIVATION_HOURS,
    MAX_OUTCOME_HOURS,
    POST_RECLAIM_HOURS,
    RECLAIM_BUFFER_PCT,
    RECLAIM_BUFFERS_PCT,
    TRAIL_DISTANCES_PCT,
)
from .utils import iso_utc


def candle_path(open_: float, high: float, low: float, close: float) -> tuple[float, ...]:
    return (open_, low, high, close) if close >= open_ else (open_, high, low, close)


def _first_position(values: tuple[float, ...], predicate, start: int = 0) -> int | None:
    for index in range(start, len(values)):
        if predicate(values[index]):
            return index
    return None


@dataclass(frozen=True)
class Hit:
    index: int
    position: int


class RangeExtremaIndex:
    """Left-most threshold queries in O(log n), shared by all candidate outcomes."""

    def __init__(self, low: np.ndarray, high: np.ndarray):
        size = 1
        while size < len(low):
            size *= 2
        self.size = size
        self.minimum = np.full(2 * size, np.inf, dtype=float)
        self.maximum = np.full(2 * size, -np.inf, dtype=float)
        self.minimum[size : size + len(low)] = low
        self.maximum[size : size + len(high)] = high
        for index in range(size - 1, 0, -1):
            self.minimum[index] = min(self.minimum[index * 2], self.minimum[index * 2 + 1])
            self.maximum[index] = max(self.maximum[index * 2], self.maximum[index * 2 + 1])

    def _nodes(self, start: int, end: int) -> list[int]:
        if start >= end:
            return []
        left = start + self.size
        right = end + self.size
        left_nodes: list[int] = []
        right_nodes: list[int] = []
        while left < right:
            if left & 1:
                left_nodes.append(left);left += 1
            if right & 1:
                right -= 1;right_nodes.append(right)
            left //= 2;right //= 2
        return left_nodes + list(reversed(right_nodes))

    def first_low_below(self, start: int, end: int, threshold: float, inclusive=False) -> int | None:
        matches = (lambda value: value <= threshold) if inclusive else (lambda value: value < threshold)
        for node in self._nodes(start, end):
            if not matches(self.minimum[node]):
                continue
            while node < self.size:
                left = node * 2
                node = left if matches(self.minimum[left]) else left + 1
            return node - self.size
        return None

    def first_high_at_or_above(self, start: int, end: int, threshold: float) -> int | None:
        for node in self._nodes(start, end):
            if self.maximum[node] < threshold:
                continue
            while node < self.size:
                left = node * 2
                node = left if self.maximum[left] >= threshold else left + 1
            return node - self.size
        return None


def _target_after(
    open_: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    start: Hit,
    end_index: int,
    target: float,
    extrema: RangeExtremaIndex,
) -> Hit | None:
    first_path = candle_path(open_[start.index], high[start.index], low[start.index], close[start.index])
    same_position = _first_position(first_path, lambda value: value >= target, start.position + 1)
    if same_position is not None:
        return Hit(start.index, same_position)
    cursor = start.index + 1
    while cursor <= end_index:
        index = extrema.first_high_at_or_above(cursor, end_index + 1, target)
        if index is None:
            break
        path = candle_path(open_[index], high[index], low[index], close[index])
        position = _first_position(path, lambda value: value >= target)
        if position is not None:
            return Hit(index, position)
        cursor = index + 1
    return None


def _depth_before_return(
    open_: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    activation: Hit,
    returned: Hit | None,
    end_index: int,
    target: float,
    extrema: RangeExtremaIndex,
) -> Hit | None:
    """Find a depth hit in event order, never after the first return to level."""
    activation_path = candle_path(
        open_[activation.index], high[activation.index], low[activation.index], close[activation.index]
    )
    first_end = returned.position if returned and returned.index == activation.index else 3
    first_position = _first_position(
        activation_path[: first_end + 1], lambda value: value <= target, activation.position
    )
    if first_position is not None:
        return Hit(activation.index, first_position)
    if returned and returned.index == activation.index:
        return None

    full_end = returned.index if returned else end_index + 1
    cursor = activation.index + 1
    while cursor < full_end:
        index = extrema.first_low_below(cursor, full_end, target, inclusive=True)
        if index is None:
            break
        path = candle_path(open_[index], high[index], low[index], close[index])
        position = _first_position(path, lambda value: value <= target)
        if position is not None:
            return Hit(index, position)
        cursor = index + 1

    if returned and returned.index > activation.index:
        return_path = candle_path(
            open_[returned.index], high[returned.index], low[returned.index], close[returned.index]
        )
        position = _first_position(
            return_path[: returned.position + 1], lambda value: value <= target
        )
        if position is not None:
            return Hit(returned.index, position)
    return None


def _point_minutes(times_ms: np.ndarray, hit: Hit, origin_ms: int, interval_ms: int) -> float:
    point_ms = int(times_ms[hit.index]) + round(interval_ms * hit.position / 4)
    return max(0.0, (point_ms - origin_ms) / 60_000)


def _minimum_before_return(
    open_: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    activation: Hit,
    returned: Hit | None,
    end_index: int,
) -> tuple[float, Hit]:
    activation_path = candle_path(
        open_[activation.index], high[activation.index], low[activation.index], close[activation.index]
    )
    activation_end = returned.position if returned and returned.index == activation.index else 3
    segment = activation_path[activation.position : activation_end + 1]
    relative = int(np.argmin(segment))
    best_price = float(segment[relative])
    best_hit = Hit(activation.index, activation.position + relative)
    final_index = returned.index if returned else end_index
    middle_start = activation.index + 1
    middle_end = final_index if returned else final_index + 1
    if middle_end > middle_start:
        middle = low[middle_start:middle_end]
        offset = int(np.argmin(middle))
        if middle[offset] < best_price:
            best_price = float(middle[offset])
            best_hit = Hit(middle_start + offset, 1 if close[middle_start + offset] >= open_[middle_start + offset] else 2)
    if returned and returned.index > activation.index:
        return_path = candle_path(
            open_[returned.index], high[returned.index], low[returned.index], close[returned.index]
        )
        prefix = return_path[: returned.position + 1]
        position = int(np.argmin(prefix))
        if prefix[position] < best_price:
            best_price = float(prefix[position])
            best_hit = Hit(returned.index, position)
    return best_price, best_hit


def _simulate_trails(
    open_: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    times_ms: np.ndarray,
    activation: Hit,
    level: float,
    interval_ms: int,
    atr_pct: float,
) -> dict:
    distances = tuple(float(value) for value in TRAIL_DISTANCES_PCT)
    strategies = [
        {
            "key": f"reclaim_{int(round(buffer * 100)):03d}_trail_{int(round(distance * 100)):03d}",
            "buffer": float(buffer),
            "distance": float(distance),
            "kind": "fixed",
        }
        for buffer in RECLAIM_BUFFERS_PCT
        for distance in distances
    ]
    strategies.extend(
        (
            {
                "key": "reclaim_010_trail_atr",
                "buffer": RECLAIM_BUFFER_PCT,
                "distance": float(np.clip(1.5 * atr_pct, 0.15, 2.0)),
                "kind": "atr",
            },
            {
                "key": "reclaim_010_trail_swing",
                "buffer": RECLAIM_BUFFER_PCT,
                "distance": None,
                "kind": "swing",
            },
        )
    )
    state = {
        strategy["key"]: {
            **strategy,
            "armed": False,
            "armed_ms": None,
            "high": None,
            "stop": None,
            "exit": None,
            "exit_ms": None,
            "reason": None,
            "deadline": int(times_ms[activation.index]) + 72 * 3_600_000,
        }
        for strategy in strategies
    }
    maximum_ms = min(
        int(times_ms[-1]), int(times_ms[activation.index]) + 2 * 72 * 3_600_000
    )
    for index in range(activation.index, len(times_ms)):
        if times_ms[index] > maximum_ms or all(item["exit"] is not None for item in state.values()):
            break
        path = candle_path(open_[index], high[index], low[index], close[index])
        start_position = activation.position if index == activation.index else 0
        swing_pivot = index - 3
        if swing_pivot >= activation.index + 2:
            pivot_low = float(low[swing_pivot])
            confirmed_swing = pivot_low <= float(
                np.min(low[swing_pivot - 2 : swing_pivot + 3])
            )
            for item in state.values():
                if (
                    confirmed_swing
                    and item["kind"] == "swing"
                    and item["armed"]
                    and item["exit"] is None
                ):
                    item["stop"] = max(
                        item["stop"], level, pivot_low * (1 - 0.05 / 100)
                    )
        for position in range(start_position, len(path)):
            point_ms = int(times_ms[index]) + round(interval_ms * position / 4)
            price = path[position]
            for item in state.values():
                if item["exit"] is not None:
                    continue
                reclaim = level * (1 + item["buffer"] / 100)
                if not item["armed"] and price >= reclaim:
                    item["armed"] = True
                    item["armed_ms"] = point_ms
                    item["high"] = price
                    item["stop"] = level
                    item["deadline"] = point_ms + 72 * 3_600_000
                    continue
                if item["armed"]:
                    if price > item["high"]:
                        item["high"] = price
                        if item["kind"] != "swing":
                            item["stop"] = max(
                                level, price * (1 - item["distance"] / 100)
                            )
                    if price <= item["stop"]:
                        item["exit"] = item["stop"]
                        item["exit_ms"] = point_ms
                        item["reason"] = "trail_stop"
                        continue
                if point_ms >= item["deadline"]:
                    item["exit"] = price
                    item["exit_ms"] = point_ms
                    item["reason"] = "time_exit"
    output = {}
    origin_ms = int(times_ms[activation.index])
    for key, item in state.items():
        output[f"{key}_armed"] = bool(item["armed"])
        output[f"{key}_exit_pct"] = (
            (item["exit"] / level - 1) * 100 if item["exit"] is not None else np.nan
        )
        output[f"{key}_minutes"] = (
            (item["exit_ms"] - origin_ms) / 60_000 if item["exit_ms"] is not None else np.nan
        )
        output[f"{key}_reason"] = item["reason"] or "data_end"
        output[f"{key}_high_pct"] = (
            (item["high"] / level - 1) * 100 if item["high"] is not None else np.nan
        )
        if item["kind"] == "atr":
            output[f"{key}_distance_pct"] = item["distance"]
    for distance in distances:
        source = f"reclaim_010_trail_{int(round(distance * 100)):03d}"
        alias = f"trail_{int(round(distance * 100)):03d}"
        for suffix in ("armed", "exit_pct", "minutes", "reason", "high_pct"):
            output[f"{alias}_{suffix}"] = output[f"{source}_{suffix}"]
    for kind in ("atr", "swing"):
        source = f"reclaim_010_trail_{kind}"
        alias = f"trail_{kind}"
        for suffix in ("armed", "exit_pct", "minutes", "reason", "high_pct"):
            output[f"{alias}_{suffix}"] = output[f"{source}_{suffix}"]
    output["trail_atr_distance_pct"] = output["reclaim_010_trail_atr_distance_pct"]
    return output


def label_outcomes(
    candidates: pd.DataFrame,
    execution: pd.DataFrame,
    *,
    max_activation_hours: int = MAX_ACTIVATION_HOURS,
    max_outcome_hours: int = MAX_OUTCOME_HOURS,
) -> pd.DataFrame:
    if candidates.empty:
        return candidates.copy()
    frame = execution.sort_values("time").drop_duplicates("time").reset_index(drop=True)
    times = pd.to_datetime(frame["time"], utc=True)
    times_ms = times.astype("int64").to_numpy() // 1_000_000
    open_ = frame["open"].to_numpy(float)
    high = frame["high"].to_numpy(float)
    low = frame["low"].to_numpy(float)
    close = frame["close"].to_numpy(float)
    if len(times_ms) < 2:
        raise ValueError("execution history is too short")
    interval_ms = int(np.median(np.diff(times_ms)))
    extrema = RangeExtremaIndex(low, high)
    output: list[dict] = []

    for candidate in candidates.itertuples(index=False):
        confirmation_ms = int(pd.Timestamp(candidate.confirmation_time).timestamp() * 1_000)
        search_start = int(np.searchsorted(times_ms, confirmation_ms, side="right"))
        activation_limit_ms = confirmation_ms + max_activation_hours * 3_600_000
        search_end = int(np.searchsorted(times_ms, activation_limit_ms, side="right"))
        activation_index = extrema.first_low_below(search_start, search_end, candidate.level)
        base = {
            "candidate_id": candidate.candidate_id,
            "activated": False,
            "activation_time": pd.NaT,
            "activation_censored": bool(times_ms[-1] < activation_limit_ms),
            "observation_end_time": pd.Timestamp(
                min(int(times_ms[-1]), activation_limit_ms), unit="ms", tz="UTC"
            ),
            "intrabar_policy": "directional_ohlc_adverse_first_from_activation",
        }
        if activation_index is None:
            output.append(base)
            continue
        activation_path = candle_path(
            open_[activation_index], high[activation_index], low[activation_index], close[activation_index]
        )
        activation_position = _first_position(activation_path, lambda value: value < candidate.level)
        if activation_position is None:
            output.append(base)
            continue
        activation = Hit(activation_index, activation_position)
        activation_ms = int(times_ms[activation_index]) + round(interval_ms * activation.position / 4)
        outcome_limit_ms = activation_ms + max_outcome_hours * 3_600_000
        outcome_end = min(len(times_ms) - 1, int(np.searchsorted(times_ms, outcome_limit_ms, side="right")) - 1)
        outcome_end = max(activation_index, outcome_end)
        returned = _target_after(open_, high, low, close, activation, outcome_end, candidate.level, extrema)
        reclaim_level = candidate.level * (1 + RECLAIM_BUFFER_PCT / 100)
        reclaimed = _target_after(open_, high, low, close, activation, outcome_end, reclaim_level, extrema)
        minimum, minimum_hit = _minimum_before_return(
            open_, high, low, close, activation, returned, outcome_end
        )
        depth_pct = max(0.0, (candidate.level - minimum) / candidate.level * 100)
        available_minutes = max(0.0, (times_ms[-1] - activation_ms) / 60_000)
        return_minutes = (
            _point_minutes(times_ms, returned, activation_ms, interval_ms) if returned else np.nan
        )
        reclaim_minutes = (
            _point_minutes(times_ms, reclaimed, activation_ms, interval_ms) if reclaimed else np.nan
        )
        returned_ms = (
            int(times_ms[returned.index]) + round(interval_ms * returned.position / 4)
            if returned
            else None
        )
        reclaimed_ms = (
            int(times_ms[reclaimed.index]) + round(interval_ms * reclaimed.position / 4)
            if reclaimed
            else None
        )
        if returned_ms is None:
            observation_used_ms = outcome_limit_ms
        else:
            observation_used_ms = max(
                activation_ms + 2 * 72 * 3_600_000,
                returned_ms + POST_RECLAIM_HOURS * 3_600_000,
                (reclaimed_ms + POST_RECLAIM_HOURS * 3_600_000)
                if reclaimed_ms is not None
                else returned_ms,
            )
        observation_used_ms = min(int(times_ms[-1]), observation_used_ms)
        row = {
            **base,
            "activated": True,
            "activation_time": pd.Timestamp(activation_ms, unit="ms", tz="UTC"),
            "activation_index_1m": activation_index,
            "returned": bool(returned),
            "return_time": (
                pd.Timestamp(
                    returned_ms,
                    unit="ms",
                    tz="UTC",
                )
                if returned
                else pd.NaT
            ),
            "return_minutes": return_minutes,
            "reclaimed": bool(reclaimed),
            "reclaim_time": (
                pd.Timestamp(
                    reclaimed_ms,
                    unit="ms",
                    tz="UTC",
                )
                if reclaimed
                else pd.NaT
            ),
            "reclaim_minutes": reclaim_minutes,
            "mae_pct": depth_pct,
            "time_to_mae_minutes": _point_minutes(
                times_ms, minimum_hit, activation_ms, interval_ms
            ),
            "time_under_level_minutes": float(
                (close[activation_index : (returned.index + 1 if returned else outcome_end + 1)] < candidate.level).sum()
                * interval_ms
                / 60_000
            ),
            "outcome_censored": bool(not returned and times_ms[-1] < outcome_limit_ms),
            "outcome_end_time": pd.Timestamp(times_ms[outcome_end], unit="ms", tz="UTC"),
            "observation_end_time": pd.Timestamp(
                observation_used_ms, unit="ms", tz="UTC"
            ),
            "available_minutes": available_minutes,
            "target_exit_pct": 0.0 if returned else np.nan,
        }
        for hours in HORIZON_HOURS:
            key = f"return_{hours}h"
            if returned:
                row[key] = bool(return_minutes <= hours * 60)
            elif available_minutes >= hours * 60:
                row[key] = False
            else:
                row[key] = None
        for threshold in DEPTH_THRESHOLDS_PCT:
            suffix = str(threshold).replace(".", "_")
            target = candidate.level * (1 - threshold / 100)
            depth_hit = _depth_before_return(
                open_, high, low, close, activation, returned, outcome_end, target, extrema
            )
            reached = depth_hit is not None
            row[f"depth_{suffix}_reached"] = reached
            row[f"depth_{suffix}_minutes"] = (
                _point_minutes(times_ms, depth_hit, activation_ms, interval_ms)
                if reached
                else np.nan
            )
        for hours in (1, 3, 6, 12, 24, 48):
            target_ms = activation_ms + hours * 3_600_000
            index = min(len(close) - 1, int(np.searchsorted(times_ms, target_ms, side="right")) - 1)
            row[f"close_{hours}h_pct"] = (
                (close[index] / candidate.level - 1) * 100 if index >= activation_index else np.nan
            )
        if returned:
            post_end_ms = int(times_ms[returned.index]) + POST_RECLAIM_HOURS * 3_600_000
            post_end = min(len(high), int(np.searchsorted(times_ms, post_end_ms, side="right")))
            post_high = float(np.max(high[returned.index:post_end]))
            post_low = float(np.min(low[returned.index:post_end]))
            row["mfe_after_return_pct"] = (post_high / candidate.level - 1) * 100
            row["drawdown_after_return_pct"] = (candidate.level - post_low) / candidate.level * 100
        else:
            row["mfe_after_return_pct"] = np.nan
            row["drawdown_after_return_pct"] = np.nan
        if reclaimed:
            post_end_ms = int(times_ms[reclaimed.index]) + POST_RECLAIM_HOURS * 3_600_000
            post_end = min(len(high), int(np.searchsorted(times_ms, post_end_ms, side="right")))
            row["mfe_after_reclaim_pct"] = (
                float(np.max(high[reclaimed.index:post_end])) / candidate.level - 1
            ) * 100
            row["drawdown_after_reclaim_pct"] = (
                reclaim_level - float(np.min(low[reclaimed.index:post_end]))
            ) / reclaim_level * 100
        else:
            row["mfe_after_reclaim_pct"] = np.nan
            row["drawdown_after_reclaim_pct"] = np.nan
        row.update(
            _simulate_trails(
                open_,
                high,
                low,
                close,
                times_ms,
                activation,
                candidate.level,
                interval_ms,
                float(getattr(candidate, "atr_pct", 0.50)),
            )
        )
        output.append(row)

    outcomes = pd.DataFrame(output)
    result = candidates.merge(outcomes, on="candidate_id", how="left", validate="one_to_one")
    for column in (
        "activation_time",
        "return_time",
        "reclaim_time",
        "outcome_end_time",
        "observation_end_time",
    ):
        if column in result:
            result[column] = pd.to_datetime(result[column], utc=True)
    result["activation_time_iso"] = result["activation_time"].map(
        lambda value: iso_utc(value) if pd.notna(value) else None
    )
    result["return_time_iso"] = result["return_time"].map(
        lambda value: iso_utc(value) if pd.notna(value) else None
    )
    return result
