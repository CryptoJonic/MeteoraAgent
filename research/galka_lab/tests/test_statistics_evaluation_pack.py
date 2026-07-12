from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

import numpy as np

from galka_lab.evaluation import derive_grid_profiles, evaluate_profiles
from galka_lab.pack import build_terminal_pack, verify_terminal_pack, write_terminal_pack
from galka_lab.statistics import (
    block_bootstrap_statistics,
    build_statistics,
    conditional_return_curves,
    wilson_interval,
)
from galka_lab.tests.helpers import feature_rows
from galka_lab.utils import sha256_file


class StatisticsEvaluationPackTests(unittest.TestCase):
    def setUp(self):
        self.events = feature_rows(480)
        self.events["galka_type"] = [f"Type {index % 4}" for index in range(len(self.events))]
        self.events["cluster_id"] = np.arange(len(self.events)) % 4

    def test_conditional_probability_and_censoring(self):
        curves = conditional_return_curves(self.events)
        row = curves[(curves["depth_pct"] == 0.15) & (curves["horizon_hours_after_depth"] == 24)].iloc[0]
        self.assertGreater(row["observed_count"], 0)
        self.assertGreaterEqual(row["return_probability"], 0)
        self.assertLessEqual(row["return_probability"], 1)
        low, high = wilson_interval(50, 100)
        self.assertLess(low, 0.5)
        self.assertGreater(high, 0.5)

    def test_grid_stop_fee_accounting_and_pack_checksum(self):
        profiles = derive_grid_profiles(self.events)
        evaluated, evaluation = evaluate_profiles(self.events, profiles)
        filled = evaluated[evaluated["balanced_fill_fraction"] > 0]
        self.assertTrue(len(filled))
        self.assertTrue((filled["balanced_levels_filled"] >= 1).all())
        self.assertIn("stop_hybrid_net_return_pct", evaluated)
        self.assertIn("balanced_return_on_filled_pct", evaluated)
        self.assertTrue(all(profile["paper_only"] for groups in profiles.values() for profile in groups.values()))
        self.assertTrue(all("density_weights" in profile for groups in profiles.values() for profile in groups.values()))
        self.assertTrue(evaluation["trailing_summary"])
        self.assertTrue(all("fill_probability" in row for row in evaluation["grid_summary"]))
        statistics = build_statistics(evaluated)
        manifest = {"start": "2020-01-01", "end": "2026-01-01", "symbols": ["BTCUSDT"], "intervals": ["15m"], "manifest_hash": "abc"}
        model = {"model_hash": "m", "selected_k": 4}
        pack = build_terminal_pack(statistics=statistics, model=model, evaluation=evaluation, manifest=manifest, generated_at="2026-07-12T00:00:00Z")
        self.assertTrue(verify_terminal_pack(pack))
        self.assertEqual(pack["schemaVersion"], "1.2")
        self.assertTrue(pack["statistics"]["blockBootstrap"])
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.json"
            second = Path(directory) / "second.json"
            write_terminal_pack(first, pack)
            write_terminal_pack(second, pack)
            self.assertEqual(
                sha256_file(first.with_suffix(".json.gz")),
                sha256_file(second.with_suffix(".json.gz")),
            )
        tampered = copy.deepcopy(pack)
        tampered["safety"]["autoPaperDefault"] = True
        self.assertFalse(verify_terminal_pack(tampered))
        self.assertFalse(pack["safety"]["autoPaperDefault"])

    def test_candidate_ev_keeps_no_fill_as_cash_and_excludes_censoring(self):
        events = self.events.copy()
        events.loc[0, ["activated", "returned", "activation_censored"]] = [
            False,
            False,
            False,
        ]
        events.loc[0, "mae_pct"] = np.nan
        events.loc[1, "mae_pct"] = 0.05
        events.loc[2, ["activated", "returned", "activation_censored"]] = [
            False,
            False,
            True,
        ]
        events.loc[2, "mae_pct"] = np.nan

        profiles = derive_grid_profiles(events)
        evaluated, evaluation = evaluate_profiles(events, profiles)

        no_activation = evaluated.loc[0]
        shallow_activation = evaluated.loc[1]
        censored = evaluated.loc[2]
        self.assertTrue(no_activation["strategy_evaluable"])
        self.assertEqual(no_activation["balanced_net_return_pct"], 0.0)
        self.assertEqual(no_activation["balanced_fixed_risk_r"], 0.0)
        self.assertEqual(no_activation["stop_fixed_net_return_pct"], 0.0)
        self.assertEqual(no_activation["exit_galka_tp_48h_net_return_pct"], 0.0)
        self.assertTrue(np.isnan(no_activation["balanced_return_on_filled_pct"]))
        self.assertEqual(shallow_activation["balanced_fill_fraction"], 0.0)
        self.assertEqual(shallow_activation["balanced_net_return_pct"], 0.0)
        self.assertFalse(censored["strategy_evaluable"])
        self.assertTrue(np.isnan(censored["balanced_net_return_pct"]))
        self.assertTrue(
            all("fill_probability_given_activation" in row for row in evaluation["grid_summary"])
        )
        self.assertTrue(
            all(row["count"] == row["eligible_count"] for row in evaluation["grid_summary"])
        )

    def test_day_block_bootstrap_is_deterministic_and_symbol_isolated(self):
        events = self.events.copy()
        final_oos = events["split"] == "final_oos"
        for symbol, probability in (("BTCUSDT", 1.0), ("ETHUSDT", 0.0), ("SOLUSDT", 0.5)):
            selected = final_oos & (events["symbol"] == symbol)
            indices = events.index[selected]
            successes = np.arange(len(indices)) < round(len(indices) * probability)
            for hours in (1, 3, 6, 12, 24, 48):
                events.loc[indices, f"return_{hours}h"] = successes
            events.loc[indices, "returned"] = successes

        first = block_bootstrap_statistics(events)
        second = block_bootstrap_statistics(events)
        self.assertTrue(first.equals(second))
        symbol_oos = first[
            (first["scope"] == "symbol") & (first["split"] == "final_oos")
        ]
        self.assertEqual(set(symbol_oos["symbol"]), {"BTCUSDT", "ETHUSDT", "SOLUSDT"})
        probabilities = symbol_oos.groupby("symbol")["return_24h_probability"].mean()
        self.assertGreater(probabilities["BTCUSDT"], probabilities["SOLUSDT"])
        self.assertGreater(probabilities["SOLUSDT"], probabilities["ETHUSDT"])
        cross_symbol = first[
            (first["scope"] == "cross_symbol") & (first["split"] == "final_oos")
        ]
        self.assertTrue((cross_symbol["block_unit"] == "UTC day").all())
        self.assertTrue((cross_symbol["bootstrap_samples"] == 400).all())
        self.assertTrue(
            (
                cross_symbol["return_24h_block_ci_low"]
                <= cross_symbol["return_24h_block_ci_high"]
            ).all()
        )


if __name__ == "__main__":
    unittest.main()
