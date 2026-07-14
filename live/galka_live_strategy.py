from __future__ import annotations

from dataclasses import dataclass, asdict
from decimal import Decimal, ROUND_DOWN
from math import floor, log10
from typing import Iterable

MANUAL_DEPTHS = (0.15, 0.30, 0.45, 0.60, 0.90, 1.20, 1.50, 2.00)
MANUAL_WEIGHTS = (0.42, 0.22, 0.12, 0.08, 0.06, 0.04, 0.03, 0.03)
MIN_ORDER_NOTIONAL = Decimal("10")


@dataclass(frozen=True)
class LadderLevel:
    index: int
    depth_pct: float
    weight: float
    price: float
    size: float
    notional: float

    def to_dict(self) -> dict:
        return asdict(self)


def _decimal(value: float | str | Decimal) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def round_perp_price(price: float, sz_decimals: int) -> float:
    """Round to Hyperliquid perp price constraints.

    Perp prices allow at most five significant figures and no more than
    6 - szDecimals decimal places. Integer prices are always allowed.
    """
    if price <= 0:
        raise ValueError("price must be positive")
    allowed_decimals = max(0, 6 - int(sz_decimals))
    magnitude = floor(log10(abs(price)))
    significant_decimals = 5 - magnitude - 1
    decimals = max(0, min(allowed_decimals, significant_decimals))
    quantum = Decimal("1").scaleb(-decimals)
    return float(_decimal(price).quantize(quantum))


def round_size_down(size: float, sz_decimals: int) -> float:
    if size <= 0:
        raise ValueError("size must be positive")
    quantum = Decimal("1").scaleb(-int(sz_decimals))
    rounded = _decimal(size).quantize(quantum, rounding=ROUND_DOWN)
    if rounded <= 0:
        raise ValueError("size rounds to zero")
    return float(rounded)


def build_ladder(galka_price: float, total_notional: float, sz_decimals: int) -> list[LadderLevel]:
    if galka_price <= 0:
        raise ValueError("GALKA price must be positive")
    if total_notional <= 0:
        raise ValueError("total notional must be positive")
    if len(MANUAL_DEPTHS) != len(MANUAL_WEIGHTS):
        raise RuntimeError("manual ladder configuration mismatch")
    if abs(sum(MANUAL_WEIGHTS) - 1.0) > 1e-9:
        raise RuntimeError("manual ladder weights must sum to one")

    levels: list[LadderLevel] = []
    for index, (depth_pct, weight) in enumerate(zip(MANUAL_DEPTHS, MANUAL_WEIGHTS), start=1):
        raw_price = galka_price * (1 - depth_pct / 100)
        price = round_perp_price(raw_price, sz_decimals)
        requested_notional = total_notional * weight
        size = round_size_down(requested_notional / price, sz_decimals)
        actual_notional = price * size
        if _decimal(actual_notional) < MIN_ORDER_NOTIONAL:
            raise ValueError(
                f"L{index} notional {actual_notional:.4f} is below Hyperliquid minimum $10; "
                "increase total notional or change the ladder"
            )
        levels.append(
            LadderLevel(
                index=index,
                depth_pct=depth_pct,
                weight=weight,
                price=price,
                size=size,
                notional=actual_notional,
            )
        )
    return levels


def weighted_average(levels: Iterable[LadderLevel]) -> float:
    rows = list(levels)
    total_size = sum(level.size for level in rows)
    if not total_size:
        return 0.0
    return sum(level.price * level.size for level in rows) / total_size


def estimated_target_pnl(levels: Iterable[LadderLevel], galka_price: float, maker_fee: float) -> float:
    rows = list(levels)
    qty = sum(level.size for level in rows)
    entry_notional = sum(level.price * level.size for level in rows)
    exit_notional = galka_price * qty
    gross = exit_notional - entry_notional
    fees = entry_notional * maker_fee + exit_notional * maker_fee
    return gross - fees
