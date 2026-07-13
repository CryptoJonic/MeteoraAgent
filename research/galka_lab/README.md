# Galka Lab research pipeline

Galka Lab builds a broad, outcome-labeled dataset before that evidence is consumed by the terminal UI. It uses
public Binance USD-M Futures OHLCV only. It has no order endpoint, credentials, or production-paper
mutation path.

## Reproduce

```bash
python research/galka_lab.py \
  --symbols BTCUSDT ETHUSDT SOLUSDT \
  --intervals 5m 15m 30m 1h \
  --from auto \
  --to latest \
  --build-dataset \
  --classify \
  --report \
  --export-terminal-pack
```

Raw monthly/daily archives and their official SHA-256 checksums are cached under
`research/galka_lab/cache/` and are ignored by git. Re-running downloads only missing archives.
`data_manifest.json` records symbol, interval, source, time range, row count, gaps, duplicates,
OHLC errors, archive hashes, and the normalized dataset hash.
Candidate context and 1m outcome replay never cross a recorded source gap: an incomplete
activation, return, post-reclaim, or trailing window is censored at the segment boundary.

For a deterministic local smoke run:

```bash
python research/galka_lab.py --synthetic --synthetic-days 45 --build-dataset --classify --report --export-terminal-pack
```

## No-lookahead contract

- A pivot uses a named right-side confirmation window.
- `feature_cutoff_time` is the confirmation time.
- Activation and every outcome begin strictly after confirmation.
- Candidates are split by global chronological timestamp groups, so the same market instant
  cannot appear on both sides through another symbol or timeframe.
- Train/validation rows whose full activation/outcome observation window crosses the next split
  boundary are purged; walk-forward folds apply the same embargo.
- Cluster count is selected on train/validation only.
- Centroids are fit on train only.
- Walk-forward folds stop before final OOS.
- Final OOS is reported once and never used to choose types, grids, or stops.
- End-of-data events are censored, not relabeled as losses.
- Key all-history and final-OOS uncertainty uses a deterministic UTC-day block bootstrap that
  resamples same-day BTC/ETH/SOL and cross-timeframe observations together.

## Outputs

- `all_candidates.csv.gz` — every broad candidate, including non-activated levels.
- `events.csv.gz` — one statistically independent representative per nearby event family.
- `data_manifest.json` — source and data-quality manifest.
- `INTERIM_STATISTICAL_REPORT.md` — dataset/types report generated before UI work.
- `DECISION_REPORT.md` — depth, return, grid, trailing and stop trade-offs.
- `HONEST_LIMITATIONS.md` — execution and inference limitations.
- `MODEL_CARD.md`, `model.json`, `walk_forward.json` — versioned model evidence.
- `statistics_*.json` — global, conditional, regime, recent and cliff tables.
- `statistics_block_bootstrap.json` — day-block bootstrap intervals for each type globally and
  separately for BTC, ETH, and SOL.
- Large full conditional tables stay artifact-only; compact depth × horizon/regime tables,
  histograms, survival, shape profiles and stable correlations are embedded in the pack.
- `galka-stats-v1.json(.gz)` — checksum-protected compact terminal pack.

## Terminal integration

`terminal/modules/galka-stats.js` lazily loads the gzip pack, verifies its SHA-256 and safety flags,
and exposes deterministic type/OOS/conditional queries. Galka Pro never recomputes the full history
on-device. The mobile pack is under 1 MiB compressed and is cached only after its first explicit Lab
or Radar use.

Galka Lab separates selected-market descriptive windows from cross-market final-OOS evidence. It
shows block-bootstrap uncertainty, depth/horizon curves, histograms, survival, type frequency,
OOS performance, profiles, stops, exits, regimes, recency drift, cliffs, and BTC/ETH/SOL
portability. The promotion banner uses final-OOS candidate EV, not all-history return frequency.

Shadow mode is opt-in and live-forward only. It stores a separate ledger under the unchanged
`galka-pro-v1` key, captures fills/MAE/MFE/reclaim/trailing/outcomes and manual Radar labels, and
hard-codes `paperBalanceImpact: 0`. It never backfills candidates from before its start time.
Auto-paper remains off.

Run the terminal and isolation gates with:

```bash
npm run check
npm run research:test
```

Type names describe train-fitted clusters; they are not predefined labels or trading guarantees.
Every grid is paper-only, Aggressive is stress-test-only, and a historical screen cannot authorize
auto-paper without separately accumulated live shadow evidence. Auto-paper remains off.
Grid EV is candidate-level: observable non-activations and fully unfilled grids remain cash at 0%,
while unresolved censored candidates are excluded. Return on filled capital is reported separately.
