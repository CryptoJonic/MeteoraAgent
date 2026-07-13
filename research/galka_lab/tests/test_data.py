from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import pandas as pd

from galka_lab.cli import canonical_manifest_datasets
from galka_lab.config import EXECUTION_INTERVAL
from galka_lab.data import validate_market_data
from galka_lab.utils import canonical_json, frame_hash, sha256_bytes, sha256_file, write_gzip_csv


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
        self.assertEqual(first["gap_ranges"][0]["after"], "2026-01-01T00:01:00Z")
        self.assertEqual(first["gap_ranges"][0]["before"], "2026-01-01T00:03:00Z")
        self.assertEqual(first["invalid_ohlc"], 0)
        self.assertEqual(first["hash"], second["hash"])
        self.assertEqual(first["hash"], frame_hash(frame))

    def test_manifest_hash_ignores_parallel_completion_order(self):
        datasets = [
            {
                "symbol": symbol,
                "interval": interval,
                "start": "2026-01-01",
                "end": "2026-01-02",
                "hash": f"{symbol}-{interval}",
            }
            for interval in ("5m", "15m", EXECUTION_INTERVAL)
            for symbol in ("BTCUSDT", "ETHUSDT")
        ]
        symbols = ("BTCUSDT", "ETHUSDT")
        intervals = ("5m", "15m")
        first = canonical_manifest_datasets(datasets, symbols, intervals)
        second = canonical_manifest_datasets(list(reversed(datasets)), symbols, intervals)
        self.assertEqual(first, second)
        self.assertEqual(
            sha256_bytes(canonical_json({"datasets": first}).encode("utf-8")),
            sha256_bytes(canonical_json({"datasets": second}).encode("utf-8")),
        )
        self.assertEqual(
            [(item["interval"], item["symbol"]) for item in first],
            [
                ("5m", "BTCUSDT"),
                ("5m", "ETHUSDT"),
                ("15m", "BTCUSDT"),
                ("15m", "ETHUSDT"),
                (EXECUTION_INTERVAL, "BTCUSDT"),
                (EXECUTION_INTERVAL, "ETHUSDT"),
            ],
        )

    def test_gzip_csv_is_byte_reproducible(self):
        frame = pd.DataFrame({"value": [1, 2], "label": ["a", "b"]})
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.csv.gz"
            second = Path(directory) / "second.csv.gz"
            write_gzip_csv(first, frame)
            write_gzip_csv(second, frame)
            self.assertEqual(sha256_file(first), sha256_file(second))
            self.assertEqual(
                pd.read_csv(first).to_dict(orient="records"),
                frame.to_dict(orient="records"),
            )


if __name__ == "__main__":
    unittest.main()
