# Galka Lab decision report

## Promotion decision

Return frequency is not treated as profitability. A type is not eligible for auto-paper when its fee-adjusted Balanced fixed-notional OOS EV or fixed-risk result is non-positive. Live shadow validation remains mandatory even after a historical threshold passes.

| galka_type | count_complete | return_24h_probability | mean_net_return_pct | mean_fixed_risk_r | cvar_95_pct | historical_screen_pass | auto_paper_eligible | decision |
|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9858 | -0.0107 | -0.0119 | -1.4821 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Multi-test | 18088 | 0.9820 | -0.0136 | -0.0040 | -1.6336 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Fast V | 1969 | 0.9797 | -0.0341 | -0.0086 | -1.8178 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Deep capitulation | 3434 | 0.9752 | -0.0378 | -0.0063 | -2.2451 | False | False | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |

Auto-paper remains disabled; this report cannot enable it.

## Most stable observational return types on untouched final OOS

| galka_type | count_complete | return_6h_probability | return_24h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p75 | depth_success_p90 | depth_success_p95 | depth_success_p99 | return_minutes_p50 |
|---|---|---|---|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9757 | 0.9858 | 0.9832 | 0.9880 | 0.2252 | 0.5668 | 1.0175 | 4.2319 | 1.0000 |
| Multi-test | 18088 | 0.9699 | 0.9820 | 0.9799 | 0.9838 | 0.2589 | 0.6428 | 1.2051 | 4.6462 | 0.7500 |
| Fast V | 1969 | 0.9726 | 0.9797 | 0.9725 | 0.9850 | 0.2355 | 0.5586 | 1.0531 | 3.6100 | 0.2500 |

## Day-block bootstrap uncertainty on untouched final OOS

UTC activation days are resampled as blocks, keeping same-day BTC/ETH/SOL and cross-timeframe events together. These intervals are the primary uncertainty view; event-level Wilson intervals remain a secondary screening aid.

| galka_type | event_count | activated_count | returned_count | block_count | return_1h_probability | return_1h_block_ci_low | return_1h_block_ci_high | return_24h_probability | return_24h_block_ci_low | return_24h_block_ci_high | return_48h_probability | return_48h_block_ci_low | return_48h_block_ci_high | depth_success_p50 | depth_success_p50_block_ci_low | depth_success_p50_block_ci_high | depth_success_p75 | depth_success_p75_block_ci_low | depth_success_p75_block_ci_high | depth_success_p90 | depth_success_p90_block_ci_low | depth_success_p90_block_ci_high | insufficient_data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | 3724 | 3435 | 3405 | 437 | 0.9377 | 0.9246 | 0.9493 | 0.9752 | 0.9654 | 0.9831 | 0.9834 | 0.9761 | 0.9899 | 0.1367 | 0.1208 | 0.1496 | 0.3208 | 0.2881 | 0.3496 | 0.7186 | 0.6319 | 0.8668 | False |
| Fast V | 2206 | 1969 | 1952 | 422 | 0.9507 | 0.9390 | 0.9613 | 0.9797 | 0.9713 | 0.9876 | 0.9853 | 0.9779 | 0.9932 | 0.0924 | 0.0852 | 0.0989 | 0.2355 | 0.2067 | 0.2657 | 0.5586 | 0.4673 | 0.6642 | False |
| Multi-test | 19144 | 18096 | 17986 | 477 | 0.9420 | 0.9349 | 0.9485 | 0.9820 | 0.9774 | 0.9863 | 0.9870 | 0.9823 | 0.9909 | 0.0962 | 0.0924 | 0.1018 | 0.2589 | 0.2448 | 0.2772 | 0.6428 | 0.5775 | 0.7019 | False |
| Rounded recovery | 9789 | 9354 | 9316 | 477 | 0.9403 | 0.9334 | 0.9469 | 0.9858 | 0.9816 | 0.9895 | 0.9895 | 0.9855 | 0.9927 | 0.0855 | 0.0800 | 0.0900 | 0.2252 | 0.2078 | 0.2417 | 0.5668 | 0.5129 | 0.6228 | False |

## Types that should not be promoted

| galka_type | count_complete | return_24h_probability | mean_net_return_pct | mean_fixed_risk_r | cvar_95_pct | decision |
|---|---|---|---|---|---|---|
| Rounded recovery | 9354 | 0.9858 | -0.0107 | -0.0119 | -1.4821 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Multi-test | 18088 | 0.9820 | -0.0136 | -0.0040 | -1.6336 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Fast V | 1969 | 0.9797 | -0.0341 | -0.0086 | -1.8178 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |
| Deep capitulation | 3434 | 0.9752 | -0.0378 | -0.0063 | -2.2451 | not promoted: fee-adjusted OOS EV or fixed-risk result is non-positive |

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
| Deep capitulation | Conservative | 0.15% (49.1%), 0.30% (25.4%), 0.45% (15.5%) | 0.6000 | 2.6965 | 55.7300 | 48.9000 | True | False |
| Deep capitulation | Balanced | 0.15% (40.3%), 0.30% (20.9%), 0.45% (12.8%) | 1.4120 | 2.6965 | 83.5951 | 31.4213 | True | False |
| Deep capitulation | Aggressive | 0.15% (37.6%), 0.30% (19.5%), 0.45% (11.9%) | 2.6965 | 2.6965 | 111.4601 | 21.8035 | True | True |
| Fast V | Conservative | 0.15% (57.1%), 0.30% (22.8%), 0.45% (12.5%) | 0.6000 | 1.8719 | 39.2373 | 48.9000 | True | False |
| Fast V | Balanced | 0.15% (52.9%), 0.30% (21.2%), 0.45% (11.6%) | 1.0454 | 1.8719 | 58.8559 | 31.7879 | True | False |
| Fast V | Aggressive | 0.15% (48.0%), 0.30% (19.2%), 0.45% (10.5%) | 1.8719 | 1.8719 | 78.4746 | 22.6281 | True | True |
| Multi-test | Conservative | 0.15% (55.2%), 0.30% (23.4%), 0.45% (13.3%) | 0.6000 | 2.0618 | 43.0359 | 48.9000 | True | False |
| Multi-test | Balanced | 0.15% (48.9%), 0.30% (20.7%), 0.45% (11.7%) | 1.0811 | 2.0618 | 64.5539 | 31.7522 | True | False |
| Multi-test | Aggressive | 0.15% (45.2%), 0.30% (19.1%), 0.45% (10.9%) | 2.0618 | 2.0618 | 86.0719 | 22.4382 | True | True |
| Rounded recovery | Conservative | 0.15% (56.8%), 0.30% (23.5%), 0.45% (12.2%) | 0.6000 | 1.8197 | 38.1939 | 48.9000 | True | False |
| Rounded recovery | Balanced | 0.15% (52.1%), 0.30% (21.6%), 0.45% (11.2%) | 0.9136 | 1.8197 | 57.2908 | 31.9197 | True | False |
| Rounded recovery | Aggressive | 0.15% (47.9%), 0.30% (19.9%), 0.45% (10.3%) | 1.8197 | 1.8197 | 76.3878 | 22.6803 | True | True |

## Grid profiles

Fixed-notional EV is candidate-level: observable non-activations and fully unfilled grids are 0%, while unresolved censored candidates are excluded. Return on filled capital and filled win rate remain conditional on a fill.

| galka_type | profile | eligible_count | count | fill_probability | fill_probability_given_activation | full_fill_probability | expected_fill_fraction | expected_mae_pct | mean_net_return_pct | median_net_return_pct | mean_return_on_filled_pct | mean_fixed_risk_r | win_rate | filled_win_rate | cvar_95_pct | cvar_95_fixed_risk_r | paper_only | stress_test_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | Conservative | 3695 | 3691 | 0.4452 | 0.4790 | 0.1226 | 0.2811 | 0.5994 | -0.0349 | 0.0000 | -0.0532 | -0.0057 | 0.4237 | 0.9531 | -2.2475 | -0.9331 | True | False |
| Deep capitulation | Balanced | 3695 | 3691 | 0.4452 | 0.4790 | 0.0547 | 0.2739 | 0.5994 | -0.0378 | 0.0000 | -0.0501 | -0.0063 | 0.4237 | 0.9531 | -2.2451 | -0.9339 | True | False |
| Deep capitulation | Aggressive | 3695 | 3691 | 0.4452 | 0.4790 | 0.0336 | 0.0830 | 0.5994 | -0.0270 | 0.0000 | 0.0996 | 0.0114 | 0.4248 | 0.9555 | -1.7268 | -0.9576 | True | True |
| Fast V | Conservative | 2186 | 2186 | 0.3271 | 0.3631 | 0.0919 | 0.2055 | 0.4905 | -0.0301 | 0.0000 | -0.0643 | -0.0047 | 0.3092 | 0.9455 | -1.7596 | -0.9232 | True | False |
| Fast V | Balanced | 2186 | 2186 | 0.3271 | 0.3631 | 0.0631 | 0.2352 | 0.4905 | -0.0341 | 0.0000 | -0.0836 | -0.0086 | 0.3092 | 0.9455 | -1.8178 | -0.9207 | True | False |
| Fast V | Aggressive | 2186 | 2186 | 0.3271 | 0.3631 | 0.0306 | 0.0780 | 0.4905 | -0.0216 | 0.0000 | 0.0581 | 0.0113 | 0.3102 | 0.9483 | -1.3856 | -0.9623 | True | True |
| Multi-test | Conservative | 19046 | 19046 | 0.3709 | 0.3906 | 0.1065 | 0.2351 | 0.4716 | -0.0098 | 0.0000 | 0.0033 | -0.0009 | 0.3552 | 0.9575 | -1.5749 | -0.9826 | True | False |
| Multi-test | Balanced | 19046 | 19046 | 0.3709 | 0.3906 | 0.0602 | 0.2546 | 0.4716 | -0.0136 | 0.0000 | -0.0085 | -0.0040 | 0.3552 | 0.9575 | -1.6336 | -0.9820 | True | False |
| Multi-test | Aggressive | 19046 | 19046 | 0.3709 | 0.3906 | 0.0333 | 0.0844 | 0.4716 | -0.0035 | 0.0000 | 0.1345 | 0.0181 | 0.3558 | 0.9591 | -1.1820 | -1.0145 | True | True |
| Rounded recovery | Conservative | 9764 | 9764 | 0.3368 | 0.3516 | 0.0930 | 0.2115 | 0.3696 | -0.0042 | 0.0000 | -0.0113 | -0.0078 | 0.3215 | 0.9544 | -1.3591 | -1.1400 | True | False |
| Rounded recovery | Balanced | 9764 | 9764 | 0.3368 | 0.3516 | 0.0602 | 0.2399 | 0.3696 | -0.0107 | 0.0000 | -0.0295 | -0.0119 | 0.3215 | 0.9544 | -1.4821 | -1.1371 | True | False |
| Rounded recovery | Aggressive | 9764 | 9764 | 0.3368 | 0.3516 | 0.0283 | 0.0772 | 0.3696 | 0.0053 | 0.0000 | 0.1035 | 0.0092 | 0.3218 | 0.9553 | -0.8896 | -1.1779 | True | True |

## Stop trade-offs

| galka_type | stop | eligible_count | count | filled_count | mean_net_return_pct | win_rate | cvar_95_pct |
|---|---|---|---|---|---|---|---|
| Deep capitulation | fixed | 3695 | 3691 | 1641 | -0.0178 | 0.3977 | -1.6203 |
| Deep capitulation | percentile | 3695 | 3691 | 1641 | -0.0263 | 0.4048 | -1.8525 |
| Deep capitulation | atr | 3695 | 3691 | 1641 | -0.0114 | 0.3690 | -1.0372 |
| Deep capitulation | time | 3695 | 3695 | 1645 | -0.0356 | 0.4222 | -1.5047 |
| Deep capitulation | probability | 3695 | 3691 | 1641 | -0.0332 | 0.4059 | -1.9986 |
| Deep capitulation | hybrid | 3695 | 3691 | 1641 | -0.0127 | 0.3685 | -1.0542 |
| Deep capitulation | no_stop | 3695 | 3691 | 1641 | -0.0378 | 0.4237 | -2.2451 |
| Fast V | fixed | 2186 | 2186 | 715 | -0.0207 | 0.2919 | -1.3705 |
| Fast V | percentile | 2186 | 2186 | 715 | -0.0187 | 0.2909 | -1.3265 |
| Fast V | atr | 2186 | 2186 | 715 | -0.0221 | 0.2603 | -1.0057 |
| Fast V | time | 2186 | 2186 | 715 | -0.0188 | 0.3088 | -0.9094 |
| Fast V | probability | 2186 | 2186 | 715 | -0.0266 | 0.3065 | -1.6482 |
| Fast V | hybrid | 2186 | 2186 | 715 | -0.0207 | 0.2603 | -0.9767 |
| Fast V | no_stop | 2186 | 2186 | 715 | -0.0341 | 0.3092 | -1.8178 |
| Multi-test | fixed | 19046 | 19046 | 7065 | -0.0143 | 0.3338 | -1.4648 |
| Multi-test | percentile | 19046 | 19046 | 7065 | -0.0147 | 0.3345 | -1.4801 |
| Multi-test | atr | 19046 | 19046 | 7065 | -0.0173 | 0.2953 | -1.0042 |
| Multi-test | time | 19046 | 19046 | 7065 | -0.0279 | 0.3539 | -1.2134 |
| Multi-test | probability | 19046 | 19046 | 7065 | -0.0144 | 0.3468 | -1.5897 |
| Multi-test | hybrid | 19046 | 19046 | 7065 | -0.0176 | 0.2950 | -0.9977 |
| Multi-test | no_stop | 19046 | 19046 | 7065 | -0.0136 | 0.3552 | -1.6336 |
| Rounded recovery | fixed | 9764 | 9764 | 3289 | -0.0192 | 0.3043 | -1.4725 |
| Rounded recovery | percentile | 9764 | 9764 | 3289 | -0.0184 | 0.3022 | -1.4442 |
| Rounded recovery | atr | 9764 | 9764 | 3289 | -0.0268 | 0.2700 | -1.1753 |
| Rounded recovery | time | 9764 | 9764 | 3289 | -0.0163 | 0.3232 | -0.9028 |
| Rounded recovery | probability | 9764 | 9764 | 3289 | -0.0158 | 0.3128 | -1.5176 |
| Rounded recovery | hybrid | 9764 | 9764 | 3289 | -0.0260 | 0.2696 | -1.1544 |
| Rounded recovery | no_stop | 9764 | 9764 | 3289 | -0.0107 | 0.3215 | -1.4821 |

## Exit and trailing trade-offs

| galka_type | exit | eligible_count | count | filled_count | mean_net_return_pct | median_net_return_pct | win_rate | cvar_95_pct | paper_only |
|---|---|---|---|---|---|---|---|---|---|
| Deep capitulation | galka_tp_48h | 3695 | 3695 | 1645 | -0.0377 | 0.0000 | 0.4298 | -1.5960 | True |
| Deep capitulation | reclaim_010_trail_075 | 3695 | 3691 | 1641 | -0.0378 | 0.0000 | 0.4237 | -2.2451 | True |
| Deep capitulation | reclaim_010_trail_atr | 3695 | 3691 | 1641 | -0.0336 | 0.0000 | 0.4237 | -2.2451 | True |
| Deep capitulation | reclaim_010_trail_swing | 3695 | 3691 | 1641 | -0.0363 | 0.0000 | 0.4237 | -2.2451 | True |
| Deep capitulation | partial_galka_runner | 3695 | 3691 | 1641 | -0.0378 | 0.0000 | 0.4226 | -1.9141 | True |
| Deep capitulation | max_hold_12h | 3695 | 3691 | 1641 | -0.0214 | 0.0000 | 0.4021 | -1.7528 | True |
| Deep capitulation | max_hold_24h | 3695 | 3691 | 1641 | -0.0224 | 0.0000 | 0.4115 | -1.8369 | True |
| Deep capitulation | max_hold_48h | 3695 | 3691 | 1641 | -0.0245 | 0.0000 | 0.4213 | -1.9688 | True |
| Fast V | galka_tp_48h | 2186 | 2186 | 715 | -0.0474 | 0.0000 | 0.3138 | -1.4983 | True |
| Fast V | reclaim_010_trail_075 | 2186 | 2186 | 715 | -0.0341 | 0.0000 | 0.3092 | -1.8178 | True |
| Fast V | reclaim_010_trail_atr | 2186 | 2186 | 715 | -0.0318 | 0.0000 | 0.3092 | -1.8178 | True |
| Fast V | reclaim_010_trail_swing | 2186 | 2186 | 715 | -0.0334 | 0.0000 | 0.3092 | -1.8178 | True |
| Fast V | partial_galka_runner | 2186 | 2186 | 715 | -0.0407 | 0.0000 | 0.3079 | -1.6455 | True |
| Fast V | max_hold_12h | 2186 | 2186 | 715 | -0.0053 | 0.0000 | 0.2946 | -1.1655 | True |
| Fast V | max_hold_24h | 2186 | 2186 | 715 | -0.0034 | 0.0000 | 0.3005 | -1.1541 | True |
| Fast V | max_hold_48h | 2186 | 2186 | 715 | -0.0347 | 0.0000 | 0.3074 | -1.8136 | True |
| Multi-test | galka_tp_48h | 19046 | 19046 | 7065 | -0.0336 | 0.0000 | 0.3586 | -1.3504 | True |
| Multi-test | reclaim_010_trail_075 | 19046 | 19046 | 7065 | -0.0136 | 0.0000 | 0.3552 | -1.6336 | True |
| Multi-test | reclaim_010_trail_atr | 19046 | 19046 | 7065 | -0.0128 | 0.0000 | 0.3552 | -1.6336 | True |
| Multi-test | reclaim_010_trail_swing | 19046 | 19046 | 7065 | -0.0145 | 0.0000 | 0.3552 | -1.6336 | True |
| Multi-test | partial_galka_runner | 19046 | 19046 | 7065 | -0.0236 | 0.0000 | 0.3537 | -1.4852 | True |
| Multi-test | max_hold_12h | 19046 | 19046 | 7065 | -0.0112 | 0.0000 | 0.3362 | -1.4649 | True |
| Multi-test | max_hold_24h | 19046 | 19046 | 7065 | -0.0129 | 0.0000 | 0.3444 | -1.5447 | True |
| Multi-test | max_hold_48h | 19046 | 19046 | 7065 | -0.0192 | 0.0000 | 0.3523 | -1.7319 | True |
| Rounded recovery | galka_tp_48h | 9764 | 9764 | 3289 | -0.0193 | 0.0000 | 0.3268 | -0.9786 | True |
| Rounded recovery | reclaim_010_trail_075 | 9764 | 9764 | 3289 | -0.0107 | 0.0000 | 0.3215 | -1.4821 | True |
| Rounded recovery | reclaim_010_trail_atr | 9764 | 9764 | 3289 | -0.0089 | 0.0000 | 0.3215 | -1.4821 | True |
| Rounded recovery | reclaim_010_trail_swing | 9764 | 9764 | 3289 | -0.0117 | 0.0000 | 0.3215 | -1.4821 | True |
| Rounded recovery | partial_galka_runner | 9764 | 9764 | 3289 | -0.0150 | 0.0000 | 0.3204 | -1.2225 | True |
| Rounded recovery | max_hold_12h | 9764 | 9764 | 3289 | -0.0093 | 0.0000 | 0.3046 | -1.3511 | True |
| Rounded recovery | max_hold_24h | 9764 | 9764 | 3289 | -0.0070 | 0.0000 | 0.3124 | -1.3402 | True |
| Rounded recovery | max_hold_48h | 9764 | 9764 | 3289 | -0.0139 | 0.0000 | 0.3190 | -1.5324 | True |
| Rounded recovery | reclaim_000_trail_015 | 9764 | 9764 | 3289 | 0.0048 | 0.0000 | 0.3281 | -0.9344 | True |
| Rounded recovery | reclaim_000_trail_030 | 9764 | 9764 | 3289 | 0.0037 | 0.0000 | 0.3281 | -0.9344 | True |
| Rounded recovery | reclaim_000_trail_050 | 9764 | 9764 | 3289 | 0.0027 | 0.0000 | 0.3281 | -0.9344 | True |
| Multi-test | reclaim_010_trail_015 | 19046 | 19046 | 7065 | -0.0091 | 0.0000 | 0.3552 | -1.6336 | True |
| Multi-test | reclaim_000_trail_015 | 19046 | 19046 | 7065 | -0.0095 | 0.0000 | 0.3601 | -1.2968 | True |
| Multi-test | reclaim_020_trail_015 | 19046 | 19046 | 7065 | -0.0106 | 0.0000 | 0.3495 | -2.0796 | True |
| Deep capitulation | reclaim_020_trail_015 | 3695 | 3689 | 1639 | -0.0146 | 0.0000 | 0.4199 | -2.4184 | True |
| Deep capitulation | reclaim_020_trail_030 | 3695 | 3689 | 1639 | -0.0190 | 0.0000 | 0.4199 | -2.4184 | True |
| Fast V | reclaim_000_trail_015 | 2186 | 2186 | 715 | -0.0269 | 0.0000 | 0.3152 | -1.4899 | True |

All reclaim buffers (0.00/0.10/0.20%), fixed trails (0.15/0.30/0.50/0.75/1.00%), ATR trail, two-bar-confirmed local-minimum trail, fixed GALKA TP, partial runner, and maximum holds remain in evaluation.json.

## Cross-symbol portability on final OOS

| galka_type | symbol | count_complete | return_24h_probability | return_24h_ci_low | return_24h_ci_high | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|---|
| Deep capitulation | BTCUSDT | 1171 | 0.9812 | 0.9717 | 0.9876 | 0.2095 | -0.0056 | False |
| Deep capitulation | ETHUSDT | 1352 | 0.9697 | 0.9591 | 0.9776 | 0.4103 | -0.1052 | False |
| Deep capitulation | SOLUSDT | 911 | 0.9759 | 0.9637 | 0.9840 | 0.3539 | 0.0206 | False |
| Fast V | BTCUSDT | 688 | 0.9797 | 0.9661 | 0.9878 | 0.1743 | 0.0046 | False |
| Fast V | ETHUSDT | 672 | 0.9926 | 0.9827 | 0.9968 | 0.2559 | 0.0215 | False |
| Fast V | SOLUSDT | 609 | 0.9655 | 0.9479 | 0.9773 | 0.2643 | -0.1386 | False |
| Multi-test | BTCUSDT | 5826 | 0.9847 | 0.9812 | 0.9876 | 0.1824 | -0.0005 | False |
| Multi-test | ETHUSDT | 6151 | 0.9805 | 0.9767 | 0.9837 | 0.3204 | -0.0326 | False |
| Multi-test | SOLUSDT | 6111 | 0.9809 | 0.9771 | 0.9840 | 0.2786 | -0.0068 | False |
| Rounded recovery | BTCUSDT | 3198 | 0.9859 | 0.9812 | 0.9895 | 0.1643 | -0.0090 | False |
| Rounded recovery | ETHUSDT | 2832 | 0.9841 | 0.9788 | 0.9881 | 0.2879 | -0.0211 | False |
| Rounded recovery | SOLUSDT | 3324 | 0.9871 | 0.9826 | 0.9904 | 0.2453 | -0.0036 | False |

## Timeframe robustness on final OOS

| galka_type | interval | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|
| Deep capitulation | 15m | 740 | 0.9662 | 0.3625 | -0.0517 | False |
| Deep capitulation | 1h | 199 | 0.9648 | 0.5007 | -0.0222 | False |
| Deep capitulation | 30m | 412 | 0.9612 | 0.4602 | -0.0584 | False |
| Deep capitulation | 5m | 2083 | 0.9822 | 0.2727 | -0.0298 | False |
| Fast V | 15m | 407 | 0.9803 | 0.3140 | -0.0279 | False |
| Fast V | 1h | 128 | 0.9609 | 0.3614 | -0.0740 | False |
| Fast V | 30m | 260 | 0.9808 | 0.2822 | 0.0055 | False |
| Fast V | 5m | 1174 | 0.9813 | 0.1868 | -0.0409 | False |
| Multi-test | 15m | 3822 | 0.9812 | 0.2891 | -0.0053 | False |
| Multi-test | 1h | 822 | 0.9708 | 0.4276 | -0.0440 | False |
| Multi-test | 30m | 1809 | 0.9746 | 0.3489 | -0.0219 | False |
| Multi-test | 5m | 11635 | 0.9842 | 0.2249 | -0.0126 | False |
| Rounded recovery | 15m | 1876 | 0.9845 | 0.2590 | -0.0230 | False |
| Rounded recovery | 1h | 413 | 0.9758 | 0.4096 | -0.0449 | False |
| Rounded recovery | 30m | 889 | 0.9843 | 0.3200 | -0.0037 | False |
| Rounded recovery | 5m | 6176 | 0.9870 | 0.1874 | -0.0055 | False |

## Best and worst final-OOS regimes

Best by Balanced fixed-notional EV:

| galka_type | regime | volatility_regime | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|
| Fast V | uptrend | low | 261 | 0.9923 | 0.2052 | 0.0840 | False |
| Rounded recovery | downtrend | high | 729 | 0.9863 | 0.4276 | 0.0378 | False |
| Deep capitulation | downtrend | low | 240 | 0.9792 | 0.2374 | 0.0262 | False |
| Multi-test | uptrend | low | 1515 | 0.9881 | 0.1703 | 0.0140 | False |
| Deep capitulation | uptrend | low | 133 | 0.9925 | 0.2040 | 0.0101 | False |
| Rounded recovery | range | normal | 1132 | 0.9929 | 0.2039 | 0.0081 | False |
| Rounded recovery | range | low | 662 | 0.9940 | 0.1646 | 0.0069 | False |
| Deep capitulation | range | normal | 329 | 0.9818 | 0.2414 | 0.0063 | False |

Worst by Balanced fixed-notional EV:

| galka_type | regime | volatility_regime | count_complete | return_24h_probability | depth_success_p75 | balanced_net_return_pct_mean | insufficient_data |
|---|---|---|---|---|---|---|---|
| Deep capitulation | uptrend | high | 171 | 0.9532 | 0.3058 | -0.2277 | False |
| Deep capitulation | range | high | 258 | 0.9690 | 0.3529 | -0.1289 | False |
| Fast V | uptrend | high | 319 | 0.9592 | 0.2812 | -0.1028 | False |
| Rounded recovery | range | high | 262 | 0.9733 | 0.3111 | -0.0966 | False |
| Fast V | downtrend | normal | 82 | 0.9878 | 0.1739 | -0.0793 | False |
| Fast V | range | high | 93 | 0.9785 | 0.2158 | -0.0646 | False |
| Deep capitulation | uptrend | normal | 275 | 0.9782 | 0.2414 | -0.0517 | False |
| Multi-test | range | high | 672 | 0.9732 | 0.3112 | -0.0404 | False |

## Recent drift

| galka_type | window | count | depth_p75 | historical_depth_p75 | depth_p75_delta | return_24h_probability | insufficient_data |
|---|---|---|---|---|---|---|---|
| Deep capitulation | 7d | 53 | 0.3027 | 0.5049 | -0.2022 | 0.9811 | False |
| Fast V | 7d | 36 | 0.2952 | 0.3446 | -0.0494 | 0.9722 | True |
| Multi-test | 7d | 232 | 0.2331 | 0.3654 | -0.1323 | 0.9784 | False |
| Rounded recovery | 7d | 132 | 0.2650 | 0.3032 | -0.0383 | 0.9924 | False |
| Deep capitulation | 30d | 199 | 0.2851 | 0.5049 | -0.2198 | 0.9799 | False |
| Fast V | 30d | 149 | 0.2067 | 0.3446 | -0.1379 | 0.9933 | False |
| Multi-test | 30d | 1075 | 0.2225 | 0.3654 | -0.1429 | 0.9833 | False |
| Rounded recovery | 30d | 591 | 0.2338 | 0.3032 | -0.0694 | 0.9865 | False |
| Deep capitulation | 90d | 774 | 0.2522 | 0.5049 | -0.2527 | 0.9832 | False |
| Fast V | 90d | 415 | 0.1828 | 0.3446 | -0.1618 | 0.9952 | False |
| Multi-test | 90d | 3464 | 0.2184 | 0.3654 | -0.1470 | 0.9844 | False |
| Rounded recovery | 90d | 1700 | 0.1851 | 0.3032 | -0.1182 | 0.9894 | False |
| Deep capitulation | 180d | 1442 | 0.3250 | 0.5049 | -0.1799 | 0.9716 | False |
| Fast V | 180d | 823 | 0.2136 | 0.3446 | -0.1310 | 0.9866 | False |
| Multi-test | 180d | 7127 | 0.2584 | 0.3654 | -0.1070 | 0.9777 | False |
| Rounded recovery | 180d | 3386 | 0.2361 | 0.3032 | -0.0672 | 0.9826 | False |
| Deep capitulation | 365d | 2755 | 0.3104 | 0.5049 | -0.1945 | 0.9750 | False |
| Fast V | 365d | 1578 | 0.2218 | 0.3446 | -0.1228 | 0.9791 | False |
| Multi-test | 365d | 14109 | 0.2579 | 0.3654 | -0.1075 | 0.9819 | False |
| Rounded recovery | 365d | 7096 | 0.2263 | 0.3032 | -0.0770 | 0.9842 | False |

## Stable versus unstable feature relationships

| feature | target | train_spearman | validation_spearman | final_oos_spearman | stable_direction |
|---|---|---|---|---|---|
| atr_pct | mae_pct | 0.3406 | 0.2929 | 0.2847 | True |
| atr_pct | balanced_net_return_pct | 0.2574 | 0.2182 | 0.1995 | True |
| trend_slope_atr | mae_pct | -0.1157 | -0.1179 | -0.1201 | True |
| prior_touches | mae_pct | -0.1287 | -0.1127 | -0.0931 | True |
| trend_slope_atr | balanced_net_return_pct | -0.0898 | -0.0915 | -0.0882 | True |
| drop_atr | mae_pct | 0.1135 | 0.0974 | 0.0814 | True |
| prior_touches | balanced_net_return_pct | -0.0908 | -0.0785 | -0.0623 | True |
| near_low_bars | mae_pct | -0.0855 | -0.0633 | -0.0579 | True |
| base_width_bars | mae_pct | -0.0855 | -0.0633 | -0.0579 | True |
| close_lift_atr | mae_pct | 0.0862 | 0.0642 | 0.0553 | True |
| sharpness_atr | mae_pct | 0.0777 | 0.0635 | 0.0528 | True |
| drop_atr | balanced_net_return_pct | 0.0769 | 0.0619 | 0.0501 | True |
| recovery_ratio | mae_pct | -0.0520 | -0.0345 | -0.0442 | True |
| recovery_ratio | balanced_net_return_pct | -0.0518 | -0.0323 | -0.0417 | True |
| fall_speed_atr | mae_pct | 0.0592 | 0.0494 | 0.0385 | True |

Only same-direction train/validation/final-OOS Spearman relationships with |ρ| ≥ 0.02 in every split are listed as stable. Omitted relationships are not promoted as evidence; multiple-testing risk still applies.

No profile in this report changes production paper defaults. Every grid and exit experiment is paper-only; Aggressive is stress-test-only; auto-paper remains disabled.
