from __future__ import annotations

from typing import Any

from .engine import GalkaLiveEngine
from .hyperliquid_gateway import GatewayError, HyperliquidGateway, PlacedOrder


_PENDING_ORDER_STATUSES = {"waitingForFill", "waitingForTrigger"}


class CompatibleHyperliquidGateway(HyperliquidGateway):
    """Compatibility layer for successful grouped TP/SL response variants.

    Hyperliquid returns string statuses such as ``waitingForFill`` for a
    normalTpsl child order which is accepted but not assigned an oid until the
    parent entry fills. These are successful statuses, not placement errors.
    """

    def _parse_order_response(
        self,
        response: dict[str, Any],
        levels: list[Any] | None,
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
            if isinstance(status, str):
                if status in _PENDING_ORDER_STATUSES:
                    output.append(
                        PlacedOrder(
                            oid=0,
                            status=status,
                            level=level.index if level else None,
                            price=level.price if level else None,
                            size=level.size if level else None,
                        )
                    )
                else:
                    errors.append(f"Unknown order status: {status}")
                continue
            if not isinstance(status, dict):
                errors.append(f"Unexpected order status: {status}")
                continue
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


class CompatibleGalkaLiveEngine(GalkaLiveEngine):
    """Reconcile delayed native TP oids without weakening position protection."""

    @staticmethod
    def _target_price(order: dict[str, Any]) -> float:
        return float(order.get("triggerPrice") or order.get("price") or 0)

    def _is_galka_target(self, campaign: dict[str, Any], order: dict[str, Any]) -> bool:
        if not order.get("reduceOnly") or order.get("side") != "A":
            return False
        galka = float(campaign["galkaPrice"])
        return abs(self._target_price(order) - galka) <= max(1e-9, galka * 1e-7)

    def _open_campaign_oids(self, campaign: dict[str, Any]) -> list[int]:
        owned = {int(oid) for oid in campaign.get("entryOidMap", {}) if int(oid) > 0}
        owned.update(int(oid) for oid in campaign.get("targetOidMap", {}) if int(oid) > 0)
        if campaign.get("fallbackTargetOid"):
            owned.add(int(campaign["fallbackTargetOid"]))

        open_orders = self.gateway.open_orders(campaign["coin"])
        for order in open_orders:
            if self._is_galka_target(campaign, order):
                oid = int(order.get("oid") or 0)
                if oid > 0:
                    owned.add(oid)
                    campaign.setdefault("targetOidMap", {})[str(oid)] = 0
        open_ids = {int(row["oid"]) for row in open_orders}
        return sorted(owned & open_ids)

    def _apply_new_fills(self, campaign: dict[str, Any], fills: list[dict[str, Any]]) -> None:
        super()._apply_new_fills(campaign, fills)
        seen = set(campaign.get("seenFills", []))
        entry_ids = {int(oid) for oid in campaign.get("entryOidMap", {}) if int(oid) > 0}
        target_ids = {int(oid) for oid in campaign.get("targetOidMap", {}) if int(oid) > 0}
        galka = float(campaign["galkaPrice"])
        price_tolerance = max(1e-9, galka * 1e-7)

        for fill in sorted(fills, key=lambda row: row["time"]):
            key = self._fill_key(fill)
            if key in seen:
                continue
            oid = int(fill.get("oid") or 0)
            if oid in entry_ids or oid in target_ids or fill.get("side") != "A":
                continue
            direction = str(fill.get("direction") or "").lower()
            price = float(fill.get("price") or 0)
            is_close_long = "close long" in direction or price + price_tolerance >= galka
            if not is_close_long or float(campaign.get("managedNetSize") or 0) <= 0:
                continue

            size = float(fill.get("size") or 0)
            campaign["managedNetSize"] = max(0.0, float(campaign.get("managedNetSize") or 0) - size)
            campaign["cycleClosedPnl"] = float(campaign.get("cycleClosedPnl") or 0) + float(
                fill.get("closedPnl") or 0
            )
            campaign["cycleFees"] = float(campaign.get("cycleFees") or 0) + float(fill.get("fee") or 0)
            if oid > 0:
                campaign.setdefault("targetOidMap", {})[str(oid)] = 0
            seen.add(key)
        campaign["seenFills"] = list(seen)[-2000:]

    def _ensure_target_coverage(
        self,
        campaign: dict[str, Any],
        open_orders: list[dict[str, Any]],
        managed_size: float,
        tolerance: float,
    ) -> None:
        coin = campaign["coin"]
        fallback_oid = int(campaign.get("fallbackTargetOid") or 0)
        fallback_open = False
        native_protected = 0.0

        for order in open_orders:
            if not self._is_galka_target(campaign, order):
                continue
            oid = int(order.get("oid") or 0)
            if oid <= 0:
                continue
            campaign.setdefault("targetOidMap", {})[str(oid)] = 0
            if oid == fallback_oid:
                fallback_open = True
            else:
                native_protected += float(order.get("size") or 0)

        if native_protected + tolerance >= managed_size:
            if fallback_open:
                try:
                    self.gateway.cancel_oids(coin, [fallback_oid])
                finally:
                    campaign["fallbackTargetOid"] = None
            campaign["status"] = "closing"
            return

        missing = max(0.0, managed_size - native_protected)
        fallback = self.gateway.place_or_replace_target(
            coin,
            missing,
            float(campaign["galkaPrice"]),
            fallback_oid if fallback_open else None,
        )
        campaign["fallbackTargetOid"] = fallback.oid
        campaign.setdefault("targetOidMap", {})[str(fallback.oid)] = 0
        campaign["status"] = "closing"
        self._event(
            "risk",
            f"{coin}: добавлена резервная reduce-only лимитка на GALKA",
            campaignId=campaign["id"],
            size=missing,
            oid=fallback.oid,
        )
