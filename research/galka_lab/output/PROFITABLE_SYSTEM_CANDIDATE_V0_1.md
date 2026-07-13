# Galka filtered paper candidate v0.1

## Status

This is a **research candidate**, not a proven or approved live strategy. It was derived from the Galka Lab artifact without changing the original dataset, model, or final-OOS rows.

The broad all-candidate strategies remain negative on final OOS. The purpose of this report is to test whether a narrow, interpretable regime allowlist can isolate a positive subset.

## Data and selection protocol

- Source: Galka Lab full artifact from workflow run `29214168169`.
- Dataset: `events.csv.gz`, 168,099 independent event-family representatives.
- Train: 2020-01-01 through 2023-12-03.
- Validation: 2023-12-09 through 2025-03-16.
- Final OOS: 2025-03-22 through 2026-07-11.
- Rule discovery used validation only.
- Final OOS was used only after the validation rules were frozen for this experiment.
- Selection cell: `symbol × interval × galka_type × trend regime × volatility regime`.
- Minimum validation sample: 80 candidates.
- A cell was eligible only when its validation day-block bootstrap 95% lower bound for mean return was positive.
- Candidate-level fixed-notional returns include no-activation and no-fill cases as 0% cash returns; unresolved censored rows are excluded.

## Execution target tested

`exit_reclaim_000_trail_015_net_return_pct`

Interpretation:

- Balanced train-fitted ladder profile for the galka type.
- Long-only.
- Trailing arms at the GALKA level with no extra reclaim buffer.
- Trail distance: 0.15%.
- Lab cost assumptions: maker 0.02%, taker 0.05%, fixed slippage 0.02%.
- Funding, latency, queue position, partial fills, and exchange-specific liquidation behavior are not modeled.

## Frozen allowlist selected on validation

| Symbol | Interval | Galka type | Trend regime | Volatility regime | Validation n | Validation mean |
|---|---:|---|---|---|---:|---:|
| SOLUSDT | 5m | Rounded recovery | uptrend | high | 137 | +0.1642% |
| ETHUSDT | 15m | Fast V | uptrend | normal | 91 | +0.1605% |
| SOLUSDT | 5m | Deep capitulation | downtrend | high | 123 | +0.1521% |
| BTCUSDT | 15m | Deep capitulation | downtrend | high | 86 | +0.1415% |
| SOLUSDT | 30m | Multi-test | range | normal | 80 | +0.1130% |

## Final-OOS result after freezing the allowlist

| Metric | Result |
|---|---:|
| Candidates | 512 |
| Candidate-level mean net return | **+0.0599%** |
| UTC-day block-bootstrap 95% CI | **+0.0227% to +0.0844%** |
| Positive-return candidates | 45.5% |
| Zero-return cash / no-fill candidates | approximately 54% |
| Negative candidates | 1 |
| Worst candidate | **-8.1310%** |

Per-cell final-OOS means:

| Symbol | Interval | Galka type | Regime | Volatility | OOS n | OOS mean |
|---|---:|---|---|---|---|---:|---:|
| SOLUSDT | 5m | Rounded recovery | uptrend | high | 139 | +0.0688% |
| ETHUSDT | 15m | Fast V | uptrend | normal | 69 | +0.0532% |
| SOLUSDT | 5m | Deep capitulation | downtrend | high | 146 | +0.0410% |
| BTCUSDT | 15m | Deep capitulation | downtrend | high | 76 | +0.0729% |
| SOLUSDT | 30m | Multi-test | range | normal | 82 | +0.0717% |

## Critical risk finding

The positive mean is not sufficient for deployment. The sample contains one extreme loss of -8.1310%, while most candidates are either no-fill cash or small winners. This indicates a negatively skewed strategy with rare severe tail loss.

The existing generic fixed, ATR, and hybrid stop experiments did not produce a robust positive final-OOS lower confidence bound when selected with the same simple cell-screening method. Therefore this candidate must **not** be enabled for auto-paper or real trading yet.

## Required next research pass

Build a dedicated portfolio replay for this frozen allowlist:

1. Re-run 1m execution only for allowlisted candidates.
2. Enforce one active campaign per symbol.
3. Deduplicate simultaneous 5m/15m/30m signals.
4. Test hard stops jointly with this exact exit:
   - depth stops;
   - ATR stops;
   - time + depth hybrid;
   - fixed account-risk stops.
5. Select stop and grid parameters on train/validation only.
6. Reserve a new chronological holdout or collect live-forward shadow data before promotion.
7. Include funding, current venue fees, realistic slippage, missed fills, reconnect recovery, and notification delay.
8. Report equity curve, max drawdown, CVaR, longest drawdown, trade overlap, exposure, and deposit survival.

## Candidate product behavior

Until the risk pass is complete:

- Radar may label these five cells as `Research candidate`.
- Shadow mode may automatically record them.
- Restricted auto-paper remains disabled by default.
- Manual GALKA trading remains the only campaign-creation path.
- No real-order path is authorized by this report.
