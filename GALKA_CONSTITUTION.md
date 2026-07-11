# Galka Pro Constitution

This document is the safety contract for every Galka Pro change.

## Product boundary

- Galka Pro is a **paper-only**, long-only terminal.
- It uses public Binance USD-M Futures market data only.
- It never requests, stores, or transmits exchange API keys and never places real orders.
- Radar is an explainable visual scoring model. It cannot create a campaign or execute a trade.

## Data contract

- The browser storage key is permanently `galka-pro-v1` unless a tested migration is shipped.
- A migration is additive and preserves unknown fields so a newer snapshot can be rolled back safely.
- Existing BTC, ETH, and SOL patterns, campaigns, levels, fills, positions, trailing state, trades,
  settings, drawings, alerts, templates, training examples, and radar labels survive an update.
- Import first validates and previews the snapshot, then creates a backup of current state before restore.
- Reset and destructive drawing actions require explicit confirmation.

## Paper invariants

- A pending level fills only when ask is at or below its price and can fill only once.
- BTC, ETH, and SOL campaigns are independent and can be serviced simultaneously.
- GALKA may move only before the first fill.
- Reclaim arms trailing only after a position exists.
- Trailing stop never decreases and is never below GALKA.
- A closed or expired campaign is never processed again.
- Reconnect/backfill cannot duplicate a fill or trade.
- UI rendering and Radar evaluation cannot mutate paper state.

## Delivery rules

- `bash scripts/start-termux.sh` remains the one-command Android launch path; no build step is required.
- Production browser assets stay in the repository and use native browser modules only.
- Mobile portrait (360–430 px) is the primary layout; landscape, Samsung DeX, and desktop remain usable.
- The chart is the default and largest surface. Panels are user-invoked and must not silently cover it.
- Strategy changes are isolated, named experiments with their own tests; a redesign never changes them.
- `npm run check` and the store/paper regression suite must pass before a PR is eligible to merge.

