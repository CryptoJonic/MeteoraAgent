# Galka Lab model card

- Model version: `galka-lab-v0.2.0`
- Model hash: `b572451d8e65411f64bd9ad2dba18dfc78fa9bf23a3d9eef92373e9fc85db1de`
- Algorithm: KMeans
- Types: 4
- Seed: 20260712
- Fit split: train only
- Selection: train + validation metrics; final_oos untouched
- Intended use: research, manual assistance, and isolated shadow paper only.
- Prohibited use: real orders or an unstated production-strategy change.

## Type mapping

- Cluster 3: Fast V
- Cluster 2: Deep capitulation
- Cluster 1: Rounded recovery
- Cluster 0: Multi-test

Type labels are descriptive centroid names. Formal geometry is stored in `centers_raw`; representative train, validation, and final-OOS examples are stored in `statistics_examples.json`.
