from __future__ import annotations

import io
import time
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

from .config import INTERVAL_MS
from .utils import frame_hash, iso_utc, sha256_bytes, sha256_file

BASE_URL = "https://data.binance.vision/data/futures/um"
EARLIEST_SCAN = date(2019, 1, 1)
CSV_COLUMNS = (
    "open_time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "close_time",
    "quote_volume",
    "trades",
    "taker_buy_base",
    "taker_buy_quote",
    "ignore",
)


@dataclass(frozen=True)
class ArchiveRecord:
    name: str
    url: str
    path: str
    sha256: str
    bytes: int


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _next_month(value: date) -> date:
    return date(value.year + (value.month == 12), 1 if value.month == 12 else value.month + 1, 1)


def _month_end(value: date) -> date:
    return _next_month(_month_start(value)) - timedelta(days=1)


def iter_months(start: date, end: date):
    cursor = _month_start(start)
    while cursor <= end:
        yield cursor
        cursor = _next_month(cursor)


def latest_complete_day(now: datetime | None = None) -> date:
    current = now or datetime.now(timezone.utc)
    return current.date() - timedelta(days=1)


class BinanceArchiveCache:
    def __init__(self, root: Path, retries: int = 4):
        self.root = Path(root)
        self.retries = retries
        self.records: list[ArchiveRecord] = []

    def _request(self, url: str) -> bytes | None:
        for attempt in range(self.retries):
            try:
                request = Request(url, headers={"User-Agent": "GalkaLab/0.1 public-research"})
                with urlopen(request, timeout=90) as response:
                    return response.read()
            except HTTPError as error:
                if error.code == 404:
                    return None
                if attempt == self.retries - 1:
                    raise
            except (TimeoutError, URLError):
                if attempt == self.retries - 1:
                    raise
            time.sleep(2**attempt)
        return None

    def _local_path(self, cadence: str, symbol: str, interval: str, filename: str) -> Path:
        return self.root / "raw" / cadence / "klines" / symbol / interval / filename

    def fetch(self, cadence: str, symbol: str, interval: str, stamp: str) -> Path | None:
        filename = f"{symbol}-{interval}-{stamp}.zip"
        relative = f"{cadence}/klines/{symbol}/{interval}/{filename}"
        url = f"{BASE_URL}/{relative}"
        path = self._local_path(cadence, symbol, interval, filename)
        expected = None
        checksum_path = path.with_suffix(path.suffix + ".sha256")

        if checksum_path.exists():
            expected = checksum_path.read_text().strip().split()[0]
        elif path.exists():
            checksum = self._request(url + ".CHECKSUM")
            if checksum:
                expected = checksum.decode("utf-8").strip().split()[0]
                checksum_path.parent.mkdir(parents=True, exist_ok=True)
                checksum_path.write_text(expected + "\n")

        if path.exists() and (expected is None or sha256_file(path) == expected):
            digest = expected or sha256_file(path)
            self.records.append(ArchiveRecord(filename, url, str(path), digest, path.stat().st_size))
            return path

        blob = self._request(url)
        if blob is None:
            return None
        digest = sha256_bytes(blob)
        checksum = self._request(url + ".CHECKSUM")
        if checksum:
            expected = checksum.decode("utf-8").strip().split()[0]
            if digest != expected:
                raise ValueError(f"checksum mismatch for {filename}: {digest} != {expected}")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".part")
        temporary.write_bytes(blob)
        temporary.replace(path)
        checksum_path.write_text((expected or digest) + "\n")
        self.records.append(ArchiveRecord(filename, url, str(path), digest, len(blob)))
        return path

    def archives(self, symbol: str, interval: str, start: date, end: date) -> list[Path]:
        paths: list[Path] = []
        current_month = _month_start(datetime.now(timezone.utc).date())
        for month in iter_months(start, end):
            month_first = max(start, month)
            month_last = min(end, _month_end(month))
            monthly = None
            if month < current_month:
                monthly = self.fetch("monthly", symbol, interval, month.strftime("%Y-%m"))
            if monthly is not None:
                paths.append(monthly)
                continue
            # A missing old monthly archive means that contract/interval was not available yet.
            # Daily fallback is useful only for the latest completed month while Binance may still
            # be publishing its monthly bundle; probing every pre-listing day would be wasteful.
            previous_month = date(
                current_month.year - (current_month.month == 1),
                12 if current_month.month == 1 else current_month.month - 1,
                1,
            )
            if month < previous_month:
                continue
            cursor = month_first
            while cursor <= month_last:
                daily = self.fetch("daily", symbol, interval, cursor.isoformat())
                if daily is not None:
                    paths.append(daily)
                cursor += timedelta(days=1)
        return paths


def parse_archive(path: Path) -> pd.DataFrame:
    with zipfile.ZipFile(path) as archive:
        csv_name = next((name for name in archive.namelist() if name.endswith(".csv")), None)
        if csv_name is None:
            raise ValueError(f"no CSV in {path}")
        raw = archive.read(csv_name)
    frame = pd.read_csv(io.BytesIO(raw), header=None, names=CSV_COLUMNS, low_memory=False)
    for column in ("open_time", "open", "high", "low", "close", "volume"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=("open_time", "open", "high", "low", "close", "volume"))
    divisor = 1_000_000 if frame["open_time"].median() > 1e14 else 1_000
    frame["time"] = pd.to_datetime(frame["open_time"] / divisor, unit="s", utc=True)
    return frame[["time", "open", "high", "low", "close", "volume"]]


def validate_market_data(frame: pd.DataFrame, interval: str) -> dict:
    if interval not in INTERVAL_MS:
        raise ValueError(f"unsupported interval {interval}")
    if frame.empty:
        raise ValueError(f"empty {interval} frame")
    times = pd.to_datetime(frame["time"], utc=True).astype("int64").to_numpy() // 1_000_000
    differences = np.diff(times)
    expected = INTERVAL_MS[interval]
    duplicates = int(pd.Series(times).duplicated().sum())
    backwards = int((differences < 0).sum())
    gap_mask = differences > expected
    gap_indices = np.flatnonzero(gap_mask)
    missing = int(np.maximum(differences[gap_mask] // expected - 1, 0).sum()) if gap_mask.any() else 0
    invalid_ohlc = int(
        (
            (frame["high"] < frame[["open", "close"]].max(axis=1))
            | (frame["low"] > frame[["open", "close"]].min(axis=1))
            | (frame["high"] < frame["low"])
            | (frame[["open", "high", "low", "close"]] <= 0).any(axis=1)
        ).sum()
    )
    return {
        "row_count": int(len(frame)),
        "duplicates": duplicates,
        "backwards": backwards,
        "gaps": int(gap_mask.sum()),
        "missing_bars": missing,
        "gap_ranges": [
            {
                "after": iso_utc(frame["time"].iloc[int(index)]),
                "before": iso_utc(frame["time"].iloc[int(index) + 1]),
                "missing_bars": int(max(differences[int(index)] // expected - 1, 0)),
            }
            for index in gap_indices
        ],
        "invalid_ohlc": invalid_ohlc,
        "start": iso_utc(frame["time"].iloc[0]),
        "end": iso_utc(frame["time"].iloc[-1]),
        "hash": frame_hash(frame),
    }


def load_market_data(
    cache: BinanceArchiveCache,
    symbol: str,
    interval: str,
    start: date | str = "auto",
    end: date | str = "latest",
) -> tuple[pd.DataFrame, dict]:
    start_date = EARLIEST_SCAN if start == "auto" else (date.fromisoformat(start) if isinstance(start, str) else start)
    end_date = latest_complete_day() if end == "latest" else (date.fromisoformat(end) if isinstance(end, str) else end)
    paths = cache.archives(symbol, interval, start_date, end_date)
    if not paths:
        raise RuntimeError(f"no Binance archives for {symbol} {interval}")
    parts = [parse_archive(path) for path in paths]
    raw = pd.concat(parts, ignore_index=True)
    duplicate_count = int(raw["time"].duplicated().sum())
    source_time = pd.to_datetime(raw["time"], utc=True).astype("int64").to_numpy()
    source_backwards = int((np.diff(source_time) < 0).sum())
    frame = raw.sort_values("time").drop_duplicates("time", keep="last")
    dates = frame["time"].dt.date
    frame = frame[(dates >= start_date) & (dates <= end_date)].reset_index(drop=True)
    validation = validate_market_data(frame, interval)
    validation["duplicates_removed"] = duplicate_count
    validation["source_backwards"] = source_backwards
    validation.update(
        {
            "symbol": symbol,
            "interval": interval,
            "source": "Binance USD-M Futures public archive",
            "archive_count": len(paths),
            "archives": [
                record.__dict__
                for record in cache.records
                if record.name.startswith(f"{symbol}-{interval}-")
            ],
        }
    )
    return frame, validation
