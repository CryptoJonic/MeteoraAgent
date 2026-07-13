# Galka Lab model card

- Model version: `galka-lab-v0.3.0`
- Model hash: `3599937fcd0bfe6b584cb3f41531be549027db405c7463330b13e062a0cf17a2`
- Algorithm: KMeans
- Types: 4
- Seed: 20260712
- Fit split: train only
- Selection: train + validation metrics; final_oos untouched
- Intended use: research, manual assistance, and isolated shadow paper only.
- Prohibited use: real orders or an unstated production-strategy change.

## Type mapping

- Cluster 3: Fast V
- Cluster 0: Deep capitulation
- Cluster 1: Rounded recovery
- Cluster 2: Multi-test

Type labels are descriptive centroid names. Formal geometry is stored in `centers_raw`; representative train, validation, and final-OOS examples are stored in `statistics_examples.json`.
