# Galka Pro Design System

## Identity

Galka is a focused paper terminal, not a universal exchange dashboard. Its visual language is
"quiet cockpit": near-black graphite surfaces, warm white text, cyan for navigation, amber for the
manual GALKA level, mint for fills/profit, and coral for risk/stop. Glow is reserved for live state.

## Tokens

- Canvas: `#080b10`; elevated surfaces: `#10151d`, `#171d27`, `#202834`.
- Text: `#f4f7fb`; secondary: `#9aa6b6`; tertiary: `#687486`.
- Focus: `#64d8ff`; GALKA: `#ffb454`; positive: `#32d6a0`; risk: `#ff6677`.
- Radius: 10 px controls, 16 px cards, 24 px sheets.
- Touch targets: 44 px minimum, 48–52 px for primary mobile actions.
- Motion: 140–220 ms with reduced-motion fallback.
- Type: system UI; tabular numerals for prices and account values.

## Layout rules

- Portrait: 52 px top bar, full chart, 64 px bottom navigation. Sheets snap to 38%, 66%, or 92%.
- Landscape: compact top bar and a right-side sheet so the chart retains height.
- DeX/desktop: persistent 52 px drawing rail and optional 360 px inspector.
- Trading labels use short names and collision-aware staggered price lines. Detail lives in sheets.
- Destructive actions are visually separated and always confirmed.

## Interaction rules

- A chart pan/zoom gesture wins unless an explicit drawing or GALKA tool is active.
- A new GALKA always opens a paper preview before campaign creation.
- After the first fill, move/cancel controls become unavailable and explain why.
- Radar candidates are filtered and clustered before markers are rendered; selection opens an
  explanation card and never creates a campaign.
- Connection truth is explicit: online state, quote age, tab visibility, engine gap, and catch-up state.
- Session Health distinguishes live streaming from paper replay and reports candle, fill, exit, and
  boundary-candle counts instead of implying that background JavaScript kept running.
