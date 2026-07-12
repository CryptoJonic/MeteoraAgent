from __future__ import annotations

MODEL_VERSION = "galka-lab-v0.2.0"
PACK_SCHEMA_VERSION = "1.1"
DATASET_SCHEMA_VERSION = "1.1"
SEED = 20260712

SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
PRIMARY_INTERVALS = ("5m", "15m")
ROBUSTNESS_INTERVALS = ("30m", "1h")
EXECUTION_INTERVAL = "1m"

INTERVAL_MS = {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
}

HORIZON_HOURS = (1, 3, 6, 12, 24, 48)
RECENT_WINDOWS_DAYS = (7, 30, 90, 180, 365)
DEPTH_THRESHOLDS_PCT = (
    0.15,
    0.30,
    0.45,
    0.60,
    0.75,
    1.00,
    1.25,
    1.50,
    2.00,
    2.50,
    3.00,
    3.50,
    5.00,
)
DEPTH_QUANTILES = (0.50, 0.75, 0.90, 0.95, 0.99)
TRAIL_DISTANCES_PCT = (0.15, 0.30, 0.50, 0.75, 1.00)
RECLAIM_BUFFERS_PCT = (0.00, 0.10, 0.20)

MAX_ACTIVATION_HOURS = 14 * 24
MAX_OUTCOME_HOURS = 14 * 24
POST_RECLAIM_HOURS = 48
MIN_SAMPLE = 40
BOOTSTRAP_SAMPLES = 400

MAKER_FEE = 0.0002
TAKER_FEE = 0.0005
SLIPPAGE = 0.0002
RECLAIM_BUFFER_PCT = 0.10

CANDIDATE = {
    "left_bars": 6,
    "right_bars": 6,
    "minimum_drop_atr": 0.80,
    "minimum_recovery_ratio": 0.25,
    "family_bars": 3,
    "family_price_atr": 0.25,
    "context_bars": 288,
}

CLUSTER_FEATURES = (
    "drop_atr",
    "recovery_ratio",
    "shoulder_balance",
    "fall_speed_atr",
    "recovery_speed_atr",
    "sharpness_atr",
    "base_width_bars",
    "near_low_bars",
    "wick_ratio",
    "close_lift_atr",
    "second_tests",
    "prior_touches",
    "atr_pct",
    "volume_ratio",
    "trend_slope_atr",
    "local_vs_market_1h",
)
