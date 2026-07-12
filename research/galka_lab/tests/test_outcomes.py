from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from galka_lab.outcomes import label_outcomes


def candidate(identifier: str, confirmation: pd.Timestamp) -> dict:
    return {
        "candidate_id": identifier,
        "event_family_id": identifier,
        "symbol": "BTCUSDT",
        "interval": "15m",
        "pivot_time": confirmation - pd.Timedelta(minutes=90),
        "confirmation_time": confirmation,
        "feature_cutoff_time": confirmation,
        "level": 100.0,
        "drop_atr": 2.0,
        "recovery_ratio": 0.8,
    }


class OutcomeTests(unittest.TestCase):
    def test_depth_horizons_trailing_and_censoring(self):
        times = pd.date_range("2026-01-01", periods=360, freq="1min", tz="UTC")
        frame = pd.DataFrame(
            {"time": times, "open": 101.0, "high": 101.1, "low": 100.9, "close": 101.0, "volume": 1.0}
        )
        frame.loc[31:60, ["open", "high", "low", "close"]] = [99.8, 99.9, 98.0, 98.5]
        frame.loc[61:89, ["open", "high", "low", "close"]] = [98.5, 99.8, 98.3, 99.5]
        frame.loc[90, ["open", "high", "low", "close"]] = [99.5, 100.4, 99.4, 100.2]
        frame.loc[331:, ["open", "high", "low", "close"]] = [99.5, 99.8, 98.8, 99.2]
        candidates = pd.DataFrame(
            [candidate("returned", times[30]), candidate("censored", times[330])]
        )
        result = label_outcomes(candidates, frame)
        returned = result[result["candidate_id"] == "returned"].iloc[0]
        censored = result[result["candidate_id"] == "censored"].iloc[0]
        self.assertTrue(returned["activated"])
        self.assertAlmostEqual(returned["mae_pct"], 2.0, places=8)
        self.assertTrue(returned["return_3h"])
        self.assertTrue(returned["depth_1_5_reached"])
        self.assertGreaterEqual(returned["trail_075_high_pct"], 0.4)
        self.assertIn("reclaim_000_trail_015_exit_pct", returned.index)
        self.assertIn("trail_atr_exit_pct", returned.index)
        self.assertIn("trail_swing_exit_pct", returned.index)
        self.assertTrue(censored["outcome_censored"])
        self.assertIsNone(censored["return_48h"])
        self.assertGreater(pd.Timestamp(returned["activation_time"]), times[30])

    def test_depth_reached_after_first_return_is_not_conditioned_as_pre_return(self):
        times = pd.date_range("2026-01-01", periods=180, freq="1min", tz="UTC")
        frame = pd.DataFrame(
            {"time": times, "open": 101.0, "high": 101.1, "low": 100.9, "close": 101.0, "volume": 1.0}
        )
        frame.loc[31, ["open", "high", "low", "close"]] = [100.5, 100.6, 99.0, 99.4]
        frame.loc[32, ["open", "high", "low", "close"]] = [99.4, 100.2, 99.0, 100.1]
        frame.loc[40, ["open", "high", "low", "close"]] = [100.2, 100.3, 95.0, 96.0]
        result = label_outcomes(pd.DataFrame([candidate("ordered-depth", times[30])]), frame)
        event = result.iloc[0]
        self.assertTrue(event["returned"])
        self.assertAlmostEqual(event["mae_pct"], 1.0)
        self.assertTrue(event["depth_1_0_reached"])
        self.assertFalse(event["depth_3_0_reached"])


if __name__ == "__main__":
    unittest.main()
