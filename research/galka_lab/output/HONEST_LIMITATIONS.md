# Honest limitations

- Binance public OHLCV is not an order-book or queue-position record.
- One-minute execution replay uses a deterministic directional OHLC path; ticks inside a minute are unknown.
- Resting virtual limits fill at their level after the candle reaches it; spread and partial queue fills are omitted.
- Maker/taker fees and fixed slippage are modeled; funding, latency and liquidation-engine details are omitted.
- Right-side bars are used only to confirm a candidate; trading outcomes start strictly after confirmation.
- End-of-data outcomes are censored instead of counted as losses.
- Depth-conditioned return uses only depth reached before the first return; later re-tests are not backfilled into the original event.
- Nearby candidates are de-duplicated within a symbol/timeframe family, but simultaneous cross-timeframe events are correlated and must not be read as independent trials.
- Source gaps are recorded and candidate context crossing a gap is excluded; missing bars are not interpolated.
- Market regimes drift. Seven-day and rare-crisis samples can be too small for stable conclusions.
- Clustering is descriptive. Human names do not prove causality or persistence.
- Multiple grid/stop/trailing comparisons create multiple-testing risk; failed variants remain in outputs.
- Fixed-notional results include unfilled reserve as cash; fixed-risk results use a train-fitted percentile stop and are reported separately.
- Liquidation distance is only a normalized approximation with a stated maintenance-margin assumption, not an exchange liquidation calculation.
- Paper results cannot be assumed to transfer to real trading. This repository contains no real-order path.
