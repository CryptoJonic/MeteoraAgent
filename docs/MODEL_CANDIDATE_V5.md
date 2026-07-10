# Galka model candidate v5

Status: historical paper candidate. It is not approved for live trading.

## Why the original ladder was rejected

The causal 5m/15m study found that V-low was revisited in roughly 92–97% of OOS breaks, but the selected finite ladders still had negative OOS expectancy. Frequent small partial-position wins did not compensate for occasional full losses.

## Selected candidate

The strongest current historical candidate is asset-specific rather than universal:

- market: BTCUSDT Binance USD-M Futures;
- timeframe: 15m;
- V definition: L4/R4, drop >= 1.5 ATR, recovery >= 65%;
- use only the first break below a canonical V-low;
- long limit: 1.0% below V-low;
- cancel unfilled entry after 24 hours;
- long target: V-low;
- evaluate failure 6 hours after the long fill;
- if price remains at least 2 ATR below V-low, close long and switch to short;
- short stop: V-low;
- short target: 2.0% below short entry;
- short timeout: 24 hours;
- one non-overlapping position at a time;
- costs: 5 bps fee + 2 bps slippage per side.

The prior research report recorded 67 OOS trades, +0.260% average return on fixed notional, profit factor 1.64 and a worst OOS trade of -3.572%. Those values are prior evidence, not guaranteed reproduction: the repository replay independently downloads the canonical Binance archive and exports its own metrics and trades.

## Reproducible replay

Run locally:

```bash
python -m pip install -r research/requirements.txt
python research/run_candidate.py
```

Output:

```text
research/output/BTCUSDT_15m_dual_failure_v5.galka.zip
```

The archive can be loaded directly into Galka Terminal. GitHub Actions also runs the replay and publishes the package as the `galka-btc15m-history` workflow artifact.

## Research boundary

ETH is excluded from this candidate because its tested OOS result was negative. SOL remains research-only because its apparent positive average came with an extreme historical tail loss. Before real money, the BTC candidate requires forward paper logging with venue-specific bid/ask, funding, latency and actual hypothetical fills.
