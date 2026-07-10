# Latest verified historical replay

Generated: 2026-07-10

Workflow: `Galka Historical Replay`, run `29105598781`
Artifact: `galka-btc15m-history`
Artifact SHA-256: `a6fe2290bab8dbcf0f4a573dd7d7d9028a014fd5cb771912505038fb87830c77`
Terminal package SHA-256: `753e2f528ecded86dfc7a51780051ef857137749108799fbed04ab73b5dc30da`

## Dataset

- Binance USD-M Futures BTCUSDT
- 15-minute candles
- 228,672 candles
- 10,409 canonical V-patterns
- 850 non-overlapping simulated trades
- costs: 5 bps fee + 2 bps slippage per side

## Entire replay

- trades: 850
- wins: 712
- losses: 138
- win rate: 83.76%
- average net return per fixed-notional trade: +0.3924%
- profit factor: 2.209
- sum of fixed-notional trade returns: +333.51%
- worst trade: -18.11%
- additive fixed-notional maximum drawdown: -25.52%

The entire replay includes the period used to discover/select the model and is not an unbiased performance estimate.

## Final OOS: 2026-01-01 onward

- trades: 65
- wins: 49
- losses: 16
- win rate: 75.38%
- average net return per fixed-notional trade: +0.2689%
- profit factor: 1.711
- sum of fixed-notional trade returns: +17.48%
- worst trade: -4.28%
- additive fixed-notional maximum drawdown: -7.10%

This independently reproduced result is close to the prior report (67 OOS trades, +0.260% average, PF 1.64), but it does not include live bid/ask, funding, latency, queue position or liquidation effects. Status remains paper candidate.

## Package validation

The generated `.galka.zip` passed these checks:

- candle timestamps are ordered and unique;
- every trade references an existing pattern;
- every filled limit respects the configured deepest entry;
- archive includes manifest, candles, patterns, orders, trades, summary and parameters;
- package opens under the documented Galka terminal schema.
