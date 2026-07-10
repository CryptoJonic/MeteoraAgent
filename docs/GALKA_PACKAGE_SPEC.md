# Galka Result Package Specification v1.1

A full research result is delivered as one file named `*.galka.zip`.

The terminal must remain backward compatible with compact v1.0 packages. Full-history research uses the extended v1.1 files so every detected candidate, decision and realized outcome can be audited.

## Archive contents

```text
manifest.json          required
candles.csv            required for compact runs
patterns.csv           required
orders.csv             required
trades.csv             required
features.csv           optional, recommended for research runs
predictions.csv        optional, recommended for research runs
groups.csv             optional, recommended for research runs
summary.json           optional
parameters.json        optional
model_card.json        optional
```

Large full-history packages may replace `candles.csv` with chunked candle files declared in `manifest.json`, for example `candles/BTCUSDT/5m/2024.csv`. The terminal must load only the visible/requested range rather than holding the complete multi-asset history in memory.

All timestamps are UTC ISO-8601 strings or Unix seconds. Prices and quantities use decimal notation with `.` as separator. CSV files use UTF-8, a header row and comma delimiters.

## `manifest.json`

```json
{
  "schema_version": "1.1",
  "strategy": "Galka",
  "strategy_version": "galka-v0.2.0",
  "model_version": "galka-classifier-v0.1.0",
  "run_id": "btc-5m-wf-0001",
  "symbol": "BTCUSDT",
  "asset": "BTC",
  "market": "configured execution market",
  "timeframe": "5m",
  "timezone": "UTC",
  "created_at": "2026-07-10T12:00:00Z",
  "data_start": "2024-01-01T00:00:00Z",
  "data_end": "2025-12-31T23:55:00Z",
  "currency": "USDT",
  "price_precision": 2,
  "quantity_precision": 3,
  "fee_model": "explicit maker/taker schedule",
  "slippage_model": "configured in parameters.json",
  "lookahead_safe": true,
  "outcome_fields_separated": true,
  "files": {
    "candles": "candles.csv",
    "patterns": "patterns.csv",
    "features": "features.csv",
    "predictions": "predictions.csv",
    "groups": "groups.csv",
    "orders": "orders.csv",
    "trades": "trades.csv",
    "summary": "summary.json",
    "parameters": "parameters.json",
    "model_card": "model_card.json"
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

Every causally detected Galka candidate is exported, including rejected, expired and untraded candidates.

Required columns:

```text
pattern_id,event_family_id,v_low_time,v_low_price,confirmation_time,break_time,break_price,depth_limit_price,target_price,status
```

`status` values:

```text
traded,accepted_unfilled,rejected,unknown,expired,invalidated
```

Recommended diagnostic columns:

```text
asset,timeframe,left_leg_start,left_leg_bars,right_leg_bars,recovery_pct,symmetry_score,volatility,regime,filter_reason,fold,sample_role
```

`sample_role` examples:

```text
train,validation,test,final_holdout
```

`event_family_id` groups overlapping or near-duplicate parameter detections belonging to the same underlying market event. Statistical sample counts must use independent event families, not raw pattern variants.

## `features.csv`

Contains only information available at decision time.

Required columns:

```text
pattern_id,feature_snapshot_time
```

All remaining columns are versioned model features, for example:

```text
v_depth_atr,left_leg_bars,right_leg_bars,symmetry,rebound_speed,prior_return_short,prior_return_long,range_percentile,trend_strength,volatility_percentile,volume_zscore,break_depth_atr,break_speed,time_from_confirmation
```

No future outcome, realized trade result, MAE, MFE or post-break maximum may appear in this file.

## `predictions.csv`

Stores the decision made using the feature snapshot.

Required columns:

```text
pattern_id,decision_time,decision_class,trade_allowed,risk_multiplier,p_return_vlow,p_lower,p_upper,expected_net_r,expected_tail_r,group_id,model_version,fold
```

Allowed `decision_class` values:

```text
A+,A,B,C,REJECT,UNKNOWN
```

Recommended explanation columns:

```text
top_positive_factors,top_negative_factors,rejection_reason,calibration_bucket
```

`risk_multiplier` may reduce the global configured risk but may not exceed `1.0` in research packages.

## `groups.csv`

Contains descriptive bins, discovered clusters and terminal-facing group statistics.

Required columns:

```text
group_id,group_type,name,description,independent_events,wins,losses,expired,p_raw,p_adjusted,p_lower,p_upper,mean_net_r,median_net_r,tail_loss_r,stability_score,decision_class
```

`group_type` examples:

```text
descriptive,cluster,rule,calibration_bucket
```

Small groups must use shrinkage/uncertainty adjustment. A perfect but tiny sample must not automatically receive a high decision class.

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
mae,mfe,bars_in_trade,filled_levels,total_levels,slippage,capital_used,model_score,decision_class,risk_multiplier,fold,sample_role
```

`result` values: `win`, `loss`, `breakeven`, `open`.

## Realized outcomes for every candidate

Research runs should include outcome columns in `patterns.csv` or a separately declared `outcomes.csv`:

```text
pattern_id,returned_to_vlow,target_before_stop,max_adverse_excursion,max_favorable_excursion,max_depth_below_vlow,time_to_target,time_to_stop,time_to_expiry,net_r_counterfactual,outcome_horizon
```

These fields are displayed in a visually separate realized-outcome panel. They may never be merged into `features.csv` or used at decision time.

## `summary.json`

Recommended fields:

```json
{
  "patterns": 1000,
  "independent_event_families": 630,
  "trades": 240,
  "rejected": 500,
  "unknown": 80,
  "wins": 150,
  "losses": 90,
  "win_rate": 0.625,
  "net_pnl": 1234.56,
  "net_r": 42.7,
  "profit_factor": 1.42,
  "max_drawdown": -480.10,
  "expectancy": 5.14,
  "average_planned_risk": 100.0,
  "calibration_error": 0.04,
  "out_of_sample": true
}
```

## `model_card.json`

Recommended fields:

```json
{
  "model_version": "galka-classifier-v0.1.0",
  "training_periods": [],
  "validation_periods": [],
  "final_holdout_period": {},
  "assets": ["BTC"],
  "timeframes": ["5m"],
  "feature_set_version": "features-v1",
  "tried_variants": 0,
  "known_limitations": [],
  "intended_use": "historical research and visual audit only",
  "live_trading_approved": false
}
```

## Compact `.galka.json`

For small runs the same data may be stored in one JSON object:

```json
{
  "manifest": {},
  "candles": [],
  "patterns": [],
  "features": [],
  "predictions": [],
  "groups": [],
  "orders": [],
  "trades": [],
  "outcomes": [],
  "summary": {},
  "parameters": {},
  "model_card": {}
}
```

## Invariants validated by the terminal

- each trade references an existing pattern;
- each order references an existing trade and pattern;
- each prediction references an existing pattern;
- first eligible buy occurs after the pattern break;
- no filled buy price is below `depth_limit_price`;
- planned maximum loss is positive and present;
- `risk_multiplier` is between `0` and `1`;
- target equals `V-low` for the baseline model, or the run is labelled as an alternative exit experiment;
- feature snapshots contain no declared future/outcome fields;
- candle times are ordered and unique;
- near-duplicate candidates share an `event_family_id`;
- final holdout events are never used to fit groups, thresholds or model parameters.
