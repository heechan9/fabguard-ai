"""Exploratory paired model comparison from the fixed repeated-CV artifact."""

from __future__ import annotations

import argparse
import itertools
from pathlib import Path

import numpy as np
import pandas as pd


METRIC = "pr_auc_average_precision"


def _best_candidate(frame: pd.DataFrame, family: str) -> str:
    rows = frame[frame["family"] == family]
    if rows.empty:
        raise ValueError(f"missing family: {family}")
    return str(rows.groupby("candidate")[METRIC].mean().idxmax())


def exact_sign_flip_pvalue(differences: np.ndarray) -> float:
    """Two-sided exact randomization p-value for paired repeat-level differences."""
    values = np.asarray(differences, dtype=float)
    if values.ndim != 1 or values.size == 0 or not np.isfinite(values).all():
        raise ValueError("differences must be a non-empty finite vector")
    observed = abs(float(values.mean()))
    permuted = [
        abs(float(np.mean(values * signs)))
        for signs in itertools.product((-1.0, 1.0), repeat=len(values))
    ]
    return float(np.mean(np.asarray(permuted) >= observed - 1e-15))


def paired_repeat_comparison(
    cv_metrics: pd.DataFrame,
    *,
    reference_family: str = "logistic",
    challenger_family: str = "random_forest",
) -> pd.DataFrame:
    required = {"candidate", "family", "repeat", "split", METRIC}
    missing = required.difference(cv_metrics.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")

    reference = _best_candidate(cv_metrics, reference_family)
    challenger = _best_candidate(cv_metrics, challenger_family)
    selected = cv_metrics[cv_metrics["candidate"].isin([reference, challenger])]
    counts = selected.groupby(["candidate", "repeat"])["split"].nunique()
    if counts.empty or counts.nunique() != 1:
        raise ValueError("candidates do not share a complete repeat/split structure")

    repeat_means = selected.groupby(["candidate", "repeat"])[METRIC].mean().unstack("candidate")
    if repeat_means[[reference, challenger]].isna().any().any():
        raise ValueError("candidates do not share identical repeats")
    differences = (repeat_means[challenger] - repeat_means[reference]).to_numpy()
    return pd.DataFrame([{
        "metric": METRIC,
        "reference_candidate": reference,
        "challenger_candidate": challenger,
        "pairing_unit": "repeat_mean_of_shared_5_folds",
        "paired_repeats": len(differences),
        "reference_mean": float(repeat_means[reference].mean()),
        "challenger_mean": float(repeat_means[challenger].mean()),
        "mean_difference": float(differences.mean()),
        "median_difference": float(np.median(differences)),
        "challenger_repeat_wins": int((differences > 0).sum()),
        "two_sided_exact_sign_flip_p": exact_sign_flip_pvalue(differences),
        "interpretation": (
            "exploratory; repeated-CV estimates overlap and do not establish "
            "deployment superiority"
        ),
    }])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cv-metrics", type=Path, default=Path("results/v1/cv_metrics.csv"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/phase1/model_pairwise_comparison.csv"),
    )
    args = parser.parse_args()
    result = paired_repeat_comparison(pd.read_csv(args.cv_metrics))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.output, index=False)
    print(result.to_string(index=False))


if __name__ == "__main__":
    main()
