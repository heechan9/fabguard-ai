"""Small train-only temporal ablation; never score the official test partition."""
from __future__ import annotations

import argparse
import json
import platform
import subprocess
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.pipeline import Pipeline

from .config import ExperimentConfig
from .data import load_secom, sha256_file, time_holdout
from .evaluation import classification_metrics, top_k_table
from .experiment import feature_columns
from .modeling import Candidate, build_pipeline


class RowMissingCount(BaseEstimator, TransformerMixin):
    """Compute missing count from original columns before any quality filtering."""

    def fit(self, X, y=None):
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        return self

    def transform(self, X):
        frame = X.loc[:, self.feature_names_in_].copy()
        frame["row_missing_count"] = frame.isna().sum(axis=1)
        return frame


def temporal_splits(train):
    """Split unique times, so ties cannot leak across either boundary."""
    times = np.sort(train["timestamp"].unique())
    boundaries = np.linspace(int(len(times) * .55), len(times), 5).astype(int)
    for left, right in zip(boundaries[:-1], boundaries[1:]):
        fit = np.flatnonzero(train["timestamp"].to_numpy() < times[left])
        end = train["timestamp"].to_numpy() <= times[right - 1]
        validation = np.flatnonzero((train["timestamp"].to_numpy() >= times[left]) & end)
        yield fit, validation


def pilot_pipeline(name, config):
    rf = Candidate("v1_rf", "random_forest", {
        "max_depth": None, "min_samples_leaf": 8, "max_features": "sqrt"})
    candidate = Candidate("l1", "logistic", {"C": .01}) if name == "v1_l1" else rf
    if name == "dummy":
        candidate = Candidate("dummy", "dummy", {})
    pipeline = build_pipeline(candidate, config)
    if name == "rf_no_indicator":
        pipeline.set_params(imputer__add_indicator=False)
    if name == "rf_row_missing_count":
        pipeline = Pipeline([("row_missing", RowMissingCount()), *pipeline.steps])
    if name == "hist_gradient_boosting":
        pipeline.set_params(model=HistGradientBoostingClassifier(
            max_iter=100, max_leaf_nodes=7, min_samples_leaf=20,
            l2_regularization=1., learning_rate=.05, class_weight="balanced",
            early_stopping=False, random_state=config.random_seed))
    return pipeline


VARIANTS = ("dummy", "v1_l1", "v1_rf", "rf_no_indicator",
            "rf_row_missing_count", "hist_gradient_boosting")


def run(data_dir: Path, output_dir: Path):
    config = ExperimentConfig(data_dir=data_dir)
    frame = load_secom(data_dir)
    train, _ = time_holdout(frame, config.train_size)
    output_dir.mkdir(parents=True, exist_ok=True)
    rows, splits = [], []
    features = feature_columns(train)
    for fold, (fit_indices, validation_indices) in enumerate(temporal_splits(train)):
        fit, validation = train.iloc[fit_indices], train.iloc[validation_indices]
        if fit.label.nunique() != 2 or validation.label.sum() == 0:
            raise ValueError("Every fold must contain training classes and validation Fail")
        for role, partition in (("fit", fit), ("validation", validation)):
            splits.extend({"fold": fold, "role": role, "sample_id": row.sample_id,
                           "timestamp": row.timestamp.isoformat()} for row in partition.itertuples())
        for name in VARIANTS:
            pipeline = pilot_pipeline(name, config)
            pipeline.fit(fit[features], fit.label)
            probability = pipeline.predict_proba(validation[features])[:, 1]
            top = top_k_table(validation.sample_id, validation.label, probability, (.1,)).iloc[0]
            rows.append({"variant": name, "fold": fold, "fit_samples": len(fit),
                         "validation_samples": len(validation), "validation_fail": int(validation.label.sum()),
                         "ap": classification_metrics(validation.label, probability)["pr_auc_average_precision"],
                         "top10_capture_rate": float(top.fail_capture_rate),
                         "top10_captured": int(top.captured_fail),
                         "inspection_count": int(top.inspection_count)})
    metrics = pd.DataFrame(rows)
    baseline = metrics[metrics.variant == "v1_rf"].set_index("fold")
    for metric in ("ap", "top10_capture_rate"):
        metrics[f"{metric}_delta_vs_rf"] = metrics[metric] - metrics.fold.map(baseline[metric])
    metrics.to_csv(output_dir / "fold_metrics.csv", index=False)
    pd.DataFrame(splits).to_csv(output_dir / "splits.csv", index=False)
    summary = metrics.groupby("variant").agg(
        mean_ap=("ap", "mean"), min_ap=("ap", "min"), max_ap=("ap", "max"),
        mean_top10_capture_rate=("top10_capture_rate", "mean"),
        total_captured=("top10_captured", "sum"),
        mean_ap_delta_vs_rf=("ap_delta_vs_rf", "mean"),
        mean_capture_delta_vs_rf=("top10_capture_rate_delta_vs_rf", "mean"))
    summary.to_csv(output_dir / "summary.csv")
    manifest = {"status": "exploratory_train_only_no_promotion", "seed": config.random_seed,
                "official_train_samples": len(train), "official_test_scored": False,
                "split": "4 expanding windows on unique training timestamps; initial 55%",
                "raw_hashes": frame.attrs["hashes"], "python": platform.python_version(),
                "numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__,
                "source_sha256": sha256_file(Path(__file__)),
                "contract_sha256": sha256_file(Path("docs/validation/SECOM_MISSINGNESS_PILOT.md")),
                "variants": VARIANTS,
                "config": asdict(config),
                "git_revision": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                "dependency_source_hashes": {name: sha256_file(Path(__file__).with_name(name))
                    for name in ("modeling.py", "preprocessing.py", "data.py", "evaluation.py", "config.py")},
                "artifact_sha256": {name: sha256_file(output_dir / name)
                    for name in ("fold_metrics.csv", "summary.csv", "splits.csv")},
                "command": "OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 PYTHONPATH=src python -m fabguard.missingness_pilot --output-dir docs/validation/secom_missingness_pilot"}
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    print(summary.to_string())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("docs/validation/secom_missingness_pilot"))
    args = parser.parse_args()
    run(args.data_dir, args.output_dir)


if __name__ == "__main__":
    main()
