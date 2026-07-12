from __future__ import annotations

import unittest

import pandas as pd

from galka_lab.data import validate_market_data
from galka_lab.utils import frame_hash


class DataTests(unittest.TestCase):
    def test_validation_and_hash_are_deterministic(self):
        frame = pd.DataFrame(
            {
                "time": pd.to_datetime(["2026-01-01T00:00Z", "2026-01-01T00:01Z", "2026-01-01T00:03Z"]),
                "open": [100, 101, 102],
                "high": [102, 103, 104],
                "low": [99, 100, 101],
                "close": [101, 102, 103],
                "volume": [1, 2, 3],
            }
        )
        first = validate_market_data(frame, "1m")
        second = validate_market_data(frame.copy(), "1m")
        self.assertEqual(first["gaps"], 1)
        self.assertEqual(first["missing_bars"], 1)
        self.assertEqual(first["invalid_ohlc"], 0)
        self.assertEqual(first["hash"], second["hash"])
        self.assertEqual(first["hash"], frame_hash(frame))


if __name__ == "__main__":
    unittest.main()
