# Galka Lab interim statistical report

Model: `galka-lab-v0.3.0` · hash `3599937fcd0bfe6b584cb3f41531be549027db405c7463330b13e062a0cf17a2`.

This report is generated after dataset/outcome construction and before UI integration. Final OOS rows were not used to choose the cluster count, centroids, grids, or stops.

## Data inventory

- Range: 2020-01-01T00:00:00Z → 2026-07-12T23:59:00Z
- Symbols: BTCUSDT, ETHUSDT, SOLUSDT
- Candidate intervals: 5m, 15m, 30m, 1h
- Execution interval: 1m
- Broad candidates: 172,736
- Independent within-timeframe family representatives: 169,310
- Embargo-purged family events: 1,119
- Retained statistical events: 168,209
- Activated events: 157,602
- Censored outcomes: 8

## Chronological split inventory

| split | count_candidates | count_activated | count_complete | return_24h_probability | insufficient_data |
|---|---|---|---|---|---|
| final_oos | 34880 | 32864 | 32859 | 0.9823 | False |
| train | 100047 | 93372 | 93369 | 0.9818 | False |
| validation | 33282 | 31366 | 31366 | 0.9845 | False |

## Cluster selection (train + validation only)

| k | train_silhouette | validation_silhouette | stability_ari | minimum_cluster | sample_ok | selection_score |
|---|---|---|---|---|---|---|
| 4 | 0.1441 | 0.1533 | 0.9964 | 6412 | True | 0.3600 |
| 5 | 0.0968 | 0.1086 | 0.9988 | 5450 | True | 0.3259 |
| 6 | 0.0940 | 0.1051 | 0.9988 | 4029 | True | 0.3235 |
| 7 | 0.0852 | 0.0966 | 0.9068 | 3435 | True | 0.2940 |

## Final OOS type summary

| galka_type | count_complete | return_1h_probability | return_3h_probability | return_6h_probability | return_12h_probability | return_24h_probability | return_48h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p50 | depth_success_p75 | depth_success_p90 | depth_success_p95 | depth_success_p99 | return_minutes_p50 | return_minutes_p75 | return_minutes_p90 | mae_mean_pct | mfe_after_return_mean_pct | mfe_after_reclaim_mean_pct | insufficient_data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9396 | 0.9404 | 0.9648 | 0.9759 | 0.9818 | 0.9860 | 0.9897 | 0.9834 | 0.9881 | 0.0857 | 0.2252 | 0.5681 | 1.0176 | 4.2120 | 1.0000 | 2.0000 | 16.0000 | 0.3662 | 3.4273 | 3.5230 | False |
| Multi-test | 18097 | 0.9416 | 0.9596 | 0.9694 | 0.9766 | 0.9820 | 0.9871 | 0.9799 | 0.9838 | 0.0962 | 0.2591 | 0.6441 | 1.2187 | 4.6414 | 0.7500 | 2.0000 | 14.0000 | 0.4710 | 3.4636 | 3.5499 | False |
| Fast V | 1987 | 0.9507 | 0.9653 | 0.9728 | 0.9774 | 0.9799 | 0.9854 | 0.9727 | 0.9852 | 0.0924 | 0.2378 | 0.5598 | 1.0459 | 3.5559 | 0.2500 | 1.0000 | 8.0000 | 0.4880 | 3.3474 | 3.4136 | False |
| Deep capitulation | 3379 | 0.9376 | 0.9485 | 0.9562 | 0.9680 | 0.9751 | 0.9831 | 0.9693 | 0.9799 | 0.1365 | 0.3199 | 0.7322 | 1.3754 | 6.3343 | 0.7500 | 2.0000 | 11.0000 | 0.6041 | 3.3132 | 3.3972 | False |

## Data-quality gates

Every source interval is hashed and checked for duplicates, chronology, gaps, and OHLC validity. Candidate context never crosses a source-data gap. Rows below the minimum sample threshold are marked insufficient rather than promoted as evidence.

| symbol | interval | rows | start | end | gaps | missing_bars | duplicates | invalid_ohlc |
|---|---|---|---|---|---|---|---|---|
| BTCUSDT | 5m | 686880 | 2020-01-01T00:00:00Z | 2026-07-12T23:55:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 5m | 686880 | 2020-01-01T00:00:00Z | 2026-07-12T23:55:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 5m | 611340 | 2020-09-14T07:00:00Z | 2026-07-12T23:55:00Z | 2 | 1440 | 0 | 0 |
| BTCUSDT | 15m | 228960 | 2020-01-01T00:00:00Z | 2026-07-12T23:45:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 15m | 228960 | 2020-01-01T00:00:00Z | 2026-07-12T23:45:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 15m | 203780 | 2020-09-14T07:00:00Z | 2026-07-12T23:45:00Z | 2 | 480 | 0 | 0 |
| BTCUSDT | 30m | 114480 | 2020-01-01T00:00:00Z | 2026-07-12T23:30:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 30m | 114480 | 2020-01-01T00:00:00Z | 2026-07-12T23:30:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 30m | 101890 | 2020-09-14T07:00:00Z | 2026-07-12T23:30:00Z | 2 | 240 | 0 | 0 |
| BTCUSDT | 1h | 57240 | 2020-01-01T00:00:00Z | 2026-07-12T23:00:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 1h | 57240 | 2020-01-01T00:00:00Z | 2026-07-12T23:00:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 1h | 50945 | 2020-09-14T07:00:00Z | 2026-07-12T23:00:00Z | 2 | 120 | 0 | 0 |
| BTCUSDT | 1m | 3434400 | 2020-01-01T00:00:00Z | 2026-07-12T23:59:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 1m | 3434400 | 2020-01-01T00:00:00Z | 2026-07-12T23:59:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 1m | 3056700 | 2020-09-14T07:00:00Z | 2026-07-12T23:59:00Z | 2 | 7200 | 0 | 0 |

## Interim warning

Type names are human-readable labels for train-fitted centroids, not causal market laws. A strong in-sample cluster is not accepted unless walk-forward and final OOS remain directionally consistent.
