from __future__ import annotations

import json
import os
import threading
import time
import uuid
from copy import deepcopy
from typing import Any

from .config import LiveConfig
from .hyperliquid_gateway import HyperliquidGateway, SUPPORTED_COINS
from .live_ladder import LadderLevel, estimated_target_pnl, weighted_average

ACTIVE_STATUSES = {"placing", "waiting", "open", "closing"}


class LiveEngineError(RuntimeError):
    pass


def now_ms() -> int:
    return int(time.time() * 1000)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class GalkaLiveEngine:
    """Local coordinator for manual GALKA campaigns.

    Each entry is paired on Hyperliquid with an exchange-native, reduce-only,
    non-market TP at GALKA. The local monitor reconciles fills, rearms L1 after
    a one-level cycle, and cancels the remaining ladder after an L2+ cycle.
    """

    def __init__(self, config: LiveConfig, gateway: HyperliquidGateway):
        self.config = config
        self.gateway = gateway
        self.state_path = config.data_dir / "state.json"
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.state = self._load_state()
        self.monitor_thread = threading.Thread(
            target=self._monitor_loop,
            name="galka-live-monitor",
            daemon=True,
        )

    def start(self) -> None:
        self.monitor_thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        if self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)

    @staticmethod
    def _empty_state() -> dict[str, Any]:
        return {"version": 2, "campaigns": {}, "events": []}

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return self._empty_state()
        try:
            data = json.loads(self.state_path.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or data.get("version") not in {1, 2}:
                raise ValueError("unsupported state version")
            data["version"] = 2
            data.setdefault("campaigns", {})
            data.setdefault("events", [])
            for campaign in data["campaigns"].values():
                campaign.setdefault("entryOidMap", {})
                campaign.setdefault("targetOidMap", {})
                campaign.setdefault("fallbackTargetOid", None)
                campaign.setdefault("managedNetSize", 0.0)
                campaign.setdefault("abortAfterClose", False)
                campaign.setdefault("seenFills", [])
                for level in campaign.get("levels", []):
                    if level.get("oid"):
                        campaign["entryOidMap"].setdefault(str(level["oid"]), int(level["index"]))
                    level.setdefault("tpOid", None)
                    if level.get("tpOid"):
                        campaign["targetOidMap"].setdefault(str(level["tpOid"]), int(level["index"]))
            return data
        except Exception as exc:
            backup = self.state_path.with_suffix(f".broken-{now_ms()}.json")
            self.state_path.replace(backup)
            state = self._empty_state()
            state["events"].append(
                {
                    "time": now_iso(),
                    "type": "error",
                    "message": f"Broken state moved to {backup.name}: {exc}",
                    "meta": {},
                }
            )
            return state

    def _save(self) -> None:
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
        try:
            tmp.chmod(0o600)
        except OSError:
            pass
        os.replace(tmp, self.state_path)
        try:
            self.state_path.chmod(0o600)
        except OSError:
            pass

    def _event(self, event_type: str, message: str, **meta: Any) -> None:
        events = self.state.setdefault("events", [])
        events.append({"time": now_iso(), "type": event_type, "message": message, "meta": meta})
        del events[:-500]

    @staticmethod
    def _coin(value: str) -> str:
        coin = value.upper().replace("USDT", "").replace("USD", "")
        if coin not in SUPPORTED_COINS:
            raise LiveEngineError(f"Поддерживаются только BTC, ETH и SOL: {value}")
        return coin

    def _campaign(self, coin: str) -> dict[str, Any] | None:
        return self.state.get("campaigns", {}).get(self._coin(coin))

    def _active_campaign(self, coin: str) -> dict[str, Any] | None:
        campaign = self._campaign(coin)
        return campaign if campaign and campaign.get("status") in ACTIVE_STATUSES else None

    def preview(self, coin: str, galka_price: float) -> dict[str, Any]:
        coin = self._coin(coin)
        galka_price = float(galka_price)
        if galka_price <= 0:
            raise LiveEngineError("Цена GALKA должна быть больше нуля")
        mid = self.gateway.mids().get(coin)
        if not mid:
            raise LiveEngineError(f"Нет текущей цены {coin}")
        if mid <= galka_price:
            raise LiveEngineError(
                f"Текущая цена {mid:g} уже не выше GALKA {galka_price:g}. Сетка должна ждать падения сверху."
            )
        levels = self.gateway.preview_ladder(coin, galka_price, self.config.total_notional)
        account = self.gateway.account_state()
        actual_notional = sum(level.notional for level in levels)
        return {
            "coin": coin,
            "galkaPrice": galka_price,
            "currentPrice": mid,
            "levels": [level.to_dict() for level in levels],
            "requestedNotional": self.config.total_notional,
            "actualNotional": actual_notional,
            "requiredMargin": actual_notional / self.config.leverage,
            "leverage": self.config.leverage,
            "isolated": self.config.isolated,
            "weightedAverage": weighted_average(levels),
            "estimatedPnlAtGalka": estimated_target_pnl(levels, galka_price, 0.00015),
            "accountValue": account["accountValue"],
            "withdrawable": account["withdrawable"],
            "liveEnabled": self.config.live_enabled,
        }

    def create_campaign(self, coin: str, galka_price: float, confirmation: str) -> dict[str, Any]:
        coin = self._coin(coin)
        if not self.config.live_enabled:
            raise LiveEngineError(
                "LIVE выключен в локальном config. Установи HL_LIVE_ENABLED=YES и правильную строку подтверждения."
            )
        if confirmation != "PLACE_REAL_ORDERS":
            raise LiveEngineError("Не подтверждена отправка реальных ордеров")

        with self.lock:
            if self._active_campaign(coin):
                raise LiveEngineError(f"Для {coin} уже есть активная GALKA")
            preview = self.preview(coin, galka_price)
            account = self.gateway.account_state()
            position = account["positions"].get(coin)
            if position and abs(position["size"]) > 0:
                raise LiveEngineError(f"На {coin} уже есть реальная позиция. Новая GALKA не создана.")
            foreign_orders = self.gateway.open_orders(coin)
            if foreign_orders:
                raise LiveEngineError(
                    f"На {coin} уже есть {len(foreign_orders)} открытых ордеров. Сначала убери их вручную."
                )
            if preview["requiredMargin"] > max(0, account["withdrawable"] * 0.90):
                raise LiveEngineError(
                    f"Недостаточно свободной маржи: нужно около ${preview['requiredMargin']:.2f}, "
                    f"доступно ${account['withdrawable']:.2f}."
                )

            levels = [LadderLevel(**row) for row in preview["levels"]]
            campaign_id = f"HL-{coin}-{now_ms()}-{uuid.uuid4().hex[:6]}"
            campaign = {
                "id": campaign_id,
                "coin": coin,
                "status": "placing",
                "galkaPrice": float(galka_price),
                "createdAt": now_iso(),
                "createdMs": now_ms(),
                "updatedAt": now_iso(),
                "leverage": self.config.leverage,
                "isolated": self.config.isolated,
                "requestedNotional": self.config.total_notional,
                "actualNotional": preview["actualNotional"],
                "levels": [
                    {
                        **level.to_dict(),
                        "oid": None,
                        "tpOid": None,
                        "status": "new",
                        "filledSize": 0.0,
                        "averageFillPrice": 0.0,
                    }
                    for level in levels
                ],
                "entryOidMap": {},
                "targetOidMap": {},
                "fallbackTargetOid": None,
                "managedNetSize": 0.0,
                "hadPosition": False,
                "cycleDeepest": 0,
                "l1Cycles": 0,
                "l1RealizedPnl": 0.0,
                "cycleClosedPnl": 0.0,
                "cycleFees": 0.0,
                "seenFills": [],
                "abortAfterClose": False,
                "lastError": None,
            }
            self.state.setdefault("campaigns", {})[coin] = campaign
            self._save()

            try:
                self.gateway.set_leverage(coin)
                for level_state, level in zip(campaign["levels"], levels):
                    pair = self.gateway.place_entry_with_target(coin, level, float(galka_price))
                    level_state["oid"] = pair.entry.oid
                    level_state["tpOid"] = pair.target.oid
                    level_state["status"] = pair.entry.status
                    campaign["entryOidMap"][str(pair.entry.oid)] = level.index
                    campaign["targetOidMap"][str(pair.target.oid)] = level.index
                    campaign["updatedAt"] = now_iso()
                    self._save()
                campaign["status"] = "waiting"
                self._event(
                    "live",
                    f"{coin}: реальная GALKA {galka_price:g}, выставлено 8 лимиток с биржевыми TP",
                    campaignId=campaign_id,
                    actualNotional=preview["actualNotional"],
                )
                self._save()
                return deepcopy(campaign)
            except Exception as exc:
                self._handle_creation_failure(campaign, exc)
                raise LiveEngineError(str(exc)) from exc

    def _handle_creation_failure(self, campaign: dict[str, Any], error: Exception) -> None:
        coin = campaign["coin"]
        try:
            open_orders = self.gateway.open_orders(coin)
            self.gateway.cancel_oids(coin, [row["oid"] for row in open_orders])
        except Exception:
            pass
        campaign["lastError"] = str(error)
        campaign["abortAfterClose"] = True
        try:
            account = self.gateway.account_state()
            position = account["positions"].get(coin)
            size = abs(float(position["size"])) if position else 0.0
            if size > 0:
                fallback = self.gateway.place_or_replace_target(
                    coin,
                    size,
                    float(campaign["galkaPrice"]),
                )
                campaign["fallbackTargetOid"] = fallback.oid
                campaign["targetOidMap"][str(fallback.oid)] = 0
                campaign["managedNetSize"] = size
                campaign["hadPosition"] = True
                campaign["status"] = "closing"
                self._event(
                    "risk",
                    f"{coin}: лестница создана не полностью; входы отменены, позиция защищена лимитом на GALKA",
                    campaignId=campaign["id"],
                    error=str(error),
                )
            else:
                campaign["status"] = "error"
                self._event("error", f"{coin}: GALKA не создана: {error}", campaignId=campaign["id"])
        except Exception as protection_error:
            campaign["status"] = "error"
            campaign["lastError"] = f"{error}; protection: {protection_error}"
            self._event(
                "risk",
                f"{coin}: ошибка создания и защиты; проверь Hyperliquid немедленно",
                campaignId=campaign["id"],
            )
        campaign["updatedAt"] = now_iso()
        self._save()

    def cancel_waiting_campaign(self, coin: str) -> dict[str, Any]:
        coin = self._coin(coin)
        with self.lock:
            campaign = self._active_campaign(coin)
            if not campaign:
                raise LiveEngineError(f"Для {coin} нет активной GALKA")
            if float(campaign.get("managedNetSize") or 0) > self._size_tolerance(coin):
                raise LiveEngineError("Есть открытая позиция. Обычная отмена запрещена; используй аварийное закрытие.")
            self.gateway.cancel_oids(coin, self._open_campaign_oids(campaign))
            campaign["status"] = "canceled"
            campaign["completedAt"] = now_iso()
            campaign["updatedAt"] = now_iso()
            self._event("live", f"{coin}: GALKA отменена без позиции", campaignId=campaign["id"])
            self._save()
            return deepcopy(campaign)

    def emergency_close(self, coin: str, confirmation: str) -> dict[str, Any]:
        coin = self._coin(coin)
        if confirmation != "EMERGENCY_CLOSE_REAL_POSITION":
            raise LiveEngineError("Не подтверждено аварийное закрытие")
        with self.lock:
            campaign = self._active_campaign(coin)
            if not campaign:
                raise LiveEngineError(f"Для {coin} нет активной GALKA")
            self.gateway.cancel_oids(coin, self._open_campaign_oids(campaign))
            account = self.gateway.account_state()
            position = account["positions"].get(coin)
            if position and abs(position["size"]) > 0:
                self.gateway.emergency_market_close(coin)
            campaign["status"] = "emergency_closed"
            campaign["completedAt"] = now_iso()
            campaign["updatedAt"] = now_iso()
            self._event("risk", f"{coin}: аварийное рыночное закрытие отправлено", campaignId=campaign["id"])
            self._save()
            return deepcopy(campaign)

    def status(self) -> dict[str, Any]:
        with self.lock:
            account = self.gateway.account_state()
            return {
                "configured": True,
                "liveEnabled": self.config.live_enabled,
                "network": self.config.network_name,
                "account": self.config.masked_address,
                "agent": f"{self.gateway.agent_address[:6]}…{self.gateway.agent_address[-4:]}",
                "leverage": self.config.leverage,
                "isolated": self.config.isolated,
                "totalNotional": self.config.total_notional,
                "accountState": account,
                "mids": self.gateway.mids(),
                "campaigns": deepcopy(self.state.get("campaigns", {})),
                "events": deepcopy(self.state.get("events", [])[-100:]),
                "serverTime": now_ms(),
            }

    def candles(self, coin: str, interval: str, limit: int) -> list[dict[str, Any]]:
        return self.gateway.candles(self._coin(coin), interval, limit)

    def _size_tolerance(self, coin: str) -> float:
        return 10 ** (-self.gateway.sz_decimals(coin)) / 2

    def _open_campaign_oids(self, campaign: dict[str, Any]) -> list[int]:
        owned = {int(oid) for oid in campaign.get("entryOidMap", {})}
        owned.update(int(oid) for oid in campaign.get("targetOidMap", {}))
        if campaign.get("fallbackTargetOid"):
            owned.add(int(campaign["fallbackTargetOid"]))
        open_ids = {row["oid"] for row in self.gateway.open_orders(campaign["coin"])}
        return sorted(owned & open_ids)

    @staticmethod
    def _fill_key(fill: dict[str, Any]) -> str:
        return ":".join(str(fill.get(key, "")) for key in ("hash", "oid", "time", "side", "size", "price"))

    def _apply_new_fills(self, campaign: dict[str, Any], fills: list[dict[str, Any]]) -> None:
        seen = set(campaign.get("seenFills", []))
        entry_map = {int(oid): int(level) for oid, level in campaign.get("entryOidMap", {}).items()}
        target_map = {int(oid): int(level) for oid, level in campaign.get("targetOidMap", {}).items()}
        levels_by_index = {int(level["index"]): level for level in campaign.get("levels", [])}

        for fill in sorted(fills, key=lambda row: row["time"]):
            key = self._fill_key(fill)
            if key in seen:
                continue
            oid = int(fill.get("oid") or 0)
            size = float(fill.get("size") or 0)
            fee = float(fill.get("fee") or 0)
            if oid in entry_map and fill.get("side") == "B":
                index = entry_map[oid]
                level = levels_by_index.get(index)
                if not level:
                    continue
                old_size = float(level.get("filledSize") or 0)
                total_size = old_size + size
                old_notional = old_size * float(level.get("averageFillPrice") or 0)
                add_notional = size * float(fill.get("price") or 0)
                level["filledSize"] = total_size
                level["averageFillPrice"] = (old_notional + add_notional) / total_size if total_size else 0
                level["status"] = "partial" if total_size + 1e-12 < float(level["size"]) else "filled"
                campaign["cycleDeepest"] = max(int(campaign.get("cycleDeepest") or 0), index)
                campaign["managedNetSize"] = float(campaign.get("managedNetSize") or 0) + size
                campaign["cycleFees"] = float(campaign.get("cycleFees") or 0) + fee
                self._event(
                    "fill",
                    f"{campaign['coin']}: L{index} исполнена на {size:g}",
                    campaignId=campaign["id"],
                    price=fill.get("price"),
                )
            elif oid in target_map and fill.get("side") == "A":
                campaign["managedNetSize"] = max(0.0, float(campaign.get("managedNetSize") or 0) - size)
                campaign["cycleClosedPnl"] = float(campaign.get("cycleClosedPnl") or 0) + float(
                    fill.get("closedPnl") or 0
                )
                campaign["cycleFees"] = float(campaign.get("cycleFees") or 0) + fee
            else:
                continue
            seen.add(key)
        campaign["seenFills"] = list(seen)[-2000:]

    def _sync_campaign(self, campaign: dict[str, Any]) -> None:
        coin = campaign["coin"]
        open_orders = self.gateway.open_orders(coin)
        open_by_oid = {row["oid"]: row for row in open_orders}
        fills = [
            row
            for row in self.gateway.fills_since(max(0, int(campaign["createdMs"]) - 60_000))
            if row.get("coin") == coin
        ]
        self._apply_new_fills(campaign, fills)

        for level in campaign.get("levels", []):
            oid = int(level["oid"]) if level.get("oid") else 0
            if oid and oid in open_by_oid:
                level["status"] = "partial" if float(level.get("filledSize") or 0) > 0 else "resting"
            elif float(level.get("filledSize") or 0) >= float(level.get("size") or 0) - 1e-12:
                level["status"] = "filled"

        managed_size = float(campaign.get("managedNetSize") or 0)
        tolerance = self._size_tolerance(coin)
        if managed_size > tolerance:
            campaign["hadPosition"] = True
            campaign["status"] = "open"
            self._ensure_target_coverage(campaign, open_orders, managed_size, tolerance)
        elif campaign.get("hadPosition"):
            self._finish_cycle(campaign)
        campaign["updatedAt"] = now_iso()

    def _ensure_target_coverage(
        self,
        campaign: dict[str, Any],
        open_orders: list[dict[str, Any]],
        managed_size: float,
        tolerance: float,
    ) -> None:
        coin = campaign["coin"]
        target_ids = {int(oid) for oid in campaign.get("targetOidMap", {})}
        galka = float(campaign["galkaPrice"])
        price_tolerance = max(1e-9, galka * 1e-7)
        protected = 0.0
        for order in open_orders:
            if order["oid"] not in target_ids or not order.get("reduceOnly") or order.get("side") != "A":
                continue
            trigger_or_limit = float(order.get("triggerPrice") or order.get("price") or 0)
            if abs(trigger_or_limit - galka) <= price_tolerance:
                protected += float(order.get("size") or 0)

        fallback_oid = campaign.get("fallbackTargetOid")
        fallback_open = bool(fallback_oid and any(row["oid"] == int(fallback_oid) for row in open_orders))
        if protected + tolerance >= managed_size:
            if fallback_open:
                try:
                    self.gateway.cancel_oids(coin, [int(fallback_oid)])
                finally:
                    campaign["fallbackTargetOid"] = None
            campaign["status"] = "closing"
            return

        missing = managed_size - protected
        fallback = self.gateway.place_or_replace_target(
            coin,
            missing,
            galka,
            int(fallback_oid) if fallback_open else None,
        )
        campaign["fallbackTargetOid"] = fallback.oid
        campaign["targetOidMap"][str(fallback.oid)] = 0
        campaign["status"] = "closing"
        self._event(
            "risk",
            f"{coin}: добавлена резервная reduce-only лимитка на GALKA",
            campaignId=campaign["id"],
            size=missing,
            oid=fallback.oid,
        )

    def _finish_cycle(self, campaign: dict[str, Any]) -> None:
        coin = campaign["coin"]
        deepest = int(campaign.get("cycleDeepest") or 0)
        net_cycle = float(campaign.get("cycleClosedPnl") or 0) - float(campaign.get("cycleFees") or 0)
        campaign["managedNetSize"] = 0.0
        campaign["fallbackTargetOid"] = None

        if campaign.get("abortAfterClose"):
            self.gateway.cancel_oids(coin, self._open_campaign_oids(campaign))
            campaign["status"] = "error_closed"
            campaign["completedAt"] = now_iso()
            campaign["hadPosition"] = False
            campaign["finalClosedPnl"] = net_cycle
            self._event(
                "risk",
                f"{coin}: защищённая неполная кампания закрыта на GALKA и остановлена",
                campaignId=campaign["id"],
                pnl=net_cycle,
            )
            return

        if deepest == 1:
            l1 = next(level for level in campaign["levels"] if int(level["index"]) == 1)
            pair = self.gateway.place_entry_with_target(
                coin,
                LadderLevel(
                    index=int(l1["index"]),
                    depth_pct=float(l1["depth_pct"]),
                    weight=float(l1["weight"]),
                    price=float(l1["price"]),
                    size=float(l1["size"]),
                    notional=float(l1["notional"]),
                ),
                float(campaign["galkaPrice"]),
            )
            l1.update(
                {
                    "oid": pair.entry.oid,
                    "tpOid": pair.target.oid,
                    "status": pair.entry.status,
                    "filledSize": 0.0,
                    "averageFillPrice": 0.0,
                }
            )
            campaign["entryOidMap"][str(pair.entry.oid)] = 1
            campaign["targetOidMap"][str(pair.target.oid)] = 1
            campaign["l1Cycles"] = int(campaign.get("l1Cycles") or 0) + 1
            campaign["l1RealizedPnl"] = float(campaign.get("l1RealizedPnl") or 0) + net_cycle
            campaign["cycleClosedPnl"] = 0.0
            campaign["cycleFees"] = 0.0
            campaign["cycleDeepest"] = 0
            campaign["hadPosition"] = False
            campaign["status"] = "waiting"
            self._event(
                "live",
                f"{coin}: L1 закрыта на GALKA и выставлена снова",
                campaignId=campaign["id"],
                cycle=campaign["l1Cycles"],
                pnl=net_cycle,
            )
            return

        if deepest >= 2:
            self.gateway.cancel_oids(coin, self._open_campaign_oids(campaign))
            campaign["status"] = "completed"
            campaign["completedAt"] = now_iso()
            campaign["hadPosition"] = False
            campaign["finalClosedPnl"] = net_cycle
            self._event(
                "live",
                f"{coin}: L{deepest} достигнута, позиция закрыта на GALKA, кампания завершена",
                campaignId=campaign["id"],
                deepest=deepest,
                pnl=net_cycle,
            )
            return

        campaign["hadPosition"] = False
        campaign["status"] = "waiting"

    def _monitor_loop(self) -> None:
        while not self.stop_event.wait(1.0):
            if not self.config.live_enabled:
                continue
            with self.lock:
                dirty = False
                for campaign in list(self.state.get("campaigns", {}).values()):
                    if campaign.get("status") not in ACTIVE_STATUSES:
                        continue
                    try:
                        self._sync_campaign(campaign)
                        campaign["lastError"] = None
                    except Exception as exc:
                        campaign["lastError"] = str(exc)
                        campaign["updatedAt"] = now_iso()
                        self._event("error", f"{campaign['coin']}: синхронизация LIVE: {exc}")
                    dirty = True
                if dirty:
                    self._save()
