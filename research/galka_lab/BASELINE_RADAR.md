# Baseline Radar before Galka Lab

Captured from stabilized draft PR #9 before statistics-engine work.

- Source: `terminal/modules/radar-engine.js`
- SHA-256: `a81de628f0236016edd3757e2163b4f566eb0444274719889e4e31c4cdf00ba0`
- Candidate geometry: local low with four bars on each side.
- Features: drop/ATR, right recovery ratio, shoulder balance, sharpness, and close lift.
- Score weights: 20 / 30 / 20 / 20 / 10.
- Strength thresholds: weak below 60, medium 60–74.9, strong at 75+.
- Nearby candidates within three bars are merged by keeping the higher score.
- Manual examples only add a `manualMatch` flag; they do not change the score.
- The module has no paper-engine dependency and cannot create a campaign.

Baseline regression: `node scripts/test-radar-engine.mjs` passes with a strong manually matched
synthetic V. This baseline has no event outcomes, censoring, conditional return probability,
uncertainty, regime model, statistical types, walk-forward split, or final OOS.

The new research detector is intentionally separate. Existing Radar behavior remains unchanged
until the compact statistics pack and UI adapter are integrated behind explicit Lab/shadow modes.
