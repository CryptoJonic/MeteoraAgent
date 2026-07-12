from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from galka_lab.detector import extract_candidates
from galka_lab.features import build_market_features


def fixture() -> pd.DataFrame:
    count = 180
    base = 100 + np.sin(np.arange(count) / 7) * 0.3
    frame = pd.DataFrame(
        {
            "time": pd.date_range("2025-01-01", periods=count, freq="15min", tz="UTC"),
            "open": base,
            "high": base + 0.6,
            "low": base - 0.6,
            "close": base + 0.05,
            "volume": np.full(count, 100.0),
        }
    )
    pivot = 90
    frame.loc[pivot, ["open", "high", "low", "close", "volume"]] = [97, 98, 90, 96, 500]
    for offset, high in enumerate((96, 97, 98, 99, 100, 101), 1):
        frame.loc[pivot + offset, ["open", "high", "low", "close"]] = [95 + offset, high, 94 + offset, 95.5 + offset]
    return frame


class DetectorTests(unittest.TestCase):
    def test_deterministic_and_no_future_feature_leak(self):
        original = fixture()
        featured = build_market_features(original, "15m")
        first = extract_candidates(featured, "BTCUSDT", "15m")
        candidate = first[first["pivot_index"] == 90].iloc[0]
        self.assertEqual(candidate["confirmation_index"], 96)
        self.assertEqual(candidate["feature_cutoff_time"], featured.loc[96, "time"])

        changed = original.copy()
        changed.loc[120:, ["open", "high", "low", "close"]] *= 1.5
        second = extract_candidates(build_market_features(changed, "15m"), "BTCUSDT", "15m")
        repeated = second[second["candidate_id"] == candidate["candidate_id"]].iloc[0]
        columns = ["drop_atr", "recovery_ratio", "sharpness_atr", "volume_ratio", "trend_slope_atr"]
        for column in columns:
            self.assertAlmostEqual(candidate[column], repeated[column], places=12)
        self.assertEqual(first["candidate_id"].duplicated().sum(), 0)


if __name__ == "__main__":
    unittest.main()
