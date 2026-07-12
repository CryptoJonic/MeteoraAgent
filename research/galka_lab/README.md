# Galka Lab research pipeline

Galka Lab builds a broad, outcome-labeled dataset before any terminal UI is integrated. It uses
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

For a deterministic local smoke run:

```bash
python research/galka_lab.py --synthetic --synthetic-days 45 --build-dataset --classify --report --export-terminal-pack
```

## No-lookahead contract

- A pivot uses a named right-side confirmation window.
- `feature_cutoff_time` is the confirmation time.
- Activation and every outcome begin strictly after confirmation.
- Candidates are split chronologically per symbol/timeframe.
- Cluster count is selected on train/validation only.
- Centroids are fit on train only.
- Walk-forward folds stop before final OOS.
- Final OOS is reported once and never used to choose types, grids, or stops.
- End-of-data events are censored, not relabeled as losses.

## Outputs

- `all_candidates.csv.gz` — every broad candidate, including non-activated levels.
- `events.csv.gz` — one statistically independent representative per nearby event family.
- `data_manifest.json` — source and data-quality manifest.
- `INTERIM_STATISTICAL_REPORT.md` — dataset/types report generated before UI work.
- `DECISION_REPORT.md` — depth, return, grid, trailing and stop trade-offs.
- `HONEST_LIMITATIONS.md` — execution and inference limitations.
- `MODEL_CARD.md`, `model.json`, `walk_forward.json` — versioned model evidence.
- `statistics_*.json` — global, conditional, regime, recent and cliff tables.
- `galka-stats-v1.json(.gz)` — checksum-protected compact terminal pack.

Type names describe train-fitted clusters; they are not predefined labels or trading guarantees.
Aggressive grids are paper-only. Auto-paper remains off and is outside this dataset phase.
