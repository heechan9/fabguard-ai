"""Decision-focused validation helpers beyond FabGuard V1.

Cost values are scenario units, not factory savings claims.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss


def _ranked_frame(sample_ids: Iterable[str], y_true: Iterable[int], probabilities: Iterable[float]) -> pd.DataFrame:
    frame = pd.DataFrame({
        "sample_id": list(sample_ids),
        "label": np.asarray(list(y_true), dtype=int),
        "risk_score": np.asarray(list(probabilities), dtype=float),
    })
    if frame.empty or not frame["label"].isin([0, 1]).all():
        raise ValueError("A non-empty binary-labelled sample is required")
    if not frame["risk_score"].between(0, 1).all():
        raise ValueError("Probabilities must be in [0, 1]")
    return frame.sort_values(["risk_score", "sample_id"], ascending=[False, True], kind="stable")


def inspection_cost_table(
    sample_ids: Iterable[str], y_true: Iterable[int], probabilities: Iterable[float],
    fractions: Iterable[float], *, inspection_cost: float = 1.0, missed_fail_cost: float = 20.0,
) -> pd.DataFrame:
    """Compare Top-K review budgets under an explicit scenario cost contract."""
    if inspection_cost < 0 or missed_fail_cost < 0:
        raise ValueError("Scenario costs must be non-negative")
    frame = _ranked_frame(sample_ids, y_true, probabilities)
    total_fail = int(frame["label"].sum())
    no_review_cost = total_fail * missed_fail_cost
    rows = []
    for fraction in fractions:
        if not 0 < fraction <= 1:
            raise ValueError("Each inspection fraction must be in (0, 1]")
        count = int(math.ceil(len(frame) * fraction))
        captured = int(frame.head(count)["label"].sum())
        missed = total_fail - captured
        total = count * inspection_cost + missed * missed_fail_cost
        rows.append({
            "k_fraction": float(fraction), "inspection_count": count,
            "captured_fail": captured, "missed_fail": missed,
            "inspection_cost_units": float(inspection_cost),
            "missed_fail_cost_units": float(missed_fail_cost),
            "scenario_total_cost": float(total), "no_review_cost": float(no_review_cost),
            "scenario_cost_reduction": float(no_review_cost - total),
        })
    return pd.DataFrame(rows)


def bootstrap_top_k_interval(
    sample_ids: Sequence[str], y_true: Sequence[int], probabilities: Sequence[float],
    fractions: Iterable[float], *, n_bootstrap: int = 2000, confidence: float = 0.95,
    random_seed: int = 20260903,
) -> pd.DataFrame:
    """Pairs-bootstrap Top-K capture and precision uncertainty."""
    if n_bootstrap < 1 or not 0 < confidence < 1:
        raise ValueError("Invalid bootstrap configuration")
    base = _ranked_frame(sample_ids, y_true, probabilities).reset_index(drop=True)
    fractions = tuple(float(value) for value in fractions)
    rng = np.random.default_rng(random_seed)
    records = {value: {"capture": [], "precision": []} for value in fractions}
    for replicate in range(n_bootstrap):
        sampled = base.iloc[rng.integers(0, len(base), size=len(base))].copy()
        sampled["sample_id"] = [f"boot_{replicate}_{i}" for i in range(len(sampled))]
        sampled = sampled.sort_values(["risk_score", "sample_id"], ascending=[False, True], kind="stable")
        total_fail = int(sampled["label"].sum())
        if total_fail == 0:
            continue
        for fraction in fractions:
            count = int(math.ceil(len(sampled) * fraction))
            captured = int(sampled.head(count)["label"].sum())
            records[fraction]["capture"].append(captured / total_fail)
            records[fraction]["precision"].append(captured / count)
    alpha = (1 - confidence) / 2
    rows = []
    for fraction in fractions:
        capture, precision = records[fraction]["capture"], records[fraction]["precision"]
        if not capture:
            raise ValueError("No bootstrap replicate contained a Fail label")
        rows.append({
            "k_fraction": fraction, "confidence": confidence, "valid_replicates": len(capture),
            "fail_capture_mean": float(np.mean(capture)),
            "fail_capture_low": float(np.quantile(capture, alpha)),
            "fail_capture_high": float(np.quantile(capture, 1 - alpha)),
            "precision_mean": float(np.mean(precision)),
            "precision_low": float(np.quantile(precision, alpha)),
            "precision_high": float(np.quantile(precision, 1 - alpha)),
        })
    return pd.DataFrame(rows)


def calibration_metrics(y_true: Iterable[int], probabilities: Iterable[float], *, n_bins: int = 10) -> dict[str, float | int]:
    """Return Brier score and equal-width expected calibration error."""
    truth = np.asarray(list(y_true), dtype=int)
    probability = np.asarray(list(probabilities), dtype=float)
    if len(truth) == 0 or len(truth) != len(probability) or n_bins < 2:
        raise ValueError("Invalid calibration inputs")
    if not np.all((0 <= probability) & (probability <= 1)):
        raise ValueError("Probabilities must be in [0, 1]")
    membership = np.clip(np.digitize(probability, np.linspace(0, 1, n_bins + 1)[1:-1]), 0, n_bins - 1)
    ece, populated = 0.0, 0
    for bin_index in range(n_bins):
        mask = membership == bin_index
        if mask.any():
            populated += 1
            ece += float(mask.mean()) * abs(float(probability[mask].mean()) - float(truth[mask].mean()))
    return {"brier_score": float(brier_score_loss(truth, probability)),
            "expected_calibration_error": float(ece), "bins": n_bins, "populated_bins": populated}


def population_stability_index(reference: Iterable[float], current: Iterable[float], *, bins: int = 10) -> float:
    """Calculate PSI using reference quantile bins plus a missing-value bin."""
    ref, cur = pd.Series(list(reference), dtype=float), pd.Series(list(current), dtype=float)
    if ref.empty or cur.empty or bins < 2:
        raise ValueError("Both samples and at least two bins are required")
    clean = ref.dropna().to_numpy()
    if clean.size == 0:
        return 0.0 if cur.isna().all() else float("inf")
    edges = np.unique(np.quantile(clean, np.linspace(0, 1, bins + 1)))
    if len(edges) < 2:
        return 0.0 if cur.dropna().eq(clean[0]).all() else float("inf")
    edges[0], edges[-1] = -np.inf, np.inf
    ref_counts = np.append(np.histogram(ref.dropna(), bins=edges)[0], ref.isna().sum()).astype(float)
    cur_counts = np.append(np.histogram(cur.dropna(), bins=edges)[0], cur.isna().sum()).astype(float)
    ref_share = np.maximum(ref_counts / len(ref), 1e-6)
    cur_share = np.maximum(cur_counts / len(cur), 1e-6)
    return float(np.sum((cur_share - ref_share) * np.log(cur_share / ref_share)))


def drift_table(reference: pd.DataFrame, current: pd.DataFrame, feature_columns: Iterable[str]) -> pd.DataFrame:
    rows = []
    for column in feature_columns:
        ref_missing, cur_missing = reference[column].isna().mean(), current[column].isna().mean()
        rows.append({"feature": column, "psi": population_stability_index(reference[column], current[column]),
                     "reference_missing_rate": float(ref_missing), "current_missing_rate": float(cur_missing),
                     "missing_rate_change": float(cur_missing - ref_missing)})
    return pd.DataFrame(rows).sort_values(["psi", "feature"], ascending=[False, True])


def walk_forward_slices(timestamps: Sequence[pd.Timestamp], *, initial_train_fraction: float = 0.55, folds: int = 4) -> list[tuple[np.ndarray, np.ndarray]]:
    """Create expanding-window indices without crossing equal timestamps."""
    if not 0 < initial_train_fraction < 1 or folds < 1:
        raise ValueError("Invalid walk-forward configuration")
    time = pd.Series(pd.to_datetime(timestamps))
    order = np.lexsort((np.arange(len(time)), time.astype("int64")))
    ordered = time.iloc[order].reset_index(drop=True)
    boundaries = np.linspace(int(len(time) * initial_train_fraction), len(time), folds + 1).astype(int)
    result = []
    for left, right in zip(boundaries[:-1], boundaries[1:]):
        boundary_time = ordered.iloc[left]
        while left > 0 and ordered.iloc[left - 1] == boundary_time:
            left -= 1
        if right > left:
            result.append((order[:left], order[left:right]))
    return result
