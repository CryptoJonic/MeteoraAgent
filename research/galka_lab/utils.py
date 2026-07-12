from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def frame_hash(frame: pd.DataFrame) -> str:
    columns = ("time", "open", "high", "low", "close", "volume")
    digest = hashlib.sha256()
    time_values = pd.to_datetime(frame["time"], utc=True).astype("int64").to_numpy(dtype="<i8")
    digest.update(np.ascontiguousarray(time_values).tobytes())
    for column in columns[1:]:
        values = frame[column].to_numpy(dtype="<f8", copy=False)
        digest.update(np.ascontiguousarray(values).tobytes())
    return digest.hexdigest()


def iso_utc(value: Any) -> str:
    return pd.Timestamp(value).tz_convert("UTC").isoformat().replace("+00:00", "Z")


def safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if np.isfinite(parsed) else fallback


def write_json(path: Path, value: Any, *, indent: int = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=indent, sort_keys=True) + "\n")
