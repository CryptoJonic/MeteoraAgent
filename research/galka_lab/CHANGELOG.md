# Galka Lab changelog

## Terminal 2.1.0 — Galka Lab and live-forward shadow

- added a lazy, SHA-256-verified browser loader for the schema-1.2 gzip pack without bundling the
  5+ MiB uncompressed JSON into the mobile shell;
- added mobile-first Lab views for OOS block intervals, depth percentiles, depth × horizon,
  histograms, survival, type frequency/performance, grids, stops, exits, regimes, drift, cliffs and
  cross-symbol portability;
- classified fully confirmed Radar candidates with the frozen train centroids while preserving the
  original Radar score and visual-only contract;
- added type-colored markers plus selected-candidate p50/p75/p90, grid and invalidation guides;
- added an opt-in, live-only shadow ledger with fills, MAE/MFE, reclaim, trailing, outcomes, manual
  labels and an invariant paper-balance impact of zero;
- migrated the unchanged `galka-pro-v1` key additively to schema 4 and included shadow records in
  full backup/restore without rewriting existing paper campaigns, limits, trades or drawings;
- added S24, landscape and desktop browser assertions/screenshots and kept auto-paper disabled.

The frozen statistical model remains `galka-lab-v0.3.0`; this terminal release does not retrain it
or alter production paper strategy defaults.

## 0.3.0 — dependence-aware uncertainty and candidate EV

- added deterministic UTC-day block bootstrap intervals for all return horizons and depth
  quantiles on all-history and final OOS;
- kept same-day BTC/ETH/SOL and cross-timeframe observations inside one resampled block;
- exported symbol-specific block intervals so one instrument cannot hide another;
- counted observable no-activation and fully unfilled candidates as 0%/0R in candidate-level EV;
- made report generation safe for short windows with empty grid/regime/exit tables;
- bumped dataset and compact-pack schemas to 1.2.

## 0.2.0 — statistical reliability pass

- grouped train/validation/final OOS by global timestamps and added outcome-window purge/embargo;
- prevented conditional-depth hits after first return and added depth-order verification;
- excluded candidate context that crosses source-data gaps, censored 1m activation/outcomes at
  segment boundaries, and recorded exact gap ranges;
- separated fixed-notional return, return on filled capital, and fixed-risk R results;
- derived every grid from complete activated events including non-returns;
- marked all grids paper-only and Aggressive as stress-test-only;
- added reclaim-buffer, fixed/ATR/confirmed-swing trailing, partial-runner and max-hold comparisons;
- added regime-conditioned curves, recency weighting, Kaplan–Meier survival, histograms,
  median shape profiles, representative examples, and split-stable feature correlations;
- made historical-screen status incapable of authorizing auto-paper without live shadow evidence;
- retained the original Radar, paper defaults, `galka-pro-v1`, positions and user data unchanged.

## 0.1.0 — dataset and interim-report phase

- froze the draft PR #9 Radar baseline and source hash;
- added incremental checksum-verified Binance archive cache and data-quality manifest;
- added broad no-outcome candidate extraction with an explicit confirmation cutoff;
- added 1m activation, censoring, depth, return, MAE/MFE, reclaim and trailing labels;
- added chronological train/validation/final-OOS assignment and expanding walk-forward folds;
- added reproducible 4–7 type selection with train-only centroids and human-readable names;
- added recent windows, conditional depth × horizon curves, confidence intervals and cliffs;
- added Conservative, Balanced and Aggressive paper-only grids and stop/trailing trade-offs;
- added compact checksum-protected terminal-pack export;
- added unit, synthetic end-to-end and full-data GitHub workflow gates;
- did not change current Radar scoring, paper defaults, `galka-pro-v1`, or any active user state.
