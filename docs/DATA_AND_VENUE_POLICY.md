# Galka Data and Venue Policy v1.0

## Historical research

All historical pattern discovery, feature engineering, grouping, model training, walk-forward validation and backtesting use Binance market data as the single canonical historical source.

Primary historical symbols:

- BTCUSDT;
- ETHUSDT;
- SOLUSDT.

Primary research venue:

- Binance USDT-M Futures where reliable futures history exists;
- older Binance spot history may be used only to extend market-context research before futures history, and must be explicitly labelled rather than mixed silently.

All higher timeframes are aggregated from the canonical Binance base dataset. Historical results must not combine candles from Binance and Hyperliquid in the same model run.

## Live and paper observation

When Galka moves to live observation or paper trading, the system records Binance and Hyperliquid in parallel.

For every detected Galka and planned order, retain venue-specific data:

- exchange timestamp and local receipt timestamp;
- bid, ask, mid and last price;
- mark and index price where available;
- spread;
- order-book depth near every planned limit;
- funding rate;
- planned order price and quantity;
- whether each limit would have filled;
- fill time, fill price and partial-fill quantity;
- slippage versus the model price;
- fees;
- target and stop execution;
- resulting net PnL.

## Venue comparison

Binance and Hyperliquid are evaluated independently for execution quality. The strategy must not assume in advance that either venue is superior.

Reports compare:

- signal agreement and timing differences;
- candle-high/low differences near V-low and ladder levels;
- fill rate by ladder level;
- average and tail slippage;
- maker/taker fees;
- funding cost;
- missed trades;
- stop execution quality;
- net expectancy after all venue-specific costs;
- operational reliability and data gaps.

A Binance historical touch does not count as a Hyperliquid fill. During live comparison, each venue receives its own simulated execution path from its own market data.

## Decision rule

Historical model selection remains based on Binance-only data. Venue selection for eventual trading is made later from accumulated parallel live/paper evidence.

The terminal must show the signal source and execution venue separately, for example:

```text
signal_source: Binance
execution_venue: Binance
```

or:

```text
signal_source: Binance
execution_venue: Hyperliquid
```

No live order placement is included until a separate approved execution phase.