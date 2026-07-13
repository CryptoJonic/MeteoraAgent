from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.preprocessing import StandardScaler

from .config import CLUSTER_FEATURES, MIN_SAMPLE, SEED
from .utils import canonical_json, sha256_bytes


@dataclass
class ClusterResult:
    events: pd.DataFrame
    model: dict
    selection: list[dict]


def _matrix(frame: pd.DataFrame, features: tuple[str, ...], medians: dict | None = None):
    values = frame.loc[:, features].replace([np.inf, -np.inf], np.nan)
    if medians is None:
        medians = {column: float(values[column].median()) for column in features}
    filled = values.fillna(medians).to_numpy(float)
    return filled, medians


def _safe_silhouette(values: np.ndarray, labels: np.ndarray, seed: int) -> float:
    if len(np.unique(labels)) < 2 or len(values) < 10:
        return -1.0
    sample_size = min(10_000, len(values))
    return float(silhouette_score(values, labels, sample_size=sample_size, random_state=seed))


def _name_clusters(raw_centers: pd.DataFrame) -> dict[int, str]:
    z = (raw_centers - raw_centers.mean()) / raw_centers.std(ddof=0).replace(0, 1)
    formulas = {
        "Fast V": z["sharpness_atr"] + z["recovery_speed_atr"] + z["recovery_ratio"],
        "Deep capitulation": z["drop_atr"] + z["volume_ratio"] + z["wick_ratio"],
        "Rounded recovery": z["base_width_bars"] + z["near_low_bars"] - z["sharpness_atr"],
        "Multi-test": z["second_tests"] + z["prior_touches"],
        "Trend trap": -z["trend_slope_atr"] - z["recovery_ratio"] + z["drop_atr"],
        "Consumed level": z["prior_touches"] - z["sharpness_atr"],
        "Asymmetric weak": -z["shoulder_balance"] - z["recovery_speed_atr"],
    }
    available = set(raw_centers.index.astype(int))
    names: dict[int, str] = {}
    for name, scores in formulas.items():
        if not available:
            break
        cluster = int(scores.loc[list(available)].idxmax())
        names[cluster] = name
        available.remove(cluster)
    for cluster in sorted(available):
        names[int(cluster)] = f"Local V {cluster + 1}"
    return names


def _rounded(value, digits: int = 10):
    if isinstance(value, dict):
        return {key: _rounded(item, digits) for key, item in value.items()}
    if isinstance(value, list):
        return [_rounded(item, digits) for item in value]
    if isinstance(value, float):
        return round(value, digits)
    return value


def fit_types(
    frame: pd.DataFrame,
    *,
    features: tuple[str, ...] = CLUSTER_FEATURES,
    seed: int = SEED,
    minimum_k: int = 4,
    maximum_k: int = 7,
) -> ClusterResult:
    if "split" not in frame:
        raise ValueError("chronological split must be assigned before clustering")
    train = frame[frame["split"] == "train"]
    validation = frame[frame["split"] == "validation"]
    if len(train) < max(100, minimum_k * 10):
        raise ValueError(f"too few train candidates for stable types: {len(train)}")
    train_values, medians = _matrix(train, features)
    validation_values, _ = _matrix(validation, features, medians)
    scaler = StandardScaler().fit(train_values)
    train_scaled = scaler.transform(train_values)
    validation_scaled = scaler.transform(validation_values) if len(validation_values) else validation_values
    selection = []
    models: dict[int, KMeans] = {}
    upper = min(maximum_k, max(minimum_k, len(train) // max(10, MIN_SAMPLE // 2)))
    for k in range(minimum_k, upper + 1):
        model = KMeans(n_clusters=k, random_state=seed, n_init=20, max_iter=500).fit(train_scaled)
        alternate = KMeans(n_clusters=k, random_state=seed + 101, n_init=20, max_iter=500).fit(
            train_scaled
        )
        train_labels = model.labels_
        validation_labels = model.predict(validation_scaled) if len(validation_scaled) else np.array([])
        counts = np.bincount(train_labels, minlength=k)
        train_silhouette = _safe_silhouette(train_scaled, train_labels, seed)
        validation_silhouette = (
            _safe_silhouette(validation_scaled, validation_labels, seed)
            if len(validation_scaled)
            else -1.0
        )
        stability = float(adjusted_rand_score(train_labels, alternate.labels_))
        minimum_cluster = int(counts.min())
        sample_ok = minimum_cluster >= min(MIN_SAMPLE, max(20, int(len(train) * 0.01)))
        score = 0.45 * train_silhouette + 0.30 * validation_silhouette + 0.25 * stability
        selection.append(
            {
                "k": k,
                "train_silhouette": train_silhouette,
                "validation_silhouette": validation_silhouette,
                "stability_ari": stability,
                "minimum_cluster": minimum_cluster,
                "sample_ok": bool(sample_ok),
                "selection_score": float(score),
            }
        )
        models[k] = model
    eligible = [item for item in selection if item["sample_ok"]]
    selected = max(eligible or selection, key=lambda item: (item["selection_score"], -item["k"]))
    model = models[selected["k"]]
    all_values, _ = _matrix(frame, features, medians)
    all_scaled = scaler.transform(all_values)
    labels = model.predict(all_scaled)
    distances = model.transform(all_scaled)
    raw_centers = pd.DataFrame(
        scaler.inverse_transform(model.cluster_centers_), columns=features, index=range(selected["k"])
    )
    names = _name_clusters(raw_centers)
    events = frame.copy()
    events["cluster_id"] = labels.astype(int)
    events["galka_type"] = [names[int(label)] for label in labels]
    events["type_distance"] = distances[np.arange(len(events)), labels]
    model_payload = {
        "algorithm": "KMeans",
        "seed": seed,
        "selected_k": int(selected["k"]),
        "features": list(features),
        "feature_medians": medians,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "centers_scaled": model.cluster_centers_.tolist(),
        "centers_raw": {
            str(index): {column: float(value) for column, value in row.items()}
            for index, row in raw_centers.iterrows()
        },
        "type_names": {str(key): value for key, value in names.items()},
        "fit_split": "train only",
        "selection_uses": "train + validation metrics; final_oos untouched",
        "selection": selection,
    }
    model_payload = _rounded(model_payload)
    model_hash = sha256_bytes(canonical_json(model_payload).encode("utf-8"))
    model_payload["model_hash"] = model_hash
    events["model_hash"] = model_hash
    return ClusterResult(events=events, model=model_payload, selection=selection)


def apply_types(frame: pd.DataFrame, model: dict) -> pd.DataFrame:
    features = tuple(model["features"])
    values, _ = _matrix(frame, features, model["feature_medians"])
    mean = np.asarray(model["scaler_mean"], dtype=float)
    scale = np.asarray(model["scaler_scale"], dtype=float)
    centers = np.asarray(model["centers_scaled"], dtype=float)
    scaled = (values - mean) / np.where(scale == 0, 1, scale)
    distances = np.sqrt(((scaled[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2))
    labels = distances.argmin(axis=1)
    names = {int(key): value for key, value in model["type_names"].items()}
    output = frame.copy()
    output["cluster_id"] = labels.astype(int)
    output["galka_type"] = [names[int(label)] for label in labels]
    output["type_distance"] = distances[np.arange(len(output)), labels]
    output["model_hash"] = model["model_hash"]
    return output
