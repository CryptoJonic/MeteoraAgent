from __future__ import annotations

import unittest
from io import StringIO

import pandas as pd

from galka_lab.clustering import apply_types, fit_types
from galka_lab.splits import assert_oos_isolation, assign_chronological_splits, walk_forward_splits
from galka_lab.tests.helpers import feature_rows
from galka_lab.validation import walk_forward_validate


class SplitClusteringTests(unittest.TestCase):
    def test_chronological_split_and_walk_forward(self):
        frame = feature_rows(480).drop(columns="split")
        split = assign_chronological_splits(frame)
        assert_oos_isolation(split)
        for _, group in split.groupby(["symbol", "interval"]):
            self.assertLessEqual(
                group[group["split"] != "final_oos"]["confirmation_time"].max(),
                group[group["split"] == "final_oos"]["confirmation_time"].min(),
            )
        folds = walk_forward_splits(split, folds=3)
        self.assertTrue(folds)
        self.assertTrue(all(fold["train_end"] < fold["validation_start"] for fold in folds))

    def test_cluster_reproducibility_and_oos_prediction(self):
        frame = feature_rows(480)
        first = fit_types(frame, minimum_k=4, maximum_k=4)
        second = fit_types(frame, minimum_k=4, maximum_k=4)
        self.assertEqual(first.model["model_hash"], second.model["model_hash"])
        self.assertEqual(first.events["cluster_id"].tolist(), second.events["cluster_id"].tolist())
        self.assertEqual(first.model["selected_k"], 4)
        round_trip = pd.read_csv(StringIO(frame.to_csv(index=False)), parse_dates=["confirmation_time"])
        from_csv = fit_types(round_trip, minimum_k=4, maximum_k=4)
        self.assertEqual(first.model["model_hash"], from_csv.model["model_hash"])
        predicted = apply_types(frame[frame["split"] == "final_oos"], first.model)
        self.assertEqual(predicted["galka_type"].nunique(), 4)

    def test_walk_forward_keeps_equal_timestamps_in_one_side(self):
        frame = feature_rows(480)
        frame.loc[1::2, "confirmation_time"] = frame.loc[::2, "confirmation_time"].to_numpy()
        rows = walk_forward_validate(frame, selected_k=4, folds=3)
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(row["train_end"] < row["validation_start"] for row in rows))


if __name__ == "__main__":
    unittest.main()
