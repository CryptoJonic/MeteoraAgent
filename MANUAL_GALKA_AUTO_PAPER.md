# Manual Galka Auto Paper

This branch is a focused research version built from `agent/galka-pro-redesign`.

## Goal

The user makes exactly one discretionary decision: selects the GALKA level for BTCUSDT, ETHUSDT or SOLUSDT. After confirmation, the paper engine handles the campaign automatically.

## Required flow

1. User selects symbol and timeframe.
2. User places GALKA by touch, drag or exact price.
3. Pre-trade preview shows ladder, total notional, estimated average, reclaim, trailing distance, maximum hold and risk warnings.
4. User confirms.
5. Engine creates the limit ladder.
6. Live and recovered market data fill pending levels at their configured prices.
7. After the configured reclaim level is reached, trailing is armed.
8. Trailing stop never moves down and never starts below GALKA.
9. Exit, fees, slippage, realized PnL and trade history are recorded automatically.
10. BTC, ETH and SOL campaigns are processed independently.

## Research isolation

This branch uses a separate browser key:

```text
galka-manual-auto-v1
```

It must not read, overwrite or reset `galka-pro-v1`. The original Work redesign and its paper state remain untouched.

## Defaults retained for the first build

- paper only;
- starting balance: $1,000;
- leverage setting: 10x;
- notional per symbol: $400;
- ladder step: 0.15%;
- ladder depth: 1.50%;
- reclaim buffer: 0.10%;
- trailing distance: 0.75%;
- maximum hold: 72h;
- manual signals only.

These are starting defaults, not a proven optimal strategy. The statistics engine will later provide type-specific grid and stop profiles.

## Explicitly excluded

- exchange API keys;
- real orders;
- automatic Galka selection;
- Radar-triggered campaigns;
- hidden strategy changes;
- sharing paper balance with `galka-pro-v1`.

## UI requirements

The primary Paper card must show a plain-language state:

- waiting for first fill;
- N/M limits filled;
- average entry;
- current unrealized PnL;
- waiting for reclaim at X;
- trailing armed at X;
- current trailing stop;
- time remaining until expiry;
- last engine event;
- recovery status after background/reconnect.

A user should never need to infer whether the campaign is waiting, open, trailing or closed from a generic `OPEN` label alone.

## Acceptance tests

- manual GALKA creates a ladder only after confirmation;
- repeated quotes do not duplicate fills;
- multiple levels can fill in one move;
- GALKA cannot move after the first fill;
- reclaim arms trailing;
- trailing never decreases;
- stop closes the trade and records realized PnL;
- time exit closes an expired open campaign;
- reconnect replay restores fills, reclaim, trailing and exit without duplicates;
- three symbols are independent;
- `galka-pro-v1` remains unchanged;
- `npm run check` passes.
