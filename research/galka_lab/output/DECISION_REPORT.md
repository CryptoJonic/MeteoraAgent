# Galka Lab decision report

## Promotion decision

Return frequency is not treated as profitability. A type is not eligible for auto-paper when its fee-adjusted Balanced fixed-notional OOS EV or fixed-risk result is non-positive. Live shadow validation remains mandatory even after a historical threshold passes.

| galka_type | count_complete | return_24h_probability | mean_net_return_pct | mean_fixed_risk_r | cvar_95_pct | historical_screen_pass | auto_paper_eligible | decision |
|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9396 | 0.9860 | -0.0098 | -0.0117 | -1.4606 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Multi-test | 18097 | 0.9820 | -0.0128 | -0.0043 | -1.6250 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Fast V | 1987 | 0.9799 | -0.0335 | -0.0084 | -1.8016 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Deep capitulation | 3379 | 0.9751 | -0.0401 | -0.0069 | -2.2816 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |

Auto-paper remains disabled; this report cannot enable it.

## Most stable observational return types on untouched final OOS

| galka_type | count_complete | return_6h_probability | return_24h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p75 | depth_success_p90 | depth_success_p95 | depth_success_p99 | return_minutes_p50 |
|---|---|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9396 | 0.9759 | 0.9860 | 0.9834 | 0.9881 | 0.2252 | 0.5681 | 1.0176 | 4.2120 | 1.0000 |
| Multi-test | 18097 | 0.9694 | 0.9820 | 0.9799 | 0.9838 | 0.2591 | 0.6441 | 1.2187 | 4.6414 | 0.7500 |
| Fast V | 1987 | 0.9728 | 0.9799 | 0.9727 | 0.9852 | 0.2378 | 0.5598 | 1.0459 | 3.5559 | 0.2500 |

## Day-block bootstrap uncertainty on untouched final OOS

UTC activation days are resampled as blocks, keeping same-day BTC/ETH/SOL and cross-timeframe events together. These intervals are the primary uncertainty view; event-level Wilson intervals remain a secondary screening aid.

| galka_type | event_count | activated_count | returned_count | block_count | return_1h_probability | return_1h_block_ci_low | return_1h_block_ci_high | return_24h_probability | return_24h_block_ci_low | return_24h_block_ci_high | return_48h_probability | return_48h_block_ci_low | return_48h_block_ci_high | depth_success_p50 | depth_success_p50_block_ci_low | depth_success_p50_block_ci_high | depth_success_p75 | depth_success_p75_block_ci_low | depth_success_p75_block_ci_high | depth_success_p90 | depth_success_p90_block_ci_low | depth_success_p90_block_ci_high | insufficient_data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | 3669 | 3380 | 3350 | 434 | 0.9376 | 0.9224 | 0.9494 | 0.9751 | 0.9654 | 0.9826 | 0.9831 | 0.9764 | 0.9888 | 0.1365 | 0.1212 | 0.1520 | 0.3199 | 0.2886 | 0.3517 | 0.7322 | 0.6319 | 0.8661 | False |
| Fast V | 2225 | 1988 | 1970 | 425 | 0.9507 | 0.9385 | 0.9611 | 0.9799 | 0.9714 | 0.9880 | 0.9854 | 0.9776 | 0.9924 | 0.0924 | 0.0849 | 0.0990 | 0.2378 | 0.2090 | 0.2668 | 0.5598 | 0.4673 | 0.6622 | False |
| Multi-test | 19147 | 18097 | 17996 | 478 | 0.9416 | 0.9347 | 0.9480 | 0.9820 | 0.9776 | 0.9863 | 0.9871 | 0.9834 | 0.9907 | 0.0962 | 0.0921 | 0.1019 | 0.2591 | 0.2449 | 0.2764 | 0.6441 | 0.5763 | 0.7018 | False |
| Rounded recovery | 9839 | 9399 | 9359 | 478 | 0.9404 | 0.9347 | 0.9466 | 0.9860 | 0.9818 | 0.9898 | 0.9897 | 0.9856 | 0.9930 | 0.0857 | 0.0801 | 0.0905 | 0.2252 | 0.2104 | 0.2403 | 0.5681 | 0.5171 | 0.6266 | False |

## Types that should not be promoted

| galka_type | count_complete | return_24h_probability | mean_net_return_pct | mean_fixed_risk_r | cvar_95_pct | decision |
|---|---|---|---|---|---|---|
| Rounded recovery | 9396 | 0.9860 | -0.0098 | -0.0117 | -1.4606 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Multi-test | 18097 | 0.9820 | -0.0128 | -0.0043 | -1.6250 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Fast V | 1987 | 0.9799 | -0.0335 | -0.0084 | -1.8016 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Deep capitulation | 3379 | 0.9751 | -0.0401 | -0.0069 | -2.2816 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |

## Significant conditional-return cliffs (≥5 percentage points)

| symbol | interval | galka_type | window | cliff_depth_pct | probability_before | probability_after | probability_drop | significant_cliff | insufficient_data |
|---|---|---|---|---|---|---|---|---|---|
| BTCUSDT | 15m | Deep capitulation | all | 0.3000 | 0.9352 | 0.8627 | 0.0724 | True | False |
| BTCUSDT | 15m | Multi-test | all | 1.2500 | 0.7302 | 0.6600 | 0.0702 | True | False |
| BTCUSDT | 15m | Rounded recovery | all | 0.7500 | 0.8065 | 0.7143 | 0.0922 | True | False |
| BTCUSDT | 30m | Multi-test | all | 0.7500 | 0.7869 | 0.7234 | 0.0635 | True | False |
| BTCUSDT | 5m | Deep capitulation | all | 0.4500 | 0.9082 | 0.8235 | 0.0846 | True | False |
| BTCUSDT | 5m | Fast V | all | 0.3000 | 0.9192 | 0.8545 | 0.0646 | True | False |
| BTCUSDT | 5m | Multi-test | all | 2.0000 | 0.5185 | 0.3333 | 0.1852 | True | False |
| BTCUSDT | 5m | Rounded recovery | all | 1.0000 | 0.7500 | 0.6620 | 0.0880 | True | False |
| ETHUSDT | 15m | Deep capitulation | all | 0.6000 | 0.8721 | 0.8167 | 0.0554 | True | False |
| ETHUSDT | 15m | Multi-test | all | 2.0000 | 0.6842 | 0.5400 | 0.1442 | True | False |
| ETHUSDT | 30m | Multi-test | all | 1.2500 | 0.7541 | 0.6512 | 0.1029 | True | False |
| ETHUSDT | 5m | Deep capitulation | all | 1.0000 | 0.8023 | 0.7302 | 0.0722 | True | False |
| ETHUSDT | 5m | Multi-test | all | 5.0000 | 0.2410 | 0.1129 | 0.1281 | True | False |
| ETHUSDT | 5m | Rounded recovery | all | 1.2500 | 0.7719 | 0.6941 | 0.0778 | True | False |
| SOLUSDT | 15m | Deep capitulation | all | 0.3000 | 0.9293 | 0.8750 | 0.0543 | True | False |
| SOLUSDT | 15m | Multi-test | all | 3.0000 | 0.4909 | 0.4000 | 0.0909 | True | False |
| SOLUSDT | 15m | Rounded recovery | all | 1.0000 | 0.8904 | 0.8367 | 0.0537 | True | False |
| SOLUSDT | 30m | Multi-test | all | 1.0000 | 0.7722 | 0.6842 | 0.0879 | True | False |
| SOLUSDT | 5m | Deep capitulation | all | 1.0000 | 0.8167 | 0.7500 | 0.0667 | True | False |
| SOLUSDT | 5m | Fast V | all | 0.3000 | 0.9113 | 0.8226 | 0.0887 | True | False |
| SOLUSDT | 5m | Multi-test | all | 5.0000 | 0.3000 | 0.1509 | 0.1491 | True | False |
| SOLUSDT | 5m | Rounded recovery | all | 2.0000 | 0.6709 | 0.5593 | 0.1116 | True | False |

The full conditional depth × horizon table, including recovery time and probability of the next deeper band, is retained in the JSON outputs and terminal pack.

## Statistically dense entry zones and normalized risk

| galka_type | profile | statistically_dense_zones | maximum_depth_pct | percentile_stop_pct | risk_per_1000_usd | liquidation_buffer_pct | paper_only | stress_test_only |
|---|---|---|---|---|---|---|---|---|
| Deep capitulation | Conservative | 0.15% (49.1%), 0.30% (25.6%), 0.45% (15.5%) | 0.6000 | 2.6974 | 55.7477 | 48.9000 | True | False |
| Deep capitulation | Balanced | 0.15% (40.3%), 0.30% (21.0%), 0.45% (12.7%) | 1.4083 | 2.6974 | 83.6216 | 31.4250 | True | False |
| Deep capitulation | Aggressive | 0.15% (37.5%), 0.30% (19.5%), 0.45% (11.8%) | 2.6974 | 2.6974 | 111.4955 | 21.8026 | True | True |
| Fast V | Conservative | 0.15% (57.2%), 0.30% (22.8%), 0.45% (12.5%) | 0.6000 | 1.8735 | 39.2697 | 48.9000 | True | False |
| Fast V | Balanced | 0.15% (53.0%), 0.30% (21.1%), 0.45% (11.6%) | 1.0460 | 1.8735 | 58.9045 | 31.7874 | True | False |
| Fast V | Aggressive | 0.15% (48.1%), 0.30% (19.2%), 0.45% (10.5%) | 1.8735 | 1.8735 | 78.5394 | 22.6265 | True | True |
| Multi-test | Conservative | 0.15% (55.2%), 0.30% (23.3%), 0.45% (13.3%) | 0.6000 | 2.0618 | 43.0367 | 48.9000 | True | False |
| Multi-test | Balanced | 0.15% (48.8%), 0.30% (20.7%), 0.45% (11.8%) | 1.0811 | 2.0618 | 64.5551 | 31.7522 | True | False |
| Multi-test | Aggressive | 0.15% (45.1%), 0.30% (19.1%), 0.45% (10.9%) | 2.0618 | 2.0618 | 86.0734 | 22.4382 | True | True |
| Rounded recovery | Conservative | 0.15% (56.9%), 0.30% (23.5%), 0.45% (12.2%) | 0.6000 | 1.8196 | 38.1921 | 48.9000 | True | False |
| Rounded recovery | Balanced | 0.15% (52.2%), 0.30% (21.6%), 0.45% (11.2%) | 0.9141 | 1.8196 | 57.2882 | 31.9192 | True | False |
| Rounded recovery | Aggressive | 0.15% (48.0%), 0.30% (19.9%), 0.45% (10.3%) | 1.8196 | 1.8196 | 76.3842 | 22.6804 | True | True |

## Grid profiles

Fixed-notional EV is candidate-level: observable non-activations and fully unfilled grids are 0%, while unresolved censored candidates are excluded. Return on filled capital and filled win rate remain conditional on a fill.

| galka_type | profile | eligible_count | count | fill_probability | fill_probability_given_activation | full_fill_probability | expected_fill_fraction | expected_mae_pct | mean_net_return_pct | median_net_return_pct | mean_return_on_filled_pct | mean_fixed_risk_r | win_rate | filled_win_rate | cvar_95_pct | cvar_95_fixed_risk_r | paper_only | stress_test_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | Conservative | 3639 | 3638 | 0.4444 | 0.4785 | 0.1231 | 0.2808 | 0.6041 | -0.0372 | 0.0000 | -0.0600 | -0.0064 | 0.4230 | 0.9524 | -2.2845 | -0.9427 | True | False |
| Deep capitulation | Balanced | 3639 | 3638 | 0.4444 | 0.4785 | 0.0550 | 0.2734 | 0.6041 | -0.0401 | 0.0000 | -0.0569 | -0.0069 | 0.4230 | 0.9524 | -2.2816 | -0.9435 | True | False |
| Deep capitulation | Aggressive | 3639 | 3638 | 0.4444 | 0.4785 | 0.0341 | 0.0833 | 0.6041 | -0.0288 | 0.0000 | 0.0929 | 0.0105 | 0.4241 | 0.9548 | -1.7553 | -0.9673 | True | True |
| Fast V | Conservative | 2204 | 2204 | 0.3267 | 0.3624 | 0.0921 | 0.2056 | 0.4880 | -0.0295 | 0.0000 | -0.0627 | -0.0044 | 0.3090 | 0.9458 | -1.7438 | -0.9145 | True | False |
| Fast V | Balanced | 2204 | 2204 | 0.3267 | 0.3624 | 0.0626 | 0.2352 | 0.4880 | -0.0335 | 0.0000 | -0.0821 | -0.0084 | 0.3090 | 0.9458 | -1.8016 | -0.9121 | True | False |
| Fast V | Aggressive | 2204 | 2204 | 0.3267 | 0.3624 | 0.0304 | 0.0778 | 0.4880 | -0.0213 | 0.0000 | 0.0593 | 0.0115 | 0.3099 | 0.9486 | -1.3732 | -0.9532 | True | True |
| Multi-test | Conservative | 19056 | 19056 | 0.3711 | 0.3907 | 0.1068 | 0.2354 | 0.4710 | -0.0091 | 0.0000 | 0.0055 | -0.0013 | 0.3554 | 0.9577 | -1.5667 | -0.9926 | True | False |
| Multi-test | Balanced | 19056 | 19056 | 0.3711 | 0.3907 | 0.0606 | 0.2546 | 0.4710 | -0.0128 | 0.0000 | -0.0062 | -0.0043 | 0.3554 | 0.9577 | -1.6250 | -0.9920 | True | False |
| Multi-test | Aggressive | 19056 | 19056 | 0.3711 | 0.3907 | 0.0337 | 0.0848 | 0.4710 | -0.0025 | 0.0000 | 0.1376 | 0.0176 | 0.3560 | 0.9593 | -1.1746 | -1.0248 | True | True |
| Rounded recovery | Conservative | 9808 | 9808 | 0.3369 | 0.3516 | 0.0932 | 0.2116 | 0.3662 | -0.0032 | 0.0000 | -0.0082 | -0.0075 | 0.3217 | 0.9549 | -1.3375 | -1.1332 | True | False |
| Rounded recovery | Balanced | 9808 | 9808 | 0.3369 | 0.3516 | 0.0602 | 0.2401 | 0.3662 | -0.0098 | 0.0000 | -0.0266 | -0.0117 | 0.3217 | 0.9549 | -1.4606 | -1.1303 | True | False |
| Rounded recovery | Aggressive | 9808 | 9808 | 0.3369 | 0.3516 | 0.0281 | 0.0772 | 0.3662 | 0.0062 | 0.0000 | 0.1065 | 0.0097 | 0.3220 | 0.9558 | -0.8713 | -1.1709 | True | True |

## Stop trade-offs

| galka_type | stop | eligible_count | count | filled_count | mean_net_return_pct | win_rate | cvar_95_pct |
|---|---|---|---|---|---|---|---|
| Deep capitulation | fixed | 3639 | 3639 | 1617 | -0.0188 | 0.3971 | -1.6372 |
| Deep capitulation | percentile | 3639 | 3638 | 1616 | -0.0273 | 0.4041 | -1.8700 |
| Deep capitulation | atr | 3639 | 3639 | 1617 | -0.0121 | 0.3685 | -1.0415 |
| Deep capitulation | time | 3639 | 3639 | 1617 | -0.0365 | 0.4213 | -1.5242 |
| Deep capitulation | probability | 3639 | 3638 | 1616 | -0.0343 | 0.4052 | -2.0163 |
| Deep capitulation | hybrid | 3639 | 3639 | 1617 | -0.0134 | 0.3680 | -1.0588 |
| Deep capitulation | no_stop | 3639 | 3638 | 1616 | -0.0401 | 0.4230 | -2.2816 |
| Fast V | fixed | 2204 | 2204 | 720 | -0.0203 | 0.2917 | -1.3584 |
| Fast V | percentile | 2204 | 2204 | 720 | -0.0184 | 0.2908 | -1.3158 |
| Fast V | atr | 2204 | 2204 | 720 | -0.0220 | 0.2600 | -1.0017 |
| Fast V | time | 2204 | 2204 | 720 | -0.0184 | 0.3085 | -0.9013 |
| Fast V | probability | 2204 | 2204 | 720 | -0.0261 | 0.3063 | -1.6336 |
| Fast V | hybrid | 2204 | 2204 | 720 | -0.0206 | 0.2600 | -0.9731 |
| Fast V | no_stop | 2204 | 2204 | 720 | -0.0335 | 0.3090 | -1.8016 |
| Multi-test | fixed | 19056 | 19056 | 7071 | -0.0150 | 0.3334 | -1.4808 |
| Multi-test | percentile | 19056 | 19056 | 7071 | -0.0154 | 0.3341 | -1.4967 |
| Multi-test | atr | 19056 | 19056 | 7071 | -0.0174 | 0.2951 | -1.0048 |
| Multi-test | time | 19056 | 19056 | 7071 | -0.0277 | 0.3540 | -1.2111 |
| Multi-test | probability | 19056 | 19056 | 7071 | -0.0142 | 0.3469 | -1.5891 |
| Multi-test | hybrid | 19056 | 19056 | 7071 | -0.0178 | 0.2947 | -0.9995 |
| Multi-test | no_stop | 19056 | 19056 | 7071 | -0.0128 | 0.3554 | -1.6250 |
| Rounded recovery | fixed | 9808 | 9808 | 3304 | -0.0188 | 0.3045 | -1.4636 |
| Rounded recovery | percentile | 9808 | 9808 | 3304 | -0.0181 | 0.3025 | -1.4358 |
| Rounded recovery | atr | 9808 | 9808 | 3304 | -0.0268 | 0.2701 | -1.1746 |
| Rounded recovery | time | 9808 | 9808 | 3304 | -0.0157 | 0.3234 | -0.8926 |
| Rounded recovery | probability | 9808 | 9808 | 3304 | -0.0153 | 0.3130 | -1.5065 |
| Rounded recovery | hybrid | 9808 | 9808 | 3304 | -0.0261 | 0.2697 | -1.1537 |
| Rounded recovery | no_stop | 9808 | 9808 | 3304 | -0.0098 | 0.3217 | -1.4606 |

## Exit and trailing trade-offs

| galka_type | exit | eligible_count | count | filled_count | mean_net_return_pct | median_net_return_pct | win_rate | cvar_95_pct | paper_only |
|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | galka_tp_48h | 3639 | 3639 | 1617 | -0.0390 | 0.0000 | 0.4287 | -1.6222 | True |
| Deep capitulation | reclaim_010_trail_075 | 3639 | 3638 | 1616 | -0.0401 | 0.0000 | 0.4230 | -2.2816 | True |
| Deep capitulation | reclaim_010_trail_atr | 3639 | 3638 | 1616 | -0.0359 | 0.0000 | 0.4230 | -2.2816 | True |
| Deep capitulation | reclaim_010_trail_swing | 3639 | 3638 | 1616 | -0.0384 | 0.0000 | 0.4230 | -2.2816 | True |
| Deep capitulation | partial_galka_runner | 3639 | 3638 | 1616 | -0.0396 | 0.0000 | 0.4219 | -1.9454 | True |
| Deep capitulation | max_hold_12h | 3639 | 3639 | 1617 | -0.0231 | 0.0000 | 0.4001 | -1.7804 | True |
| Deep capitulation | max_hold_24h | 3639 | 3639 | 1617 | -0.0241 | 0.0000 | 0.4108 | -1.8673 | True |
| Deep capitulation | max_hold_48h | 3639 | 3638 | 1616 | -0.0267 | 0.0000 | 0.4206 | -2.0009 | True |
| Fast V | galka_tp_48h | 2204 | 2204 | 720 | -0.0467 | 0.0000 | 0.3135 | -1.4849 | True |
| Fast V | reclaim_010_trail_075 | 2204 | 2204 | 720 | -0.0335 | 0.0000 | 0.3090 | -1.8016 | True |
| Fast V | reclaim_010_trail_atr | 2204 | 2204 | 720 | -0.0313 | 0.0000 | 0.3090 | -1.8016 | True |
| Fast V | reclaim_010_trail_swing | 2204 | 2204 | 720 | -0.0327 | 0.0000 | 0.3090 | -1.8016 | True |
| Fast V | partial_galka_runner | 2204 | 2204 | 720 | -0.0401 | 0.0000 | 0.3076 | -1.6308 | True |
| Fast V | max_hold_12h | 2204 | 2204 | 720 | -0.0050 | 0.0000 | 0.2945 | -1.1552 | True |
| Fast V | max_hold_24h | 2204 | 2204 | 720 | -0.0031 | 0.0000 | 0.3004 | -1.1439 | True |
| Fast V | max_hold_48h | 2204 | 2204 | 720 | -0.0341 | 0.0000 | 0.3072 | -1.7975 | True |
| Multi-test | galka_tp_48h | 19056 | 19056 | 7071 | -0.0331 | 0.0000 | 0.3588 | -1.3441 | True |
| Multi-test | reclaim_010_trail_075 | 19056 | 19056 | 7071 | -0.0128 | 0.0000 | 0.3554 | -1.6250 | True |
| Multi-test | reclaim_010_trail_atr | 19056 | 19056 | 7071 | -0.0121 | 0.0000 | 0.3554 | -1.6250 | True |
| Multi-test | reclaim_010_trail_swing | 19056 | 19056 | 7071 | -0.0138 | 0.0000 | 0.3554 | -1.6250 | True |
| Multi-test | partial_galka_runner | 19056 | 19056 | 7071 | -0.0229 | 0.0000 | 0.3539 | -1.4778 | True |
| Multi-test | max_hold_12h | 19056 | 19056 | 7071 | -0.0112 | 0.0000 | 0.3360 | -1.4683 | True |
| Multi-test | max_hold_24h | 19056 | 19056 | 7071 | -0.0125 | 0.0000 | 0.3446 | -1.5421 | True |
| Multi-test | max_hold_48h | 19056 | 19056 | 7071 | -0.0185 | 0.0000 | 0.3524 | -1.7253 | True |
| Rounded recovery | galka_tp_48h | 9808 | 9808 | 3304 | -0.0184 | 0.0000 | 0.3270 | -0.9625 | True |
| Rounded recovery | reclaim_010_trail_075 | 9808 | 9808 | 3304 | -0.0098 | 0.0000 | 0.3217 | -1.4606 | True |
| Rounded recovery | reclaim_010_trail_atr | 9808 | 9808 | 3304 | -0.0080 | 0.0000 | 0.3217 | -1.4606 | True |
| Rounded recovery | reclaim_010_trail_swing | 9808 | 9808 | 3304 | -0.0106 | 0.0000 | 0.3217 | -1.4606 | True |
| Rounded recovery | partial_galka_runner | 9808 | 9808 | 3304 | -0.0141 | 0.0000 | 0.3206 | -1.2037 | True |
| Rounded recovery | max_hold_12h | 9808 | 9808 | 3304 | -0.0087 | 0.0000 | 0.3049 | -1.3376 | True |
| Rounded recovery | max_hold_24h | 9808 | 9808 | 3304 | -0.0065 | 0.0000 | 0.3126 | -1.3287 | True |
| Rounded recovery | max_hold_48h | 9808 | 9808 | 3304 | -0.0131 | 0.0000 | 0.3192 | -1.5146 | True |
| Rounded recovery | reclaim_000_trail_015 | 9808 | 9808 | 3304 | 0.0058 | 0.0000 | 0.3283 | -0.9145 | True |
| Rounded recovery | reclaim_000_trail_030 | 9808 | 9808 | 3304 | 0.0047 | 0.0000 | 0.3283 | -0.9145 | True |
| Rounded recovery | reclaim_000_trail_050 | 9808 | 9808 | 3304 | 0.0037 | 0.0000 | 0.3283 | -0.9145 | True |
| Multi-test | reclaim_010_trail_015 | 19056 | 19056 | 7071 | -0.0085 | 0.0000 | 0.3554 | -1.6250 | True |
| Multi-test | reclaim_000_trail_015 | 19056 | 19056 | 7071 | -0.0089 | 0.0000 | 0.3603 | -1.2885 | True |
| Multi-test | reclaim_020_trail_015 | 19056 | 19052 | 7067 | -0.0096 | 0.0000 | 0.3496 | -2.0614 | True |
| Deep capitulation | reclaim_020_trail_015 | 3639 | 3638 | 1616 | -0.0166 | 0.0000 | 0.4195 | -2.4577 | True |
| Deep capitulation | reclaim_020_trail_030 | 3639 | 3638 | 1616 | -0.0209 | 0.0000 | 0.4195 | -2.4577 | True |
| Fast V | reclaim_000_trail_015 | 2204 | 2204 | 720 | -0.0264 | 0.0000 | 0.3149 | -1.4765 | True |

All reclaim buffers (0.00/0.10/0.20%), fixed trails (0.15/0.30/0.50/0.75/1.00%), ATR trail, two-bar-confirmed local-minimum trail, fixed GALKA TP, partial runner, and maximum holds remain in evaluation.json.

## Cross-symbol portability on final OOS

| galka_type | symbol | count_complete | return_24h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|---|
| Deep capitulation | BTCUSDT | 1160 | 0.9810 | 0.9715 | 0.9874 | 0.2096 | -0.0061 | False |
| Deep capitulation | ETHUSDT | 1333 | 0.9700 | 0.9594 | 0.9779 | 0.4087 | -0.1100 | False |
| Deep capitulation | SOLUSDT | 886 | 0.9752 | 0.9627 | 0.9835 | 0.3552 | 0.0199 | False |
| Fast V | BTCUSDT | 696 | 0.9799 | 0.9665 | 0.9880 | 0.1787 | 0.0050 | False |
| Fast V | ETHUSDT | 677 | 0.9926 | 0.9828 | 0.9968 | 0.2571 | 0.0218 | False |
| Fast V | SOLUSDT | 614 | 0.9658 | 0.9483 | 0.9775 | 0.2636 | -0.1379 | False |
| Multi-test | BTCUSDT | 5826 | 0.9847 | 0.9812 | 0.9876 | 0.1821 | -0.0005 | False |
| Multi-test | ETHUSDT | 6151 | 0.9805 | 0.9767 | 0.9837 | 0.3207 | -0.0308 | False |
| Multi-test | SOLUSDT | 6120 | 0.9809 | 0.9771 | 0.9840 | 0.2787 | -0.0065 | False |
| Rounded recovery | BTCUSDT | 3205 | 0.9860 | 0.9813 | 0.9895 | 0.1639 | -0.0090 | False |
| Rounded recovery | ETHUSDT | 2844 | 0.9845 | 0.9793 | 0.9885 | 0.2867 | -0.0187 | False |
| Rounded recovery | SOLUSDT | 3347 | 0.9872 | 0.9827 | 0.9904 | 0.2470 | -0.0030 | False |

## Timeframe robustness on final OOS

| galka_type | interval | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|
| Deep capitulation | 15m | 727 | 0.9656 | 0.3625 | -0.0535 | False |
| Deep capitulation | 1h | 200 | 0.9650 | 0.4976 | -0.0217 | False |
| Deep capitulation | 30m | 407 | 0.9631 | 0.4544 | -0.0673 | False |
| Deep capitulation | 5m | 2045 | 0.9819 | 0.2733 | -0.0312 | False |
| Fast V | 15m | 409 | 0.9804 | 0.3119 | -0.0278 | False |
| Fast V | 1h | 131 | 0.9618 | 0.3633 | -0.0715 | False |
| Fast V | 30m | 260 | 0.9808 | 0.2827 | 0.0057 | False |
| Fast V | 5m | 1187 | 0.9815 | 0.1865 | -0.0402 | False |
| Multi-test | 15m | 3830 | 0.9812 | 0.2891 | -0.0051 | False |
| Multi-test | 1h | 823 | 0.9708 | 0.4290 | -0.0437 | False |
| Multi-test | 30m | 1810 | 0.9746 | 0.3546 | -0.0159 | False |
| Multi-test | 5m | 11634 | 0.9842 | 0.2249 | -0.0125 | False |
| Rounded recovery | 15m | 1885 | 0.9846 | 0.2590 | -0.0227 | False |
| Rounded recovery | 1h | 414 | 0.9758 | 0.4077 | -0.0448 | False |
| Rounded recovery | 30m | 892 | 0.9843 | 0.3210 | -0.0039 | False |
| Rounded recovery | 5m | 6205 | 0.9873 | 0.1874 | -0.0041 | False |

## Best and worst final-OOS regimes

Best by Balanced fixed-notional EV:

| galka_type | regime | volatility_regime | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|
| Fast V | uptrend | low | 265 | 0.9925 | 0.2061 | 0.0829 | False |
| Rounded recovery | downtrend | high | 739 | 0.9865 | 0.4276 | 0.0380 | False |
| Deep capitulation | downtrend | low | 234 | 0.9786 | 0.2482 | 0.0267 | False |
| Multi-test | uptrend | low | 1509 | 0.9887 | 0.1681 | 0.0188 | False |
| Deep capitulation | uptrend | low | 131 | 0.9924 | 0.2040 | 0.0098 | False |
| Rounded recovery | range | normal | 1137 | 0.9930 | 0.2037 | 0.0081 | False |
| Rounded recovery | range | low | 661 | 0.9939 | 0.1659 | 0.0066 | False |
| Multi-test | range | low | 1087 | 0.9825 | 0.2163 | 0.0043 | False |

Worst by Balanced fixed-notional EV:

| galka_type | regime | volatility_regime | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|
| Deep capitulation | uptrend | high | 169 | 0.9527 | 0.3037 | -0.2292 | False |
| Deep capitulation | range | high | 251 | 0.9681 | 0.3334 | -0.1358 | False |
| Fast V | uptrend | high | 321 | 0.9595 | 0.2802 | -0.1025 | False |
| Rounded recovery | range | high | 262 | 0.9733 | 0.3111 | -0.0963 | False |
| Fast V | downtrend | normal | 82 | 0.9878 | 0.1782 | -0.0764 | False |
| Fast V | range | high | 93 | 0.9785 | 0.2158 | -0.0646 | False |
| Deep capitulation | uptrend | normal | 274 | 0.9781 | 0.2408 | -0.0576 | False |
| Deep capitulation | downtrend | high | 849 | 0.9764 | 0.4715 | -0.0410 | False |

## Recent drift

| galka_type | window | count | depth_p75 | historical_depth_p75 | depth_p75_delta | return_24h_probability | insufficient_data |
|---|---|---|---|---|---|---|---|
| Deep capitulation | 7d | 55 | 0.2620 | 0.5058 | -0.2438 | 0.9818 | False |
| Fast V | 7d | 33 | 0.1513 | 0.3446 | -0.1934 | 0.9697 | True |
| Multi-test | 7d | 232 | 0.2237 | 0.3662 | -0.1425 | 0.9784 | False |
| Rounded recovery | 7d | 128 | 0.1855 | 0.3029 | -0.1174 | 0.9922 | False |
| Deep capitulation | 30d | 203 | 0.2851 | 0.5058 | -0.2207 | 0.9803 | False |
| Fast V | 30d | 147 | 0.1986 | 0.3446 | -0.1460 | 0.9932 | False |
| Multi-test | 30d | 1069 | 0.2225 | 0.3662 | -0.1437 | 0.9832 | False |
| Rounded recovery | 30d | 592 | 0.2403 | 0.3029 | -0.0626 | 0.9865 | False |
| Deep capitulation | 90d | 771 | 0.2522 | 0.5058 | -0.2536 | 0.9844 | False |
| Fast V | 90d | 418 | 0.1811 | 0.3446 | -0.1636 | 0.9952 | False |
| Multi-test | 90d | 3489 | 0.2193 | 0.3662 | -0.1469 | 0.9842 | False |
| Rounded recovery | 90d | 1713 | 0.1852 | 0.3029 | -0.1177 | 0.9895 | False |
| Deep capitulation | 180d | 1421 | 0.3251 | 0.5058 | -0.1807 | 0.9719 | False |
| Fast V | 180d | 825 | 0.2133 | 0.3446 | -0.1313 | 0.9867 | False |
| Multi-test | 180d | 7128 | 0.2586 | 0.3662 | -0.1077 | 0.9776 | False |
| Rounded recovery | 180d | 3403 | 0.2371 | 0.3029 | -0.0658 | 0.9830 | False |
| Deep capitulation | 365d | 2706 | 0.3094 | 0.5058 | -0.1964 | 0.9749 | False |
| Fast V | 365d | 1594 | 0.2233 | 0.3446 | -0.1213 | 0.9793 | False |
| Multi-test | 365d | 14098 | 0.2579 | 0.3662 | -0.1083 | 0.9818 | False |
| Rounded recovery | 365d | 7136 | 0.2261 | 0.3029 | -0.0768 | 0.9843 | False |

## Stable versus unstable feature relationships

| feature | target | train_spearman | validation_spearman | final_oos_spearman | stable_direction |
|---|---|---|---|---|---|
| atr_pct | mae_pct | 0.3407 | 0.2921 | 0.2842 | True |
| atr_pct | balanced_net_return_pct | 0.2575 | 0.2177 | 0.1998 | True |
| trend_slope_atr | mae_pct | -0.1158 | -0.1177 | -0.1207 | True |
| prior_touches | mae_pct | -0.1288 | -0.1126 | -0.0927 | True |
| trend_slope_atr | balanced_net_return_pct | -0.0899 | -0.0912 | -0.0890 | True |
| drop_atr | mae_pct | 0.1135 | 0.0974 | 0.0813 | True |
| prior_touches | balanced_net_return_pct | -0.0909 | -0.0786 | -0.0620 | True |
| near_low_bars | mae_pct | -0.0855 | -0.0629 | -0.0574 | True |
| base_width_bars | mae_pct | -0.0855 | -0.0629 | -0.0574 | True |
| close_lift_atr | mae_pct | 0.0861 | 0.0637 | 0.0554 | True |
| sharpness_atr | mae_pct | 0.0778 | 0.0634 | 0.0525 | True |
| drop_atr | balanced_net_return_pct | 0.0770 | 0.0623 | 0.0503 | True |
| recovery_ratio | mae_pct | -0.0521 | -0.0346 | -0.0446 | True |
| recovery_ratio | balanced_net_return_pct | -0.0518 | -0.0327 | -0.0423 | True |
| fall_speed_atr | mae_pct | 0.0593 | 0.0499 | 0.0382 | True |

Only same-direction train/validation/final-OOS Spearman relationships with |ρ| ≥ 0.02 in every split are listed as stable. Omitted relationships are not promoted as evidence; multiple-testing risk still applies.

No profile in this report changes production paper defaults. Every grid and exit experiment is paper-only; Aggressive is stress-test-only; auto-paper remains disabled.
