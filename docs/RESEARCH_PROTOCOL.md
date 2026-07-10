# Galka Full-History Research Protocol v1.0

## 1. Objective

Scan the complete reliable trading history of BTC, ETH and SOL separately, detect every causally valid Galka/V-pattern, describe the market state visible at decision time, measure what happened afterwards, and learn which patterns should be traded, traded with reduced risk, or rejected.

The research target is not the highest historical profit. It is a stable, reproducible estimate of net expectancy and probability of return to `V-low` after costs, with explicit uncertainty.

## 2. Assets and research layers

Primary reports are always separate:

- BTC model and BTC statistics;
- ETH model and ETH statistics;
- SOL model and SOL statistics.

Secondary reports may include:

- a pooled model with `asset` as a feature;
- train-on-two / test-on-one cross-asset validation;
- shared pattern families that behave similarly across assets.

A pooled result may never replace the separate asset reports.

## 3. Data policy

Use the full reliable and liquid history available for each asset. Early illiquid history is retained but tagged as a separate liquidity regime and must not be silently mixed with modern execution conditions.

Research requires, where available:

- one-minute OHLCV as the minimum base layer;
- trade or lower-timeframe data for ambiguous intrabar fills;
- bid/ask or spread estimates;
- fee schedule and maker/taker assumptions;
- funding and open interest as optional derivatives-context features.

All higher timeframes are aggregated from one canonical base dataset to avoid exchange/timeframe inconsistencies.

Missing candles, duplicates, abnormal prints, exchange outages and symbol migrations must be audited and reported.

## 4. Timeframes

Initial broad scan:

- 1m, 3m, 5m, 15m, 30m;
- 1h and 4h as slower pattern/context layers.

The final set is selected by out-of-sample stability, not by in-sample profit. Results from different timeframes are reported separately before any portfolio aggregation.

## 5. Causal Galka detection

A pattern is valid only when every value used by the detector was available at that timestamp.

Each candidate event must contain:

- start and end of the left leg;
- `V-low` time and price;
- right-leg confirmation time;
- break-below-`V-low` time;
- planned entry ladder;
- deepest allowed entry;
- target and forced-exit rules.

The same underlying market event may generate many parameter variants during research, but it counts as one independent event for statistical confidence. Overlapping or nested detections receive an `event_family_id`.

## 6. Parameter search

"All possible parameters" is implemented as a broad bounded search followed by adaptive refinement. A literal infinite grid is impossible and would maximize false discoveries.

Search families include:

### 6.1 Geometry

- left-leg duration and fall size;
- right-leg duration and recovery size;
- V width and depth;
- left/right symmetry;
- wick and body structure near `V-low`;
- sharpness, curvature and number of local retests;
- distance from the completed V to the later break.

### 6.2 Entry ladder

- number of levels;
- first-entry distance below `V-low`;
- deepest-entry distance;
- linear, geometric and volatility-scaled spacing;
- equal, front-loaded and back-loaded sizing;
- cancellation and expiry rules;
- partial-fill handling.

### 6.3 Exit and protection

- default target at `V-low`;
- optional partial exits before `V-low` as separately labelled experiments;
- price stop below the deepest limit;
- volatility stop;
- time stop;
- invalidation by structure;
- maximum bars in trade.

### 6.4 Costs and execution

- maker/taker combinations;
- spread and slippage scenarios;
- latency assumptions;
- ambiguous same-candle order sequencing;
- partial fills;
- funding where relevant.

No optimistic intrabar assumption is allowed. Ambiguous cases use lower-timeframe data or a conservative ordering rule.

## 7. Feature map for every Galka

All features are snapshots calculated at or before the entry decision.

### 7.1 Pattern geometry

- absolute and ATR-normalized depth;
- duration of both legs;
- symmetry;
- rebound speed;
- volume during fall, low and rebound;
- candle-body/wick composition;
- number and quality of retests;
- break depth and break velocity.

### 7.2 Location and prior path

- prior return over multiple windows;
- whether the V formed after a rise, fall or range;
- distance from recent swing high and swing low;
- percentile inside the recent trading range;
- distance from moving averages and VWAP-like anchors;
- support/resistance density;
- whether the break occurs near a prior liquidation/volume zone when data exists.

### 7.3 Regime

- trend direction and strength on multiple horizons;
- realized volatility and volatility percentile;
- volume/liquidity regime;
- bull, bear, range and transition regime;
- time of day, weekday and session;
- asset age and market-structure era.

### 7.4 Cross-market context

For ETH and SOL, optional features include the contemporaneous BTC regime and relative strength. These must be available in real time and are tested as additions, never assumed to help.

### 7.5 Break and execution state

- time from right-leg confirmation to break;
- volume and speed of break;
- gap below `V-low`;
- spread/liquidity at break;
- number of ladder levels reachable under conservative execution.

## 8. Outcome labels

Every candidate, including rejected and untraded candidates, receives counterfactual outcome labels.

Primary label:

- did price return to `V-low` before the configured stop/invalidation and within the configured time horizon?

Additional labels:

- maximum adverse excursion (`MAE`);
- maximum favorable excursion (`MFE`);
- deepest continuation below `V-low`;
- time to first entry, deepest fill, target, stop and expiry;
- target-before-stop for each ladder family;
- net PnL after fees/slippage;
- number of filled levels;
- return after fixed horizons;
- what happened after target, for diagnostic use only.

Future outcomes are stored for evaluation but never exposed to the model's decision-time feature snapshot.

## 9. Group discovery and prediction

The system uses three layers.

### Layer A — descriptive bins

Human-readable bins such as:

- sharp V after prolonged fall;
- shallow V inside an uptrend;
- delayed break after multiple retests;
- high-volatility breakdown;
- weak rebound in a bear regime.

These are useful for visual inspection but are not selected from win rate alone.

### Layer B — unsupervised discovery

Clustering is used to discover recurring structures without using future outcomes. Cluster count is selected by stability and interpretability, not fixed in advance.

### Layer C — supervised probability model

A calibrated model estimates:

- probability of return to `V-low` before failure;
- expected net PnL;
- expected tail loss;
- uncertainty of the estimate.

Simple baselines are mandatory: unconditional rate, logistic model and rule-based filters. A complex model is accepted only when it beats them out of sample and remains calibrated.

The final terminal-facing rules should be interpretable. If a complex model wins, a simpler surrogate/rule summary is exported alongside it.

## 10. Sample size and uncertainty

Raw ratios such as `5/5` or `9/10` are not sufficient.

Each group must show:

- number of independent event families;
- wins, losses and censored/expired cases;
- posterior/shrunken probability estimate;
- confidence or credible interval;
- lower confidence bound;
- out-of-sample expectancy after costs;
- stability by year, regime, timeframe and asset.

A small perfect sample is classified as `insufficient evidence`, not as an elite setup.

## 11. Decision classes and risk tiers

Suggested terminal classes:

- `A+`: strong positive out-of-sample expectancy, adequate sample, stable calibration and acceptable tail risk;
- `A`: positive and stable, but weaker than A+;
- `B`: positive evidence with wider uncertainty; reduced risk;
- `C`: weak/conditional evidence; research-only or minimal risk;
- `REJECT`: negative expectancy, unstable behavior, excessive tail risk or explicit invalidation feature;
- `UNKNOWN`: too little independent evidence.

Risk remains fixed in money before entry. Model class may reduce the configured risk but must not increase it beyond the global maximum during research.

Illustrative mapping, to be validated rather than assumed:

- A+: 1.00R;
- A: 0.75R;
- B: 0.50R;
- C: 0.25R or no trade;
- REJECT/UNKNOWN: no trade.

## 12. Validation design

Required controls:

- chronological nested walk-forward optimization;
- final untouched holdout period;
- embargo around overlapping patterns;
- grouping by `event_family_id` so near-duplicates cannot cross folds;
- parameter-neighborhood stability checks;
- year/regime/timeframe breakdowns;
- fees and slippage stress tests;
- leave-one-asset-out tests for shared models;
- comparison with trading every Galka, random selection with equal holding time, and no-trade baseline.

Model selection cannot inspect the final holdout. Failed variants and search ranges remain in the report.

## 13. False-discovery controls

Because many parameters and features are scanned:

- nested validation is mandatory;
- the number of tried variants is logged;
- statistically weak micro-groups are shrunk toward the parent average;
- neighboring parameter values must behave similarly;
- a rule that works only in one narrow cell is rejected;
- subgroup discovery is repeated on different time periods;
- the final score penalizes complexity and instability.

## 14. Terminal audit requirements

The terminal must show all candidate Galkas, not only executed trades.

Each pattern must display:

- class: A+, A, B, C, REJECT or UNKNOWN;
- model probability and uncertainty interval;
- expected value after costs;
- group/cluster membership;
- top positive and negative decision factors;
- exact rejection reason;
- decision-time feature snapshot;
- realized outcome in a visually separate section;
- all planned and filled ladder levels;
- MAE, MFE, target/stop/expiry path;
- model version, fold and whether the event is in-sample or out-of-sample.

Terminal controls:

- show accepted only / rejected only / all;
- filter by asset, timeframe, year, regime, class and outcome;
- jump to next/previous Galka;
- compare accepted trade with rejected counterfactual;
- display group statistics and sample size;
- display nearest historical analogues;
- manually tag a pattern for review without changing the official backtest.

Manual tags are stored separately and may only enter a later research version through a documented relabelling experiment.

## 15. Deliverables

For each BTC, ETH and SOL run:

- complete candidate catalogue;
- accepted/rejected decisions;
- feature snapshots;
- outcome labels;
- group statistics;
- all simulated orders and trades;
- walk-forward fold results;
- calibration report;
- parameter-stability report;
- failed-model register;
- terminal package;
- model card describing limitations and intended use.

## 16. Default decisions pending user override

Unless explicitly changed:

- strategy direction is long-only after a break below `V-low`;
- risk is normalized as `1R` during research;
- actual NOK/USDT risk is configured later;
- no averaging is allowed below the deepest planned limit;
- all results are net of explicit costs;
- one canonical event family cannot be counted multiple times;
- BTC, ETH and SOL are evaluated separately before pooled experiments;
- model class may only reduce risk, not exceed the global maximum;
- live trading and exchange API execution remain outside the MVP.
