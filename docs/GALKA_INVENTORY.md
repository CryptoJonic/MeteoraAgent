# Galka Pro Inventory

Inventory baseline: `main` at `02fd3e6` before the Work redesign.

## Effective runtime

- Primary launcher: `scripts/start-termux.sh`.
- Primary page: `terminal/pro.html` with `terminal/pro.css` and `terminal/pro.js`.
- Runtime dependencies: Python static server, browser, public Binance REST/WebSocket, and
  TradingView Lightweight Charts from unpkg.
- Development check: `npm run check`; no runtime build or `npm install` is required.
- Persistent browser key: `galka-pro-v1`.

## Baseline paper behavior captured by tests

- Symbols: BTCUSDT, ETHUSDT, SOLUSDT, serviced simultaneously.
- Manual ladder: configurable 0.15% step / 1.50% depth by default, equal weights.
- Legacy auto ladder: 0.25%, 0.70%, 1.25%, 1.90%, 2.65%, 3.50% with existing weights.
- Fill: pending limit becomes filled when ask reaches its price; a filled level is not processed again.
- GALKA: movable only for a manual campaign with no fill.
- Exit: target mode or reclaim + non-decreasing trailing stop with a GALKA floor.
- Radar: visual scoring only; it has no paper-engine dependency.

## Baseline findings

- `pro.js` was a 937-line DOM/market/paper/Radar monolith.
- `README.md` still described `terminal/live.html` as the primary page, although Termux launched Pro.
- `radarBtn`, `radarLegend`, related element references, subscriptions, and handlers were duplicated.
- Mobile navigation opened a full sidebar, but did not provide real sheet snapping or a dedicated
  Radar surface.
- Paper presented only the selected symbol instead of the state of all three engines.
- Workspace export covered UI only; there was no full paper-safe backup/restore contract.
- WebSocket reconnect did not perform REST candle catch-up or expose quote age / tab visibility.
- The Termux launcher could reset any non-main branch, making feature-branch testing unsafe.
- Baseline checks were green: terminal, mobile, live, Pro (34 regex checks), and backtest page.

## Redesign boundaries

- Strategy constants and long-only methodology are not optimized in this branch.
- No API key handling, real-order endpoint, server, or background paper execution is introduced.
- Store migration is additive; unknown fields are retained.
- The implementation remains native HTML/CSS/JavaScript modules served directly by Python.

