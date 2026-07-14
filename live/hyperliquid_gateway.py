from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from .config import LiveConfig
from .live_ladder import LadderLevel, build_ladder, round_perp_price, round_size_down

try:
    import eth_account
    from hyperliquid.exchange import Exchange
    from hyperliquid.info import Info
    from hyperliquid.utils import constants
except ImportError as exc:  # pragma: no cover - shown to the Termux user
    raise RuntimeError(
        "Hyperliquid SDK is not installed. Run bash scripts/setup-galka-live.sh"
    ) from exc


INTERVAL_MS = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "2h": 7_200_000,
    "4h": 14_400_000,
    "8h": 28_800_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
}
SUPPORTED_COINS = {"BTC", "ETH", "SOL"}


class GatewayError(RuntimeError):
    pass


@dataclass(frozen=True)
class PlacedOrder:
    oid: int
    status: str
    level: int | None = None
    price: float | None = None
    size: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "oid": self.oid,
            "status": self.status,
            "level": self.level,
            "price": self.price,
            "size": self.size,
        }


@dataclass(frozen=True)
class EntryWithTarget:
    entry: PlacedOrder
    target: PlacedOrder


class HyperliquidGateway:
    def __init__(self, config: LiveConfig):
        self.config = config
        self.base_url = constants.MAINNET_API_URL if config.mainnet else constants.TESTNET_API_URL
        self.signer = eth_account.Account.from_key(config.api_secret_key)
        self.info = Info(self.base_url, skip_ws=True)
        self.exchange = Exchange(
            self.signer,
            self.base_url,
            account_address=config.account_address,
        )
        self._meta = self.info.meta()
        self._universe = {item["name"]: item for item in self._meta["universe"]}

    @property
    def agent_address(self) -> str:
        return self.signer.address.lower()

    def _coin(self, value: str) -> str:
        coin = value.upper().replace("USDT", "").replace("USD", "")
        if coin not in SUPPORTED_COINS:
            raise GatewayError(f"Unsupported coin: {value}")
        return coin

    def sz_decimals(self, coin: str) -> int:
        coin = self._coin(coin)
        return int(self._universe[coin]["szDecimals"])

    def max_leverage(self, coin: str) -> int:
        coin = self._coin(coin)
        return int(self._universe[coin].get("maxLeverage", 1))

    def account_state(self) -> dict[str, Any]:
        state = self.info.user_state(self.config.account_address)
        positions: dict[str, dict[str, Any]] = {}
        for row in state.get("assetPositions", []):
            position = row.get("position", {})
            coin = position.get("coin")
            if coin not in SUPPORTED_COINS:
                continue
            positions[coin] = {
                "coin": coin,
                "size": float(position.get("szi") or 0),
                "entryPrice": float(position.get("entryPx") or 0),
                "liquidationPrice": float(position.get("liquidationPx") or 0),
                "marginUsed": float(position.get("marginUsed") or 0),
                "positionValue": float(position.get("positionValue") or 0),
                "unrealizedPnl": float(position.get("unrealizedPnl") or 0),
                "leverage": position.get("leverage") or {},
            }
        summary = state.get("marginSummary") or {}
        return {
            "accountValue": float(summary.get("accountValue") or 0),
            "totalMarginUsed": float(summary.get("totalMarginUsed") or 0),
            "totalNotionalPosition": float(summary.get("totalNtlPos") or 0),
            "withdrawable": float(state.get("withdrawable") or 0),
            "positions": positions,
        }

    def open_orders(self, coin: str | None = None) -> list[dict[str, Any]]:
        selected = self._coin(coin) if coin else None
        rows = self.info.frontend_open_orders(self.config.account_address)
        output = []
        for row in rows:
            if selected and row.get("coin") != selected:
                continue
            output.append(
                {
                    "coin": row.get("coin"),
                    "oid": int(row.get("oid")),
                    "side": row.get("side"),
                    "price": float(row.get("limitPx") or 0),
                    "size": float(row.get("sz") or 0),
                    "originalSize": float(row.get("origSz") or row.get("sz") or 0),
                    "reduceOnly": bool(row.get("reduceOnly")),
                    "tif": row.get("tif"),
                    "orderType": row.get("orderType"),
                    "isTrigger": bool(row.get("isTrigger")),
                    "triggerPrice": float(row.get("triggerPx") or 0),
                    "timestamp": int(row.get("timestamp") or 0),
                }
            )
        return output

    def mids(self) -> dict[str, float]:
        rows = self.info.all_mids()
        return {coin: float(rows[coin]) for coin in SUPPORTED_COINS if coin in rows}

    def candles(self, coin: str, interval: str, limit: int = 1000) -> list[dict[str, Any]]:
        coin = self._coin(coin)
        if interval not in INTERVAL_MS:
            raise GatewayError(f"Unsupported interval: {interval}")
        limit = max(50, min(int(limit), 1500))
        end_ms = int(time.time() * 1000)
        start_ms = end_ms - INTERVAL_MS[interval] * (limit + 5)
        rows = self.info.candles_snapshot(coin, interval, start_ms, end_ms)
        rows = rows[-limit:]
        return [
            {
                "time": int(row["t"] // 1000),
                "openTime": int(row["t"]),
                "closeTime": int(row["T"]),
                "open": float(row["o"]),
                "high": float(row["h"]),
                "low": float(row["l"]),
                "close": float(row["c"]),
                "volume": float(row["v"]),
            }
            for row in rows
        ]

    def fills_since(self, start_ms: int) -> list[dict[str, Any]]:
        rows = self.info.user_fills_by_time(
            self.config.account_address,
            int(start_ms),
            aggregate_by_time=False,
        )
        return [
            {
                "coin": row.get("coin"),
                "oid": int(row.get("oid") or 0),
                "price": float(row.get("px") or 0),
                "size": float(row.get("sz") or 0),
                "side": row.get("side"),
                "direction": row.get("dir"),
                "closedPnl": float(row.get("closedPnl") or 0),
                "fee": float(row.get("fee") or 0),
                "time": int(row.get("time") or 0),
                "hash": row.get("hash"),
            }
            for row in rows
        ]

    def preview_ladder(self, coin: str, galka_price: float, total_notional: float) -> list[LadderLevel]:
        return build_ladder(galka_price, total_notional, self.sz_decimals(coin))

    def set_leverage(self, coin: str) -> Any:
        coin = self._coin(coin)
        leverage = min(self.config.leverage, self.max_leverage(coin))
        return self.exchange.update_leverage(leverage, coin, self.config.isolated is False)

    def place_entry_with_target(
        self,
        coin: str,
        level: LadderLevel,
        galka_price: float,
    ) -> EntryWithTarget:
        """Place one ALO entry and its exchange-native limit TP as a normalTpsl pair."""
        coin = self._coin(coin)
        target = round_perp_price(galka_price, self.sz_decimals(coin))
        requests = [
            {
                "coin": coin,
                "is_buy": True,
                "sz": level.size,
                "limit_px": level.price,
                "order_type": {"limit": {"tif": "Alo"}},
                "reduce_only": False,
            },
            {
                "coin": coin,
                "is_buy": False,
                "sz": level.size,
                "limit_px": target,
                "order_type": {
                    "trigger": {
                        "isMarket": False,
                        "triggerPx": target,
                        "tpsl": "tp",
                    }
                },
                "reduce_only": True,
            },
        ]
        response = self.exchange.bulk_orders(requests, grouping="normalTpsl")
        orders = self._parse_order_response(response, [level, None])
        if len(orders) != 2:
            raise GatewayError("Hyperliquid did not return both entry and target orders")
        entry = PlacedOrder(
            oid=orders[0].oid,
            status=orders[0].status,
            level=level.index,
            price=level.price,
            size=level.size,
        )
        target_order = PlacedOrder(
            oid=orders[1].oid,
            status=orders[1].status,
            level=level.index,
            price=target,
            size=level.size,
        )
        return EntryWithTarget(entry=entry, target=target_order)

    def place_or_replace_target(
        self,
        coin: str,
        quantity: float,
        galka_price: float,
        existing_oid: int | None = None,
    ) -> PlacedOrder:
        """Fallback protection if exchange-native child TP coverage is ever missing."""
        coin = self._coin(coin)
        quantity = round_size_down(abs(quantity), self.sz_decimals(coin))
        target = round_perp_price(galka_price, self.sz_decimals(coin))
        order_type = {"limit": {"tif": "Gtc"}}
        if existing_oid:
            response = self.exchange.modify_order(
                existing_oid,
                coin,
                False,
                quantity,
                target,
                order_type,
                reduce_only=True,
            )
        else:
            response = self.exchange.order(
                coin,
                False,
                quantity,
                target,
                order_type,
                reduce_only=True,
            )
        rows = self._parse_order_response(response, [None])
        if len(rows) != 1:
            raise GatewayError("Unexpected target-order response")
        return rows[0]

    def cancel_oids(self, coin: str, oids: list[int]) -> Any:
        coin = self._coin(coin)
        unique = sorted({int(oid) for oid in oids if int(oid) > 0})
        if not unique:
            return {"status": "ok", "response": {"data": {"statuses": []}}}
        return self.exchange.bulk_cancel([{"coin": coin, "oid": oid} for oid in unique])

    def emergency_market_close(self, coin: str) -> Any:
        coin = self._coin(coin)
        return self.exchange.market_close(coin, slippage=0.02)

    def _parse_order_response(
        self,
        response: dict[str, Any],
        levels: list[LadderLevel | None] | None,
    ) -> list[PlacedOrder]:
        if response.get("status") != "ok":
            raise GatewayError(f"Hyperliquid rejected request: {response}")
        statuses = response.get("response", {}).get("data", {}).get("statuses", [])
        if not isinstance(statuses, list):
            raise GatewayError(f"Unexpected Hyperliquid response: {response}")
        output: list[PlacedOrder] = []
        errors: list[str] = []
        for index, status in enumerate(statuses):
            level = levels[index] if levels and index < len(levels) else None
            if "error" in status:
                errors.append(str(status["error"]))
                continue
            if "resting" in status:
                oid = int(status["resting"]["oid"])
                state = "resting"
            elif "filled" in status:
                oid = int(status["filled"].get("oid") or 0)
                state = "filled"
            else:
                errors.append(f"Unknown order status: {status}")
                continue
            output.append(
                PlacedOrder(
                    oid=oid,
                    status=state,
                    level=level.index if level else None,
                    price=level.price if level else None,
                    size=level.size if level else None,
                )
            )
        if errors:
            raise GatewayError("; ".join(errors))
        if levels is not None and len(output) != len(levels):
            raise GatewayError("Hyperliquid returned an incomplete order-status list")
        return output
