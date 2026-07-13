# Galka Lab interim statistical report

Model: `galka-lab-v0.3.0` · hash `b572451d8e65411f64bd9ad2dba18dfc78fa9bf23a3d9eef92373e9fc85db1de`.

This report is generated after dataset/outcome construction and before UI integration. Final OOS rows were not used to choose the cluster count, centroids, grids, or stops.

## Data inventory

- Range: 2020-01-01T00:00:00Z → 2026-07-11T23:59:00Z
- Symbols: BTCUSDT, ETHUSDT, SOLUSDT
- Candidate intervals: 5m, 15m, 30m, 1h
- Execution interval: 1m
- Broad candidates: 172,657
- Independent within-timeframe family representatives: 169,235
- Embargo-purged family events: 1,155
- Retained statistical events: 168,099
- Activated events: 157,499
- Censored outcomes: 12

## Chronological split inventory

| split | count_candidates | count_activated | count_complete | return_24h_probability | insufficient_data |
|---|---|---|---|---|---|
| final_oos | 34863 | 32854 | 32845 | 0.9822 | False |
| train | 100021 | 93346 | 93343 | 0.9817 | False |
| validation | 33215 | 31299 | 31299 | 0.9845 | False |

## Cluster selection (train + validation only)

| k | train_silhouette | validation_silhouette | stability_ari | minimum_cluster | sample_ok | selection_score |
|---|---|---|---|---|---|---|
| 4 | 0.1453 | 0.1500 | 0.9926 | 6381 | True | 0.3585 |
| 5 | 0.0976 | 0.1076 | 0.9946 | 5457 | True | 0.3249 |
| 6 | 0.0937 | 0.1053 | 0.9962 | 4027 | True | 0.3228 |
| 7 | 0.0863 | 0.0941 | 0.8961 | 3541 | True | 0.2911 |

## Final OOS type summary

| galka_type | count_complete | return_1h_probability | return_3h_probability | return_6h_probability | return_12h_probability | return_24h_probability | return_48h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p50 | depth_success_p75 | depth_success_p90 | depth_success_p95 | depth_success_p99 | return_minutes_p50 | return_minutes_p75 | return_minutes_p90 | mae_mean_pct | mfe_after_return_mean_pct | mfe_after_reclaim_mean_pct | insufficient_data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9403 | 0.9645 | 0.9757 | 0.9816 | 0.9858 | 0.9895 | 0.9832 | 0.9880 | 0.0855 | 0.2252 | 0.5668 | 1.0175 | 4.2319 | 1.0000 | 2.0000 | 16.3750 | 0.3696 | 3.4396 | 3.5363 | False |
| Multi-test | 18088 | 0.9420 | 0.9600 | 0.9699 | 0.9770 | 0.9820 | 0.9870 | 0.9799 | 0.9838 | 0.0962 | 0.2589 | 0.6428 | 1.2051 | 4.6462 | 0.7500 | 2.0000 | 14.0000 | 0.4716 | 3.4692 | 3.5558 | False |
| Fast V | 1969 | 0.9507 | 0.9650 | 0.9726 | 0.9771 | 0.9797 | 0.9853 | 0.9725 | 0.9850 | 0.0924 | 0.2355 | 0.5586 | 1.0531 | 3.6100 | 0.2500 | 1.0000 | 8.0000 | 0.4905 | 3.3567 | 3.4237 | False |
| Deep capitulation | 3434 | 0.9377 | 0.9490 | 0.9569 | 0.9685 | 0.9752 | 0.9834 | 0.9695 | 0.9799 | 0.1367 | 0.3208 | 0.7186 | 1.3727 | 6.0847 | 0.7500 | 2.0000 | 11.4500 | 0.5994 | 3.3250 | 3.4077 | False |

## Data-quality gates

Every source interval is hashed and checked for duplicates, chronology, gaps, and OHLC validity. Candidate context never crosses a source-data gap. Rows below the minimum sample threshold are marked insufficient rather than promoted as evidence.

| symbol | interval | rows | start | end | gaps | missing_bars | duplicates | invalid_ohlc |
|---|---|---|---|---|---|---|---|---|
| BTCUSDT | 5m | 686592 | 2020-01-01T00:00:00Z | 2026-07-11T23:55:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 5m | 686592 | 2020-01-01T00:00:00Z | 2026-07-11T23:55:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 5m | 611052 | 2020-09-14T07:00:00Z | 2026-07-11T23:55:00Z | 2 | 1440 | 0 | 0 |
| BTCUSDT | 15m | 228864 | 2020-01-01T00:00:00Z | 2026-07-11T23:45:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 15m | 228864 | 2020-01-01T00:00:00Z | 2026-07-11T23:45:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 15m | 203684 | 2020-09-14T07:00:00Z | 2026-07-11T23:45:00Z | 2 | 480 | 0 | 0 |
| BTCUSDT | 30m | 114432 | 2020-01-01T00:00:00Z | 2026-07-11T23:30:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 30m | 114432 | 2020-01-01T00:00:00Z | 2026-07-11T23:30:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 30m | 101842 | 2020-09-14T07:00:00Z | 2026-07-11T23:30:00Z | 2 | 240 | 0 | 0 |
| BTCUSDT | 1h | 57216 | 2020-01-01T00:00:00Z | 2026-07-11T23:00:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 1h | 57216 | 2020-01-01T00:00:00Z | 2026-07-11T23:00:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 1h | 50921 | 2020-09-14T07:00:00Z | 2026-07-11T23:00:00Z | 2 | 120 | 0 | 0 |
| BTCUSDT | 1m | 3432960 | 2020-01-01T00:00:00Z | 2026-07-11T23:59:00Z | 0 | 0 | 0 | 0 |
| ETHUSDT | 1m | 3432960 | 2020-01-01T00:00:00Z | 2026-07-11T23:59:00Z | 0 | 0 | 0 | 0 |
| SOLUSDT | 1m | 3055260 | 2020-09-14T07:00:00Z | 2026-07-11T23:59:00Z | 2 | 7200 | 0 | 0 |

## Interim warning

Type names are human-readable labels for train-fitted centroids, not causal market laws. A strong in-sample cluster is not accepted unless walk-forward and final OOS remain directionally consistent.
