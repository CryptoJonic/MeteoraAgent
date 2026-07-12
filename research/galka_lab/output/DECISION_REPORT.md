# Galka Lab decision report

## Promotion decision

Return frequency is not treated as profitability. A type is not eligible for auto-paper when its fee-adjusted Balanced fixed-notional OOS EV or fixed-risk result is non-positive. Live shadow validation remains mandatory even after a historical threshold passes.

| galka_type | count_complete | return_24h_probability | mean_net_return_pct | mean_fixed_risk_r | cvar_95_pct | historical_screen_pass | auto_paper_eligible | decision |
|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9858 | -0.0319 | -0.0354 | -4.3890 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Multi-test | 18088 | 0.9820 | -0.0366 | -0.0106 | -4.3934 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Fast V | 1969 | 0.9797 | -0.1041 | -0.0262 | -5.4898 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Deep capitulation | 3434 | 0.9752 | -0.0850 | -0.0140 | -5.0021 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |

Auto-paper remains disabled; this report cannot enable it.

## Most stable observational return types on untouched final OOS

| galka_type | count_complete | return_6h_probability | return_24h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p75 | depth_success_p90 | depth_success_p95 | depth_success_p99 | return_minutes_p50 |
|---|---|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9757 | 0.9858 | 0.9832 | 0.9880 | 0.2252 | 0.5668 | 1.0175 | 4.2319 | 1.0000 |
| Multi-test | 18088 | 0.9699 | 0.9820 | 0.9799 | 0.9838 | 0.2589 | 0.6428 | 1.2051 | 4.6462 | 0.7500 |
| Fast V | 1969 | 0.9726 | 0.9797 | 0.9725 | 0.9850 | 0.2355 | 0.5586 | 1.0531 | 3.6100 | 0.2500 |

## Types that should not be promoted

| galka_type | count_complete | return_24h_probability | mean_net_return_pct | mean_fixed_risk_r | cvar_95_pct | decision |
|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9858 | -0.0319 | -0.0354 | -4.3890 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Multi-test | 18088 | 0.9820 | -0.0366 | -0.0106 | -4.3934 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Fast V | 1969 | 0.9797 | -0.1041 | -0.0262 | -5.4898 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Deep capitulation | 3434 | 0.9752 | -0.0850 | -0.0140 | -5.0021 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |

## Significant conditional-return cliffs (≥5 percentage points)

| symbol | interval | galka_type | window | cliff_depth_pct | probability_before | probability_after | probability_drop | significant_cliff | insufficient_data |
|---|---|---|---|---|---|---|---|---|---|
| BTCUSDT | 15m | Deep capitulation | all | 0.3000 | 0.9352 | 0.8627 | 0.0724 | True | False |
| BTCUSDT | 15m | Multi-test | all | 1.2500 | 0.7302 | 0.6600 | 0.0702 | True | False |
| BTCUSDT | 15m | Rounded recovery | all | 0.7500 | 0.8065 | 0.7143 | 0.0922 | True | False |
| BTCUSDT | 30m | Multi-test | all | 0.6000 | 0.8452 | 0.7833 | 0.0619 | True | False |
| BTCUSDT | 5m | Deep capitulation | all | 0.4500 | 0.9091 | 0.8269 | 0.0822 | True | False |
| BTCUSDT | 5m | Fast V | all | 0.3000 | 0.9184 | 0.8519 | 0.0665 | True | False |
| BTCUSDT | 5m | Multi-test | all | 2.0000 | 0.5185 | 0.3333 | 0.1852 | True | False |
| BTCUSDT | 5m | Rounded recovery | all | 1.0000 | 0.7500 | 0.6620 | 0.0880 | True | False |
| ETHUSDT | 15m | Deep capitulation | all | 0.6000 | 0.8764 | 0.8197 | 0.0567 | True | False |
| ETHUSDT | 15m | Multi-test | all | 2.0000 | 0.6842 | 0.5400 | 0.1442 | True | False |
| ETHUSDT | 30m | Deep capitulation | all | 0.6000 | 0.8393 | 0.7750 | 0.0643 | True | False |
| ETHUSDT | 30m | Multi-test | all | 1.2500 | 0.7541 | 0.6512 | 0.1029 | True | False |
| ETHUSDT | 5m | Deep capitulation | all | 1.0000 | 0.8023 | 0.7302 | 0.0722 | True | False |
| ETHUSDT | 5m | Multi-test | all | 5.0000 | 0.2410 | 0.1129 | 0.1281 | True | False |
| ETHUSDT | 5m | Rounded recovery | all | 1.2500 | 0.7652 | 0.6860 | 0.0792 | True | False |
| SOLUSDT | 15m | Deep capitulation | all | 0.3000 | 0.9314 | 0.8750 | 0.0564 | True | False |
| SOLUSDT | 15m | Multi-test | all | 2.0000 | 0.6104 | 0.5238 | 0.0866 | True | False |
| SOLUSDT | 15m | Rounded recovery | all | 1.0000 | 0.8873 | 0.8333 | 0.0540 | True | False |
| SOLUSDT | 1h | Multi-test | all | 0.7500 | 0.7857 | 0.7333 | 0.0524 | True | False |
| SOLUSDT | 30m | Multi-test | all | 1.0000 | 0.7662 | 0.6667 | 0.0996 | True | False |
| SOLUSDT | 5m | Deep capitulation | all | 1.0000 | 0.8197 | 0.7556 | 0.0641 | True | False |
| SOLUSDT | 5m | Fast V | all | 0.3000 | 0.9106 | 0.8226 | 0.0880 | True | False |
| SOLUSDT | 5m | Multi-test | all | 5.0000 | 0.3000 | 0.1509 | 0.1491 | True | False |
| SOLUSDT | 5m | Rounded recovery | all | 2.0000 | 0.6667 | 0.5593 | 0.1073 | True | False |

The full conditional depth × horizon table, including recovery time and probability of the next deeper band, is retained in the JSON outputs and terminal pack.

## Statistically dense entry zones and normalized risk

| galka_type | profile | statistically_dense_zones | maximum_depth_pct | percentile_stop_pct | risk_per_1000_usd | liquidation_buffer_pct | paper_only | stress_test_only |
|---|---|---|---|---|---|---|---|---|
| Deep capitulation | Conservative | 0.15% (35.0%), 0.30% (27.3%), 0.45% (21.2%) | 0.6000 | 2.6960 | 55.7207 | 48.9000 | True | False |
| Deep capitulation | Balanced | 0.15% (39.3%), 0.30% (20.5%), 0.45% (12.7%) | 1.4115 | 2.6960 | 83.5810 | 31.4218 | True | False |
| Deep capitulation | Aggressive | 2.55% (7.8%), 2.40% (7.6%), 2.25% (7.4%) | 2.6960 | 2.6960 | 111.4414 | 21.8040 | True | True |
| Fast V | Conservative | 0.15% (35.0%), 0.30% (27.3%), 0.45% (21.2%) | 0.6000 | 1.8707 | 39.2147 | 48.9000 | True | False |
| Fast V | Balanced | 0.15% (52.0%), 0.30% (21.1%), 0.45% (11.7%) | 1.0452 | 1.8707 | 58.8220 | 31.7881 | True | False |
| Fast V | Aggressive | 1.80% (11.1%), 1.65% (10.6%), 1.50% (10.1%) | 1.8707 | 1.8707 | 78.4293 | 22.6293 | True | True |
| Multi-test | Conservative | 0.15% (35.0%), 0.30% (27.3%), 0.45% (21.2%) | 0.6000 | 2.0607 | 43.0130 | 48.9000 | True | False |
| Multi-test | Balanced | 0.15% (47.8%), 0.30% (20.5%), 0.45% (11.8%) | 1.0827 | 2.0607 | 64.5195 | 31.7506 | True | False |
| Multi-test | Aggressive | 1.95% (10.3%), 1.80% (9.8%), 1.65% (9.4%) | 2.0607 | 2.0607 | 86.0260 | 22.4393 | True | True |
| Rounded recovery | Conservative | 0.15% (35.0%), 0.30% (27.3%), 0.45% (21.2%) | 0.6000 | 1.8225 | 38.2501 | 48.9000 | True | False |
| Rounded recovery | Balanced | 0.15% (51.1%), 0.30% (21.5%), 0.45% (11.4%) | 0.9140 | 1.8225 | 57.3752 | 31.9193 | True | False |
| Rounded recovery | Aggressive | 1.80% (11.1%), 1.65% (10.6%), 1.50% (10.1%) | 1.8225 | 1.8225 | 76.5003 | 22.6775 | True | True |

## Grid profiles

| galka_type | profile | count | mean_net_return_pct | median_net_return_pct | mean_return_on_filled_pct | mean_fixed_risk_r | win_rate | cvar_95_pct | cvar_95_fixed_risk_r | paper_only | stress_test_only |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | Conservative | 1641 | -0.0784 | 0.0785 | -0.0532 | -0.0127 | 0.9531 | -5.0079 | -1.3149 | True | False |
| Deep capitulation | Balanced | 1641 | -0.0850 | 0.0670 | -0.0501 | -0.0140 | 0.9531 | -5.0021 | -1.3158 | True | False |
| Deep capitulation | Aggressive | 1641 | -0.0607 | 0.0111 | 0.0996 | 0.0256 | 0.9555 | -3.8486 | -1.3454 | True | True |
| Fast V | Conservative | 715 | -0.0919 | 0.0785 | -0.0643 | -0.0142 | 0.9455 | -5.3236 | -1.5577 | True | False |
| Fast V | Balanced | 715 | -0.1041 | 0.0757 | -0.0835 | -0.0262 | 0.9455 | -5.4898 | -1.5512 | True | False |
| Fast V | Aggressive | 715 | -0.0661 | 0.0161 | 0.0581 | 0.0347 | 0.9483 | -4.2306 | -1.6115 | True | True |
| Multi-test | Conservative | 7065 | -0.0264 | 0.0785 | 0.0033 | -0.0025 | 0.9575 | -4.2366 | -1.6506 | True | False |
| Multi-test | Balanced | 7065 | -0.0366 | 0.0720 | -0.0085 | -0.0106 | 0.9575 | -4.3934 | -1.6486 | True | False |
| Multi-test | Aggressive | 7065 | -0.0093 | 0.0148 | 0.1345 | 0.0488 | 0.9591 | -3.1815 | -1.6920 | True | True |
| Rounded recovery | Conservative | 3289 | -0.0124 | 0.0785 | -0.0113 | -0.0232 | 0.9544 | -4.0261 | -2.2771 | True | False |
| Rounded recovery | Balanced | 3289 | -0.0319 | 0.0760 | -0.0294 | -0.0354 | 0.9544 | -4.3890 | -2.2693 | True | False |
| Rounded recovery | Aggressive | 3289 | 0.0157 | 0.0161 | 0.1035 | 0.0272 | 0.9553 | -2.6360 | -2.3269 | True | True |

## Stop trade-offs

| galka_type | stop | count | mean_net_return_pct | win_rate | cvar_95_pct |
|---|---|---|---|---|---|
| Deep capitulation | fixed | 1641 | -0.0400 | 0.8946 | -1.8808 |
| Deep capitulation | percentile | 1641 | -0.0590 | 0.9104 | -2.4916 |
| Deep capitulation | atr | 1642 | -0.0260 | 0.8295 | -1.6128 |
| Deep capitulation | time | 1646 | -0.0805 | 0.9478 | -3.3411 |
| Deep capitulation | probability | 1641 | -0.0747 | 0.9129 | -2.7636 |
| Deep capitulation | hybrid | 1642 | -0.0289 | 0.8283 | -1.6423 |
| Deep capitulation | no_stop | 1646 | -0.0857 | 0.9502 | -5.0220 |
| Fast V | fixed | 715 | -0.0633 | 0.8923 | -2.1740 |
| Fast V | percentile | 715 | -0.0570 | 0.8895 | -2.0811 |
| Fast V | atr | 715 | -0.0676 | 0.7958 | -1.8608 |
| Fast V | time | 715 | -0.0575 | 0.9441 | -2.7218 |
| Fast V | probability | 715 | -0.0812 | 0.9371 | -4.5831 |
| Fast V | hybrid | 715 | -0.0631 | 0.7958 | -1.7719 |
| Fast V | no_stop | 715 | -0.1041 | 0.9455 | -5.4898 |
| Multi-test | fixed | 7065 | -0.0386 | 0.8998 | -2.2342 |
| Multi-test | percentile | 7065 | -0.0395 | 0.9016 | -2.2822 |
| Multi-test | atr | 7072 | -0.0471 | 0.7954 | -1.7886 |
| Multi-test | time | 7073 | -0.0760 | 0.9529 | -3.2829 |
| Multi-test | probability | 7065 | -0.0389 | 0.9349 | -3.4968 |
| Multi-test | hybrid | 7073 | -0.0479 | 0.7943 | -1.7660 |
| Multi-test | no_stop | 7073 | -0.0374 | 0.9565 | -4.4122 |
| Rounded recovery | fixed | 3289 | -0.0569 | 0.9033 | -2.7514 |
| Rounded recovery | percentile | 3289 | -0.0550 | 0.8972 | -2.6290 |
| Rounded recovery | atr | 3289 | -0.0795 | 0.8015 | -2.3826 |
| Rounded recovery | time | 3289 | -0.0484 | 0.9596 | -2.6696 |
| Rounded recovery | probability | 3289 | -0.0467 | 0.9285 | -3.4607 |
| Rounded recovery | hybrid | 3289 | -0.0773 | 0.8002 | -2.3149 |
| Rounded recovery | no_stop | 3289 | -0.0319 | 0.9544 | -4.3890 |

## Exit and trailing trade-offs

| galka_type | exit | count | mean_net_return_pct | median_net_return_pct | win_rate | cvar_95_pct | paper_only |
|---|---|---|---|---|---|---|---|
| Deep capitulation | galka_tp_48h | 1646 | -0.0853 | 0.0670 | 0.9648 | -3.5610 | True |
| Deep capitulation | reclaim_010_trail_075 | 1641 | -0.0850 | 0.0670 | 0.9531 | -5.0021 | True |
| Deep capitulation | reclaim_010_trail_atr | 1641 | -0.0756 | 0.0670 | 0.9531 | -5.0021 | True |
| Deep capitulation | reclaim_010_trail_swing | 1641 | -0.0816 | 0.0670 | 0.9531 | -5.0021 | True |
| Deep capitulation | partial_galka_runner | 1641 | -0.0851 | 0.0670 | 0.9506 | -4.2656 | True |
| Deep capitulation | max_hold_12h | 1646 | -0.0490 | 0.0670 | 0.9016 | -3.2872 | True |
| Deep capitulation | max_hold_24h | 1646 | -0.0513 | 0.0670 | 0.9228 | -3.6680 | True |
| Deep capitulation | max_hold_48h | 1646 | -0.0560 | 0.0670 | 0.9447 | -4.3824 | True |
| Fast V | galka_tp_48h | 715 | -0.1448 | 0.0757 | 0.9594 | -4.5722 | True |
| Fast V | reclaim_010_trail_075 | 715 | -0.1041 | 0.0757 | 0.9455 | -5.4898 | True |
| Fast V | reclaim_010_trail_atr | 715 | -0.0971 | 0.0757 | 0.9455 | -5.4898 | True |
| Fast V | reclaim_010_trail_swing | 715 | -0.1020 | 0.0757 | 0.9455 | -5.4898 | True |
| Fast V | partial_galka_runner | 715 | -0.1245 | 0.0757 | 0.9413 | -4.9184 | True |
| Fast V | max_hold_12h | 715 | -0.0162 | 0.0757 | 0.9007 | -2.7004 | True |
| Fast V | max_hold_24h | 715 | -0.0102 | 0.0757 | 0.9189 | -3.0478 | True |
| Fast V | max_hold_48h | 715 | -0.1060 | 0.0757 | 0.9399 | -5.3312 | True |
| Multi-test | galka_tp_48h | 7073 | -0.0913 | 0.0720 | 0.9656 | -3.6444 | True |
| Multi-test | reclaim_010_trail_075 | 7065 | -0.0366 | 0.0720 | 0.9575 | -4.3934 | True |
| Multi-test | reclaim_010_trail_atr | 7065 | -0.0345 | 0.0720 | 0.9575 | -4.3934 | True |
| Multi-test | reclaim_010_trail_swing | 7065 | -0.0392 | 0.0957 | 0.9575 | -4.3934 | True |
| Multi-test | partial_galka_runner | 7065 | -0.0635 | 0.0720 | 0.9536 | -3.9962 | True |
| Multi-test | max_hold_12h | 7073 | -0.0310 | 0.0720 | 0.9054 | -3.3347 | True |
| Multi-test | max_hold_24h | 7073 | -0.0356 | 0.0720 | 0.9275 | -3.8680 | True |
| Multi-test | max_hold_48h | 7073 | -0.0525 | 0.0720 | 0.9485 | -4.6736 | True |
| Rounded recovery | galka_tp_48h | 3289 | -0.0573 | 0.0760 | 0.9702 | -2.8877 | True |
| Rounded recovery | reclaim_010_trail_075 | 3289 | -0.0319 | 0.0760 | 0.9544 | -4.3890 | True |
| Rounded recovery | reclaim_010_trail_atr | 3289 | -0.0265 | 0.0760 | 0.9544 | -4.3890 | True |
| Rounded recovery | reclaim_010_trail_swing | 3289 | -0.0346 | 0.0936 | 0.9544 | -4.3890 | True |
| Rounded recovery | partial_galka_runner | 3289 | -0.0446 | 0.0760 | 0.9510 | -3.6219 | True |
| Rounded recovery | max_hold_12h | 3289 | -0.0276 | 0.0760 | 0.9042 | -3.3120 | True |
| Rounded recovery | max_hold_24h | 3289 | -0.0207 | 0.0760 | 0.9273 | -3.6491 | True |
| Rounded recovery | max_hold_48h | 3289 | -0.0413 | 0.0760 | 0.9471 | -4.5090 | True |
| Rounded recovery | reclaim_000_trail_015 | 3289 | 0.0143 | 0.0760 | 0.9742 | -2.7544 | True |
| Rounded recovery | reclaim_000_trail_030 | 3289 | 0.0111 | 0.0760 | 0.9742 | -2.7544 | True |
| Rounded recovery | reclaim_000_trail_050 | 3289 | 0.0081 | 0.0760 | 0.9742 | -2.7544 | True |
| Multi-test | reclaim_010_trail_015 | 7065 | -0.0245 | 0.1332 | 0.9575 | -4.3934 | True |
| Multi-test | reclaim_000_trail_015 | 7065 | -0.0256 | 0.0720 | 0.9707 | -3.4790 | True |
| Multi-test | reclaim_020_trail_015 | 7065 | -0.0287 | 0.1890 | 0.9421 | -5.4733 | True |
| Deep capitulation | reclaim_020_trail_015 | 1639 | -0.0329 | 0.1551 | 0.9451 | -5.3939 | True |
| Deep capitulation | reclaim_020_trail_030 | 1639 | -0.0428 | 0.1285 | 0.9451 | -5.3939 | True |
| Fast V | reclaim_000_trail_015 | 715 | -0.0822 | 0.0757 | 0.9636 | -4.5438 | True |

All reclaim buffers (0.00/0.10/0.20%), fixed trails (0.15/0.30/0.50/0.75/1.00%), ATR trail, two-bar-confirmed local-minimum trail, fixed GALKA TP, partial runner, and maximum holds remain in evaluation.json.

## Cross-symbol portability on final OOS

| galka_type | symbol | count_complete | return_24h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|---|
| Deep capitulation | BTCUSDT | 1171 | 0.9812 | 0.9717 | 0.9876 | 0.2095 | -0.0168 | False |
| Deep capitulation | ETHUSDT | 1352 | 0.9697 | 0.9591 | 0.9776 | 0.4103 | -0.1981 | False |
| Deep capitulation | SOLUSDT | 911 | 0.9759 | 0.9637 | 0.9840 | 0.3539 | 0.0444 | False |
| Fast V | BTCUSDT | 688 | 0.9797 | 0.9661 | 0.9878 | 0.1743 | 0.0178 | False |
| Fast V | ETHUSDT | 672 | 0.9926 | 0.9827 | 0.9968 | 0.2559 | 0.0579 | False |
| Fast V | SOLUSDT | 609 | 0.9655 | 0.9479 | 0.9773 | 0.2643 | -0.3938 | False |
| Multi-test | BTCUSDT | 5826 | 0.9847 | 0.9812 | 0.9876 | 0.1824 | -0.0019 | False |
| Multi-test | ETHUSDT | 6151 | 0.9805 | 0.9767 | 0.9837 | 0.3204 | -0.0747 | False |
| Multi-test | SOLUSDT | 6111 | 0.9809 | 0.9771 | 0.9840 | 0.2786 | -0.0175 | False |
| Rounded recovery | BTCUSDT | 3198 | 0.9859 | 0.9812 | 0.9895 | 0.1643 | -0.0344 | False |
| Rounded recovery | ETHUSDT | 2832 | 0.9841 | 0.9788 | 0.9881 | 0.2879 | -0.0538 | False |
| Rounded recovery | SOLUSDT | 3324 | 0.9871 | 0.9826 | 0.9904 | 0.2453 | -0.0098 | False |

## Timeframe robustness on final OOS

| galka_type | interval | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|
| Deep capitulation | 15m | 740 | 0.9662 | 0.3625 | -0.1039 | False |
| Deep capitulation | 1h | 199 | 0.9648 | 0.5007 | -0.0430 | False |
| Deep capitulation | 30m | 412 | 0.9612 | 0.4602 | -0.1163 | False |
| Deep capitulation | 5m | 2083 | 0.9822 | 0.2727 | -0.0736 | False |
| Fast V | 15m | 407 | 0.9803 | 0.3140 | -0.0747 | False |
| Fast V | 1h | 128 | 0.9609 | 0.3614 | -0.1810 | False |
| Fast V | 30m | 260 | 0.9808 | 0.2822 | 0.0156 | False |
| Fast V | 5m | 1174 | 0.9813 | 0.1868 | -0.1389 | False |
| Multi-test | 15m | 3822 | 0.9812 | 0.2891 | -0.0129 | False |
| Multi-test | 1h | 822 | 0.9708 | 0.4276 | -0.0910 | False |
| Multi-test | 30m | 1809 | 0.9746 | 0.3489 | -0.0484 | False |
| Multi-test | 5m | 11635 | 0.9842 | 0.2249 | -0.0375 | False |
| Rounded recovery | 15m | 1876 | 0.9845 | 0.2590 | -0.0612 | False |
| Rounded recovery | 1h | 413 | 0.9758 | 0.4096 | -0.0923 | False |
| Rounded recovery | 30m | 889 | 0.9843 | 0.3200 | -0.0085 | False |
| Rounded recovery | 5m | 6176 | 0.9870 | 0.1874 | -0.0182 | False |

## Best and worst final-OOS regimes

Best by Balanced fixed-notional EV:

| galka_type | regime | volatility_regime | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|
| Fast V | uptrend | low | 261 | 0.9923 | 0.2052 | 0.2439 | False |
| Rounded recovery | downtrend | high | 729 | 0.9863 | 0.4276 | 0.0762 | False |
| Deep capitulation | downtrend | low | 240 | 0.9792 | 0.2374 | 0.0724 | False |
| Multi-test | uptrend | low | 1515 | 0.9881 | 0.1703 | 0.0505 | False |
| Deep capitulation | uptrend | low | 133 | 0.9925 | 0.2040 | 0.0301 | False |
| Rounded recovery | range | low | 662 | 0.9940 | 0.1646 | 0.0257 | False |
| Rounded recovery | range | normal | 1132 | 0.9929 | 0.2039 | 0.0249 | False |
| Deep capitulation | range | normal | 329 | 0.9818 | 0.2414 | 0.0159 | False |

Worst by Balanced fixed-notional EV:

| galka_type | regime | volatility_regime | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|
| Deep capitulation | uptrend | high | 171 | 0.9532 | 0.3058 | -0.5074 | False |
| Fast V | uptrend | high | 319 | 0.9592 | 0.2812 | -0.3038 | False |
| Deep capitulation | range | high | 258 | 0.9690 | 0.3529 | -0.2974 | False |
| Fast V | downtrend | normal | 82 | 0.9878 | 0.1739 | -0.2745 | False |
| Rounded recovery | range | high | 262 | 0.9733 | 0.3111 | -0.2196 | False |
| Fast V | range | high | 93 | 0.9785 | 0.2158 | -0.2153 | False |
| Deep capitulation | uptrend | normal | 275 | 0.9782 | 0.2414 | -0.1536 | False |
| Fast V | range | low | 80 | 0.9750 | 0.2095 | -0.0995 | False |

## Recent drift

| galka_type | window | count | depth_p75 | historical_depth_p75 | depth_p75_delta | return_24h_probability | insufficient_data |
|---|---|---|---|---|---|---|---|
| Deep capitulation | 7d | 53 | 0.3027 | 0.5051 | -0.2024 | 0.9811 | False |
| Fast V | 7d | 36 | 0.2952 | 0.3446 | -0.0494 | 0.9722 | True |
| Multi-test | 7d | 232 | 0.2331 | 0.3654 | -0.1323 | 0.9784 | False |
| Rounded recovery | 7d | 132 | 0.2650 | 0.3035 | -0.0385 | 0.9924 | False |
| Deep capitulation | 30d | 199 | 0.2851 | 0.5051 | -0.2201 | 0.9799 | False |
| Fast V | 30d | 149 | 0.2067 | 0.3446 | -0.1379 | 0.9933 | False |
| Multi-test | 30d | 1075 | 0.2225 | 0.3654 | -0.1429 | 0.9833 | False |
| Rounded recovery | 30d | 591 | 0.2338 | 0.3035 | -0.0697 | 0.9865 | False |
| Deep capitulation | 90d | 774 | 0.2522 | 0.5051 | -0.2529 | 0.9832 | False |
| Fast V | 90d | 415 | 0.1828 | 0.3446 | -0.1618 | 0.9952 | False |
| Multi-test | 90d | 3464 | 0.2184 | 0.3654 | -0.1471 | 0.9844 | False |
| Rounded recovery | 90d | 1700 | 0.1851 | 0.3035 | -0.1184 | 0.9894 | False |
| Deep capitulation | 180d | 1442 | 0.3250 | 0.5051 | -0.1802 | 0.9716 | False |
| Fast V | 180d | 823 | 0.2136 | 0.3446 | -0.1310 | 0.9866 | False |
| Multi-test | 180d | 7127 | 0.2584 | 0.3654 | -0.1070 | 0.9777 | False |
| Rounded recovery | 180d | 3386 | 0.2361 | 0.3035 | -0.0675 | 0.9826 | False |
| Deep capitulation | 365d | 2755 | 0.3104 | 0.5051 | -0.1947 | 0.9750 | False |
| Fast V | 365d | 1578 | 0.2218 | 0.3446 | -0.1228 | 0.9791 | False |
| Multi-test | 365d | 14109 | 0.2579 | 0.3654 | -0.1075 | 0.9819 | False |
| Rounded recovery | 365d | 7096 | 0.2263 | 0.3035 | -0.0772 | 0.9842 | False |

## Stable versus unstable feature relationships

| feature | target | train_spearman | validation_spearman | final_oos_spearman | stable_direction |
|---|---|---|---|---|---|
| atr_pct | mae_pct | 0.3405 | 0.2929 | 0.2847 | True |
| trend_slope_atr | mae_pct | -0.1156 | -0.1179 | -0.1201 | True |
| prior_touches | mae_pct | -0.1288 | -0.1127 | -0.0931 | True |
| atr_pct | balanced_net_return_pct | 0.1620 | 0.1121 | 0.0851 | True |
| drop_atr | mae_pct | 0.1134 | 0.0974 | 0.0814 | True |
| base_width_bars | mae_pct | -0.0855 | -0.0633 | -0.0579 | True |
| near_low_bars | mae_pct | -0.0855 | -0.0633 | -0.0579 | True |
| close_lift_atr | mae_pct | 0.0861 | 0.0642 | 0.0553 | True |
| sharpness_atr | mae_pct | 0.0776 | 0.0635 | 0.0528 | True |
| recovery_ratio | mae_pct | -0.0520 | -0.0345 | -0.0442 | True |
| fall_speed_atr | mae_pct | 0.0592 | 0.0494 | 0.0385 | True |
| wick_ratio | mae_pct | 0.0355 | 0.0280 | 0.0341 | True |
| prior_touches | return_24h | 0.0295 | 0.0240 | 0.0232 | True |
| prior_touches | balanced_net_return_pct | -0.0575 | -0.0460 | -0.0223 | True |

Only same-direction train/validation/final-OOS Spearman relationships with |ρ| ≥ 0.02 in every split are listed as stable. Omitted relationships are not promoted as evidence; multiple-testing risk still applies.

No profile in this report changes production paper defaults. Every grid and exit experiment is paper-only; Aggressive is stress-test-only; auto-paper remains disabled.
