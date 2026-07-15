import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from live.config import LiveConfig
from live.hyperliquid_compat import CompatibleGalkaLiveEngine, CompatibleHyperliquidGateway
from live.hyperliquid_gateway import PlacedOrder


class ParserTests(unittest.TestCase):
    def test_waiting_for_fill_is_successful_pending_status(self):
        gateway = CompatibleHyperliquidGateway.__new__(CompatibleHyperliquidGateway)
        level = SimpleNamespace(index=1, price=100.0, size=0.1)
        response = {
            "status": "ok",
            "response": {
                "data": {
                    "statuses": [
                        {"resting": {"oid": 123}},
                        "waitingForFill",
                    ]
                }
            },
        }
        orders = gateway._parse_order_response(response, [level, None])
        self.assertEqual(orders[0], PlacedOrder(123, "resting", 1, 100.0, 0.1))
        self.assertEqual(orders[1].oid, 0)
        self.assertEqual(orders[1].status, "waitingForFill")


class FakeGateway:
    def __init__(self):
        self.orders = []
        self.replacements = []
        self.cancelled = []

    def sz_decimals(self, _coin):
        return 5

    def open_orders(self, _coin=None):
        return list(self.orders)

    def place_or_replace_target(self, coin, quantity, galka_price, existing_oid=None):
        oid = existing_oid or 999
        self.replacements.append((coin, quantity, galka_price, existing_oid))
        return PlacedOrder(oid, "resting", None, galka_price, quantity)

    def cancel_oids(self, _coin, oids):
        self.cancelled.extend(oids)
        return {"status": "ok"}


class EngineCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        config = LiveConfig(
            account_address="0x" + "11" * 20,
            api_secret_key="0x" + "33" * 32,
            mainnet=True,
            live_enabled=True,
            leverage=10,
            isolated=True,
            total_notional=90,
            host="127.0.0.1",
            port=8098,
            config_path=root / "galka-live.env",
            data_dir=root / "data",
        )
        config.data_dir.mkdir()
        self.gateway = FakeGateway()
        self.engine = CompatibleGalkaLiveEngine(config, self.gateway)
        self.campaign = {
            "id": "test",
            "coin": "BTC",
            "galkaPrice": 100.0,
            "entryOidMap": {"101": 1},
            "targetOidMap": {"0": 1},
            "fallbackTargetOid": None,
            "managedNetSize": 0.1,
            "cycleClosedPnl": 0.0,
            "cycleFees": 0.0,
            "seenFills": [],
        }

    def tearDown(self):
        self.tmp.cleanup()

    def test_fallback_is_not_cancelled_when_it_is_only_target(self):
        self.gateway.orders = [
            {
                "coin": "BTC",
                "oid": 999,
                "side": "A",
                "price": 100.0,
                "size": 0.1,
                "reduceOnly": True,
                "triggerPrice": 0.0,
            }
        ]
        self.campaign["fallbackTargetOid"] = 999
        self.engine._ensure_target_coverage(self.campaign, self.gateway.orders, 0.1, 0.000005)
        self.assertEqual(self.gateway.cancelled, [])
        self.assertEqual(self.gateway.replacements[-1][-1], 999)

    def test_unknown_native_tp_fill_is_reconciled(self):
        fill = {
            "coin": "BTC",
            "oid": 777,
            "price": 100.0,
            "size": 0.1,
            "side": "A",
            "direction": "Close Long",
            "closedPnl": 0.25,
            "fee": 0.01,
            "time": 1000,
            "hash": "0xabc",
        }
        self.engine._apply_new_fills(self.campaign, [fill])
        self.assertEqual(self.campaign["managedNetSize"], 0.0)
        self.assertEqual(self.campaign["cycleClosedPnl"], 0.25)
        self.assertEqual(self.campaign["cycleFees"], 0.01)
        self.assertEqual(self.campaign["targetOidMap"]["777"], 0)


if __name__ == "__main__":
    unittest.main()
