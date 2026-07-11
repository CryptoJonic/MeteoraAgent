# Manual Galka v1

This is the first semi-automatic implementation of the demonstrated trading method.

## Workflow

1. Open the Paper panel and select **Указать галку на графике**.
2. Tap the intended Galka return level on the chart.
3. The terminal creates a paper-only long limit ladder beginning 0.15% below the selected level.
4. The step and maximum ladder depth are configurable. Defaults are 0.15% and 1.50%.
5. When price reclaims the selected level, the existing reclaim trailing logic takes control.
6. The Galka level, every limit, filled limits and the trailing stop are visible on the chart.
7. A new manual level may replace an unfilled old level. It cannot silently replace a position that already has fills.
8. A level cannot be selected retroactively after price is already below the first planned limit.

## Training data

Each manual selection stores the symbol, timeframe, selected price, timestamp and up to 40 preceding candles in browser local storage. When a paper campaign closes, its result is attached to the example. Examples can be exported as JSON for later work on automatic Galka classification.

## Safety

- Paper trading only.
- Long only.
- No API keys and no exchange orders.
- New untouched paper accounts default to $400 notional per symbol instead of the former $3,333.33 setting.
- The 1.50% ladder depth is an initial configurable value, not a statistically final maximum.
