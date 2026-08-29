"""Classification and constrained inspection-budget evaluation helpers."""

from __future__ import annotations

import math
from collections.abc import Iterable

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


def classification_metrics(y_true: Iterable[int], probabilities: Iterable[float], threshold: float = 0.5) -> dict[str, float | int]:
    truth = np.asarray(list(y_true), dtype=int)
    probability = np.asarray(list(probabilities), dtype=float)
    prediction = (probability >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(truth, prediction, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold),
        "pr_auc_average_precision": float(average_precision_score(truth, probability)),
        "fail_recall": float(recall_score(truth, prediction, zero_division=0)),
        "precision": float(precision_score(truth, prediction, zero_division=0)),
        "f1": float(f1_score(truth, prediction, zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(truth, prediction)),
        "false_alarm_rate": float(fp / (fp + tn)) if fp + tn else 0.0,
        "accuracy": float(accuracy_score(truth, prediction)),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
    }


def top_k_table(
    sample_ids: Iterable[str],
    y_true: Iterable[int],
    probabilities: Iterable[float],
    fractions: Iterable[float],
) -> pd.DataFrame:
    frame = pd.DataFrame({
        "sample_id": list(sample_ids),
        "label": list(y_true),
        "risk_score": list(probabilities),
    }).sort_values(["risk_score", "sample_id"], ascending=[False, True], kind="stable")
    total_fail = int(frame["label"].sum())
    prevalence = float(frame["label"].mean())
    rows: list[dict[str, float | int]] = []
    for fraction in fractions:
        count = int(math.ceil(len(frame) * fraction))
        selected = frame.head(count)
        captured = int(selected["label"].sum())
        precision = captured / count if count else 0.0
        rows.append({
            "k_fraction": float(fraction),
            "inspection_count": count,
            "captured_fail": captured,
            "total_fail": total_fail,
            "fail_capture_rate": captured / total_fail if total_fail else 0.0,
            "false_inspections": count - captured,
            "precision": precision,
            "inspection_burden": count / len(frame),
            "lift": precision / prevalence if prevalence else 0.0,
        })
    return pd.DataFrame(rows)

