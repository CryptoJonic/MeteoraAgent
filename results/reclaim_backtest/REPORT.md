# Galka Reclaim Trailing Backtest

## Scope

- Data: Binance USD-M Futures 15-minute candles.
- Period: 2020-01-01 through 2026-07-10.
- Symbols: BTCUSDT, ETHUSDT and SOLUSDT.
- Starting paper deposit: $1,000, split into three isolated sleeves of $333.33.
- Long only; six planned entries at -0.25%, -0.70%, -1.25%, -1.90%, -2.65% and -3.50% below V-low.
- Reclaim trailing: activate 0.10% above V-low, initial stop at V-low, then 0.75% below the high-water mark.
- Costs: maker 0.02%, taker 0.05%, slippage 0.02%; funding excluded.
- Fixed notional per symbol, no compounding.

## Full-history results

| Variant | Ending deposit | Return | Max drawdown | Trades | Win rate | Profit factor | Liquidations |
|---|---:|---:|---:|---:|---:|---:|---:|
| V-low target, $3,333/coin | $9.60 | -99.04% | -99.23% | 124 | 92.74% | 0.28 | 3 |
| Trail 0.75%, $3,333/coin | $0.00 | -100.00% | -100.00% | 150 | 92.67% | 0.46 | 3 |
| Trail 0.75%, $1,000/coin | $0.00 | -100.00% | -100.00% | 279 | 92.47% | 0.50 | 3 |
| Trail 0.75%, $500/coin | $2,523.89 | +152.39% | -48.57% | 4,780 | 95.98% | 1.21 | 2 |
| Trail 0.75%, $400/coin | $2,923.21 | +192.32% | -26.00% | 6,347 | 96.12% | 1.28 | 0 |
| Trail 0.75%, $300/coin | $2,442.41 | +144.24% | -23.39% | 6,347 | 96.12% | 1.28 | 0 |
| Trail 0.75%, $250/coin | $2,202.01 | +120.20% | -21.66% | 6,347 | 96.12% | 1.28 | 0 |
| Trail 0.75%, $200/coin | $1,961.60 | +96.16% | -19.49% | 6,347 | 96.12% | 1.28 | 0 |

## Selected $400/coin result by year

| Year | PnL | Ending deposit |
|---|---:|---:|
| 2020 | +$184.87 | $1,184.87 |
| 2021 | +$1,711.33 | $2,896.20 |
| 2022 | -$591.86 | $2,304.34 |
| 2023 | +$568.79 | $2,873.13 |
| 2024 | +$176.42 | $3,049.55 |
| 2025 | -$147.32 | $2,902.23 |
| 2026 through July 10 | +$20.98 | $2,923.21 |

The largest drawdown for this variant was approximately 26%, from the late-2021 peak into November 2022.

## 2026 reset test

Resetting the deposit to $1,000 on 2026-01-01, the $400/coin variant produced 212 trades, ended at $1,020.98 (+2.10%), had a 7.23% maximum drawdown, a 93.87% win rate and a 1.08 profit factor. The worst trade was -$57.83 and the best trade was +$68.32.

## Interpretation

The existing $3,333 per coin setting is unacceptable: all three sleeves were liquidated and the total paper deposit reached zero. A high win rate did not protect the account from rare large losses.

Among the tested fixed sizes, $400 per coin had the highest full-history ending deposit without simulated liquidations. This does not make it proven safe: the result was heavily helped by 2021 and SOL, while the 2026 profit factor was only about 1.08. A safer deployment should use equity-based sizing, a hard account-level loss limit and a separate exact replay of the shared cross-margin implementation.

## Limitations

This replay uses 15-minute OHLC candles and a conservative causal trailing policy: an existing stop is checked before the current candle high can raise it, so a newly raised stop becomes effective on the next candle. It does not model funding, mark/index basis, order-book queue, latency, exchange outages or real partial fills. Historical results do not guarantee future performance.
