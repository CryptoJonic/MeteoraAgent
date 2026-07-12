# Galka Pro paper recovery policy

Policy: `closed-1m-directional-v1` / path `directional-ohlc-v1`.

## Purpose

Android can freeze or discard a background browser tab, and a WebSocket can reconnect after an
unobserved interval. Galka Pro cannot execute JavaScript while frozen. On resume it therefore
replays public Binance USD-M Futures candles for an already-active paper campaign before applying
new live quotes.

This is paper bookkeeping only. It never sends an order, requests an API key, or claims that a
browser was active in the background.

## Durable cursor

Recovery metadata is stored additively inside the unchanged `galka-pro-v1` localStorage value.
Schema v3 preserves every existing campaign, level, fill, position, trade, drawing, setting, and
unknown future field. A cursor is checkpointed at most once per five seconds and immediately when
the page becomes hidden, leaves the page, goes offline, or loses its WebSocket.

New live book-ticker events are buffered while replay is running. The recovered cursor and mutated
paper state are saved together; replayed candles at or before that cursor are ignored on a retry.
The existing campaign-id guard still prevents a second trade record.

## Replay inputs and order

- Source: public `GET /fapi/v1/klines`, `1m`, closed candles only, up to 1,500 rows per page.
- Maximum recovery window: 336 hours. A longer gap is marked `truncated` in diagnostics/activity.
- The candle overlapping the last processed live quote is a boundary candle. Only its close is
  replayed because its high or low may have occurred before the gap.
- A fully missed bullish candle follows `open → low → high → close`.
- A fully missed bearish candle follows `open → high → low → close`.
- Resting paper limits fill at their configured limit price when the reconstructed price reaches
  them. A recovered trailing trigger uses the stored stop price, after which the existing taker fee
  and slippage assumptions are applied unchanged.
- Reclaim, non-decreasing trailing, target exit, expiry, fees, and slippage use the same pure paper
  engine as live quotes.

The directional path is deterministic, not tick-perfect. Boundary close-only handling deliberately
prefers a possible missed event over inventing a fill or stop from an extremum that may predate the
disconnect. Session Health reports recovered candle, fill, exit, and boundary counts.

## Scope boundary

Recovery services campaigns that already existed when the gap began. Refreshed 15-minute history
resumes normal Radar/auto-pattern detection after reconnect, but the app does not retroactively
invent an auto campaign that was never created. Auto paper remains an explicit user setting and is
not enabled by recovery.

## Regression coverage

`scripts/test-paper-recovery.mjs` covers bullish/bearish paths, boundary safety, restored limit
fills, reclaim, trailing activation and raise, stop execution, expiry, and durable-cursor replay
idempotency. Store tests cover additive migration and localStorage round-trip.
