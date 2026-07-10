# Galka Result Package Specification v1.0

A full research result is delivered as one file named `*.galka.zip`.

## Archive contents

```text
manifest.json        required
candles.csv          required
patterns.csv         required
orders.csv           required
trades.csv           required
summary.json         optional
parameters.json      optional
```

All timestamps are UTC ISO-8601 strings or Unix seconds. Prices and quantities use decimal notation with `.` as separator. CSV files use UTF-8, a header row and comma delimiters.

## `manifest.json`

```json
{
  "schema_version": "1.0",
  "strategy": "Galka",
  "strategy_version": "galka-v0.1.0",
  "run_id": "btc-5m-wf-0001",
  "symbol": "BTCUSDT",
  "market": "Binance Futures",
  "timeframe": "5m",
  "timezone": "UTC",
  "created_at": "2026-07-10T12:00:00Z",
  "data_start": "2024-01-01T00:00:00Z",
  "data_end": "2025-12-31T23:55:00Z",
  "currency": "USDT",
  "price_precision": 2,
  "quantity_precision": 3,
  "fee_model": "maker 0.02%, taker 0.05%",
  "slippage_model": "configured in parameters.json",
  "lookahead_safe": true,
  "files": {
    "candles": "candles.csv",
    "patterns": "patterns.csv",
    "orders": "orders.csv",
    "trades": "trades.csv",
    "summary": "summary.json",
    "parameters": "parameters.json"
  }
}
```

## `candles.csv`

Required columns:

```text
time,open,high,low,close,volume
```

Rows must be strictly increasing by `time`; duplicate candles are forbidden.

## `patterns.csv`

Required columns:

```text
pattern_id,v_low_time,v_low_price,break_time,break_price,depth_limit_price,target_price,status
```

`status` examples: `traded`, `skipped`, `expired`, `invalidated`.

Optional diagnostic columns may follow, for example:

```text
left_leg_bars,right_leg_bars,recovery_pct,symmetry_score,volatility,filter_reason
```

## `orders.csv`

Required columns:

```text
order_id,trade_id,pattern_id,time,side,type,price,quantity,status,level,fee
```

Allowed baseline values:

- `side`: `buy` or `sell`;
- `type`: `limit`, `target`, `stop`, `forced_exit`;
- `status`: `planned`, `filled`, `partial`, `cancelled`, `missed`;
- `level`: integer ladder level starting from `1`.

Planned but unfilled limits must still be exported. This is required for visual auditing of the full ladder.

## `trades.csv`

Required columns:

```text
trade_id,pattern_id,entry_time,exit_time,average_entry,exit_price,quantity,gross_pnl,fees,net_pnl,net_pnl_pct,max_planned_loss,result,exit_reason
```

Recommended diagnostic columns:

```text
mae,mfe,bars_in_trade,filled_levels,total_levels,slippage,capital_used,model_score,fold
```

`result` values: `win`, `loss`, `breakeven`, `open`.

## `summary.json`

Recommended fields:

```json
{
  "patterns": 1000,
  "trades": 240,
  "wins": 150,
  "losses": 90,
  "win_rate": 0.625,
  "net_pnl": 1234.56,
  "profit_factor": 1.42,
  "max_drawdown": -480.10,
  "expectancy": 5.14,
  "average_planned_risk": 100.0,
  "out_of_sample": true
}
```

## Compact `.galka.json`

For small runs the same data may be stored in one JSON object:

```json
{
  "manifest": {},
  "candles": [],
  "patterns": [],
  "orders": [],
  "trades": [],
  "summary": {},
  "parameters": {}
}
```

## Invariants validated by the terminal

- each trade references an existing pattern;
- each order references an existing trade and pattern;
- first eligible buy occurs after the pattern break;
- no filled buy price is below `depth_limit_price`;
- planned maximum loss is positive and present;
- target equals `V-low` for the baseline model, or the run is labelled as an alternative exit experiment;
- candle times are ordered and unique.
