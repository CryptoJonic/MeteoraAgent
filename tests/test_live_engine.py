import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from live.config import LiveConfig
from live.engine import GalkaLiveEngine
from live.hyperliquid_gateway import EntryWithTarget, PlacedOrder
from live.live_ladder import build_ladder


class FakeGateway:
    def __init__(self):
        self.next_oid = 1000
        self.orders = {}
        self.fills = []
        self.cancelled = []
        self.leverage_updates = []
        self.agent_address = "0x" + "22" * 20

    def sz_decimals(self, coin):
        return {"BTC": 5, "ETH": 4, "SOL": 2}[coin]

    def mids(self):
        return {"BTC": 61_000.0, "ETH": 3_000.0, "SOL": 150.0}

    def account_state(self):
        return {
            "accountValue": 19.0,
            "withdrawable": 19.0,
            "totalMarginUsed": 0.0,
            "totalNotionalPosition": 0.0,
            "positions": {},
        }

    def preview_ladder(self, coin, galka_price, total_notional):
        return build_ladder(galka_price, total_notional, self.sz_decimals(coin))

    def set_leverage(self, coin):
        self.leverage_updates.append(coin)
        return {"status": "ok"}

    def _new_oid(self):
        self.next_oid += 1
        return self.next_oid

    def place_entry_with_target(self, coin, level, galka_price):
        entry_oid = self._new_oid()
        target_oid = self._new_oid()
        self.orders[entry_oid] = {
            "coin": coin,
            "oid": entry_oid,
            "side": "B",
            "price": level.price,
            "size": level.size,
            "reduceOnly": False,
            "triggerPrice": 0.0,
        }
        self.orders[target_oid] = {
            "coin": coin,
            "oid": target_oid,
            "side": "A",
            "price": galka_price,
            "size": level.size,
            "reduceOnly": True,
            "triggerPrice": galka_price,
        }
        return EntryWithTarget(
            entry=PlacedOrder(entry_oid, "resting", level.index, level.price, level.size),
            target=PlacedOrder(target_oid, "resting", level.index, galka_price, level.size),
        )

    def place_or_replace_target(self, coin, quantity, galka_price, existing_oid=None):
        oid = existing_oid or self._new_oid()
        self.orders[oid] = {
            "coin": coin,
            "oid": oid,
            "side": "A",
            "price": galka_price,
            "size": quantity,
            "reduceOnly": True,
            "triggerPrice": 0.0,
        }
        return PlacedOrder(oid, "resting", None, galka_price, quantity)

    def open_orders(self, coin=None):
        rows = list(self.orders.values())
        return [row.copy() for row in rows if coin is None or row["coin"] == coin]

    def fills_since(self, _start_ms):
        return list(self.fills)

    def cancel_oids(self, coin, oids):
        for oid in oids:
            if oid in self.orders and self.orders[oid]["coin"] == coin:
                self.orders.pop(oid, None)
                self.cancelled.append(oid)
        return {"status": "ok"}

    def emergency_market_close(self, coin):
        return {"status": "ok", "coin": coin}

    def candles(self, coin, interval, limit):
        return []

    def fill_entry(self, campaign, index, time_ms):
        level = next(row for row in campaign["levels"] if row["index"] == index)
        oid = int(level["oid"])
        self.orders.pop(oid, None)
        self.fills.append(
            {
                "coin": campaign["coin"],
                "oid": oid,
                "price": level["price"],
                "size": level["size"],
                "side": "B",
                "closedPnl": 0.0,
                "fee": level["notional"] * 0.00015,
                "time": time_ms,
                "hash": f"entry-{oid}",
            }
        )

    def fill_target(self, campaign, index, time_ms, closed_pnl):
        level = next(row for row in campaign["levels"] if row["index"] == index)
        oid = int(level["tpOid"])
        self.orders.pop(oid, None)
        self.fills.append(
            {
                "coin": campaign["coin"],
                "oid": oid,
                "price": campaign["galkaPrice"],
                "size": level["size"],
                "side": "A",
                "closedPnl": closed_pnl,
                "fee": campaign["galkaPrice"] * level["size"] * 0.00015,
                "time": time_ms,
                "hash": f"target-{oid}",
            }
        )


class LiveEngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.config = LiveConfig(
            account_address="0x" + "11" * 20,
            api_secret_key="0x" + "33" * 32,
            mainnet=True,
            live_enabled=True,
            leverage=10,
            isolated=True,
            total_notional=150,
            host="127.0.0.1",
            port=8098,
            config_path=root / "galka-live.env",
            data_dir=root / "data",
        )
        self.config.data_dir.mkdir()
        self.gateway = FakeGateway()
        self.engine = GalkaLiveEngine(self.config, self.gateway)

    def tearDown(self):
        self.tmp.cleanup()

    def test_l1_rearms_then_l2_finishes_campaign(self):
        campaign = self.engine.create_campaign("BTC", 60_000, "PLACE_REAL_ORDERS")
        self.assertEqual(campaign["status"], "waiting")
        self.assertEqual(len(campaign["levels"]), 8)
        self.assertTrue(all(level["oid"] and level["tpOid"] for level in campaign["levels"]))

        active = self.engine._active_campaign("BTC")
        old_l1_oid = active["levels"][0]["oid"]
        self.gateway.fill_entry(active, 1, 1_000)
        self.engine._sync_campaign(active)
        self.assertEqual(active["cycleDeepest"], 1)
        self.assertGreater(active["managedNetSize"], 0)

        self.gateway.fill_target(active, 1, 2_000, closed_pnl=0.20)
        self.engine._sync_campaign(active)
        self.assertEqual(active["status"], "waiting")
        self.assertEqual(active["l1Cycles"], 1)
        self.assertNotEqual(active["levels"][0]["oid"], old_l1_oid)
        self.assertEqual(active["cycleDeepest"], 0)
        self.assertEqual(active["managedNetSize"], 0)

        self.gateway.fill_entry(active, 1, 3_000)
        self.gateway.fill_entry(active, 2, 3_100)
        self.engine._sync_campaign(active)
        self.assertEqual(active["cycleDeepest"], 2)

        self.gateway.fill_target(active, 1, 4_000, closed_pnl=0.20)
        self.gateway.fill_target(active, 2, 4_100, closed_pnl=0.25)
        self.engine._sync_campaign(active)
        self.assertEqual(active["status"], "completed")
        self.assertEqual(active["l1Cycles"], 1)
        self.assertFalse(self.engine._active_campaign("BTC"))
        self.assertEqual(self.gateway.open_orders("BTC"), [])

    def test_no_timeout_field_and_waiting_campaign_can_be_cancelled(self):
        campaign = self.engine.create_campaign("ETH", 2_900, "PLACE_REAL_ORDERS")
        self.assertNotIn("expiresAt", campaign)
        cancelled = self.engine.cancel_waiting_campaign("ETH")
        self.assertEqual(cancelled["status"], "canceled")
        self.assertEqual(self.gateway.open_orders("ETH"), [])


if __name__ == "__main__":
    unittest.main()
