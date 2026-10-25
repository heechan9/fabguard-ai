"""Bounded preprocessing ablation on the frozen SECOM training partition only."""

from __future__ import annotations

import argparse
import inspect
import json
import math
import platform
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.exceptions import ConvergenceWarning
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

from .data import sha256_file, validate_raw_files
from .preprocessing import TrainColumnFilter

SEED = 20261023
TRAIN_ROWS = 1175
TRAIN_SPLIT_SHA256 = "d47b5254102519050844e21f0076537644d45dfe7262d596ad5c7887e6e81aec"
MODES = ("impute_only", "filter_only", "current", "current_plus_row_missing")
FAMILIES = ("l1_logistic", "random_forest", "hist_gradient_boosting")


class ComparisonFeatures(BaseEstimator, TransformerMixin):
    """Fit column decisions and imputation on fit rows; count raw missing cells."""

    def __init__(self, mode: str = "current"):
        self.mode = mode

    @staticmethod
    def _validate(X: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(X, pd.DataFrame) or X.empty or not X.columns.is_unique:
            raise ValueError("Expected a nonempty DataFrame with unique feature columns")
        if not all(str(name).startswith("feature_") for name in X.columns):
            raise ValueError("Only anonymous feature columns are allowed")
        if not all(pd.api.types.is_numeric_dtype(dtype) for dtype in X.dtypes):
            raise ValueError("Features must be numeric")
        if np.isinf(X.to_numpy(dtype=float)).any():
            raise ValueError("Infinite feature values are not supported")
        return X

    def fit(self, X: pd.DataFrame, y: object = None) -> "ComparisonFeatures":
        frame = self._validate(X)
        if self.mode not in MODES:
            raise ValueError(f"Unknown feature mode: {self.mode}")
        self.feature_names_in_ = np.asarray(frame.columns, dtype=object)
        self.quality_ = None
        if self.mode != "impute_only":
            self.quality_ = TrainColumnFilter(0.50).fit(frame)
            frame = self.quality_.transform(frame)
        self.selected_columns_ = frame.columns.tolist()
        self.imputer_ = SimpleImputer(
            strategy="median", add_indicator=self.mode in MODES[2:], keep_empty_features=True,
        ).fit(frame)
        self.output_names_ = self.imputer_.get_feature_names_out(frame.columns).tolist()
        if self.mode == "current_plus_row_missing":
            self.output_names_.append("raw_row_missing_count")
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        frame = self._validate(X)
        if frame.columns.tolist() != self.feature_names_in_.tolist():
            raise ValueError("Feature schema/order differs from fit data")
        values = self.imputer_.transform(frame[self.selected_columns_])
        if self.mode == "current_plus_row_missing":
            values = np.column_stack([values, frame.isna().sum(axis=1).to_numpy()])
        return values

    def get_feature_names_out(self, input_features: object = None) -> np.ndarray:
        return np.asarray(self.output_names_, dtype=object)


def load_frozen_training(data_dir: Path, train_split: Path) -> pd.DataFrame:
    """Hash full files, but parse only the original 1,175 training rows.

    The pinned manifest identifies exactly raw rows 0..1174 in time order. No
    holdout feature/label rows are parsed, transformed, predicted, or evaluated.
    """
    if sha256_file(train_split) != TRAIN_SPLIT_SHA256:
        raise ValueError("Frozen training manifest hash mismatch")
    hashes = validate_raw_files(data_dir)
    manifest = pd.read_csv(train_split, parse_dates=["timestamp"])
    expected_ids = [f"secom_{index:04d}" for index in range(TRAIN_ROWS)]
    if manifest["sample_id"].tolist() != expected_ids:
        raise ValueError("Frozen training membership/order mismatch")
    features = pd.read_csv(data_dir / "secom.data", sep=r"\s+", header=None, nrows=TRAIN_ROWS)
    raw_labels = pd.read_csv(data_dir / "secom_labels.data", sep=r"\s+", header=None,
                             names=["raw_label", "timestamp_text"], nrows=TRAIN_ROWS)
    if features.shape != (TRAIN_ROWS, 590) or len(raw_labels) != TRAIN_ROWS:
        raise ValueError("Unexpected frozen training shape")
    timestamps = pd.to_datetime(raw_labels["timestamp_text"], format="%d/%m/%Y %H:%M:%S")
    labels = (raw_labels["raw_label"] == 1).astype(int)
    if not timestamps.equals(manifest["timestamp"]) or not labels.equals(manifest["label"]):
        raise ValueError("Training labels/timestamps differ from frozen manifest")
    features.columns = [f"feature_{index:03d}" for index in range(590)]
    frame = pd.concat([manifest, features], axis=1)
    frame.attrs["raw_hashes"] = hashes
    frame.attrs["train_split_sha256"] = TRAIN_SPLIT_SHA256
    return frame


def expanding_day_folds(frame: pd.DataFrame) -> list[tuple[np.ndarray, np.ndarray]]:
    """Split unique training dates into four consecutive blocks; expand fit."""
    if frame["timestamp"].isna().any() or not frame["timestamp"].is_monotonic_increasing:
        raise ValueError("Training timestamps must be present and ordered")
    if frame["sample_id"].duplicated().any():
        raise ValueError("Sample IDs must be unique")
    days = frame["timestamp"].dt.normalize()
    unique_days = days.drop_duplicates().to_numpy()
    if len(unique_days) < 4:
        raise ValueError("At least four distinct training dates are required")
    blocks = np.array_split(unique_days, 4)
    folds = []
    for index in range(1, 4):
        fit = np.flatnonzero(days.isin(np.concatenate(blocks[:index])).to_numpy())
        validation = np.flatnonzero(days.isin(blocks[index]).to_numpy())
        for rows in (fit, validation):
            if set(frame.iloc[rows]["label"].unique()) != {0, 1}:
                raise ValueError("Every fit/validation fold must contain both classes")
        if frame.iloc[fit]["timestamp"].max() >= frame.iloc[validation]["timestamp"].min():
            raise ValueError("Temporal fold boundary overlaps")
        folds.append((fit, validation))
    return folds


def build_comparison_pipeline(family: str, mode: str) -> Pipeline:
    steps = [("features", ComparisonFeatures(mode))]
    if family == "l1_logistic":
        kwargs = dict(solver="liblinear", class_weight="balanced", C=0.1,
                      max_iter=3000, random_state=SEED)
        if inspect.signature(LogisticRegression).parameters["penalty"].default == "deprecated":
            kwargs["l1_ratio"] = 1.0
        else:
            kwargs["penalty"] = "l1"
        model = LogisticRegression(**kwargs)
        steps.append(("scaler", StandardScaler()))
    elif family == "random_forest":
        model = RandomForestClassifier(n_estimators=120, max_depth=8, min_samples_leaf=4,
                                       max_features="sqrt", class_weight="balanced_subsample",
                                       n_jobs=1, random_state=SEED)
    elif family == "hist_gradient_boosting":
        model = HistGradientBoostingClassifier(max_iter=100, learning_rate=0.05,
                                               max_leaf_nodes=7, max_depth=3,
                                               min_samples_leaf=20, l2_regularization=1.0,
                                               class_weight="balanced", early_stopping=False,
                                               random_state=SEED)
    elif family == "dummy":
        model = DummyClassifier(strategy="prior", random_state=SEED)
    else:
        raise ValueError(f"Unknown family: {family}")
    return Pipeline([*steps, ("model", model)])


def ranking_metrics(sample_ids: pd.Series, y: np.ndarray, scores: np.ndarray) -> dict[str, object]:
    """Exact ceil(10% n) review budget; score descending then ID ascending."""
    y = np.asarray(y)
    scores = np.asarray(scores, dtype=float)
    ids = np.asarray(sample_ids)
    if len(y) == 0 or len(y) != len(scores) or len(ids) != len(y):
        raise ValueError("Ranking arrays must have equal nonzero length")
    if set(np.unique(y)) != {0, 1} or not np.isfinite(scores).all():
        raise ValueError("Ranking requires binary classes and finite scores")
    if len(set(ids)) != len(ids):
        raise ValueError("Ranking IDs must be unique")
    order = np.lexsort((ids, -scores))
    k = math.ceil(0.10 * len(y))
    captured = int(y[order[:k]].sum())
    cutoff = scores[order[k - 1]]
    above = scores > cutoff
    tied = scores == cutoff
    slots = k - int(above.sum())
    tied_fail = int(y[tied].sum())
    tied_count = int(tied.sum())
    certain = int(y[above].sum())
    total_fail = int(y.sum())
    return {
        "average_precision": float(average_precision_score(y, scores)),
        "validation_rows": len(y), "validation_fail": total_fail,
        "inspection_count": k, "captured_fail": captured,
        "capture_rate": captured / total_fail,
        "boundary_tied_rows": tied_count, "boundary_tied_fail": tied_fail,
        "boundary_tie_slots": slots,
        "tie_capture_min": certain + max(0, slots - (tied_count - tied_fail)),
        "tie_capture_max": certain + min(slots, tied_fail),
        "tie_capture_expected": certain + slots * tied_fail / tied_count,
    }


def summarize(folds: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (family, mode), group in folds.groupby(["family", "mode"], sort=False):
        row = {"family": family, "mode": mode, "folds": len(group)}
        for metric in ("average_precision", "capture_rate"):
            values = group[metric]
            row.update({f"{metric}_{stat}": float(value) for stat, value in (
                ("mean", values.mean()), ("std", values.std(ddof=1)),
                ("min", values.min()), ("max", values.max()))})
        for column in ("validation_rows", "validation_fail", "inspection_count", "captured_fail",
                       "tie_capture_min", "tie_capture_max", "tie_capture_expected"):
            row[column + "_sum"] = float(group[column].sum())
        row["pooled_fold_budget_capture_rate"] = row["captured_fail_sum"] / row["validation_fail_sum"]
        rows.append(row)
    return pd.DataFrame(rows)


def compare_training(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, list[dict]]:
    columns = [column for column in frame if column.startswith("feature_")]
    X, y = frame[columns], frame["label"].to_numpy()
    folds = expanding_day_folds(frame)
    candidates = [(family, mode) for family in FAMILIES for mode in MODES] + [("dummy", "current")]
    records, audit = [], []
    for fold, (fit, validation) in enumerate(folds, start=1):
        fit_frame, val_frame = frame.iloc[fit], frame.iloc[validation]
        audit.append({
            "fold": fold, "fit_rows": len(fit), "fit_fail": int(y[fit].sum()),
            "validation_rows": len(validation), "validation_fail": int(y[validation].sum()),
            "fit_start": fit_frame.timestamp.min().isoformat(),
            "fit_end": fit_frame.timestamp.max().isoformat(),
            "validation_start": val_frame.timestamp.min().isoformat(),
            "validation_end": val_frame.timestamp.max().isoformat(),
            "fit_sample_ids": fit_frame.sample_id.tolist(),
            "validation_sample_ids": val_frame.sample_id.tolist(),
        })
        for family, mode in candidates:
            pipeline = build_comparison_pipeline(family, mode)
            with threadpool_limits(limits=1), warnings.catch_warnings():
                warnings.simplefilter("error", ConvergenceWarning)
                pipeline.fit(X.iloc[fit], y[fit])
                scores = pipeline.predict_proba(X.iloc[validation])[:, 1]
            features = pipeline.named_steps["features"]
            quality = features.quality_
            records.append({
                "fold": fold, "family": family, "mode": mode,
                "fit_rows": len(fit), "fit_fail": int(y[fit].sum()),
                "retained_raw_columns": len(features.selected_columns_),
                "transformed_columns": len(features.output_names_),
                "removed_high_missing": len(quality.high_missing_columns_) if quality else 0,
                "removed_uninformative": len(quality.uninformative_columns_) if quality else 0,
                "removed_duplicate": len(quality.duplicate_columns_) if quality else 0,
                **ranking_metrics(val_frame.sample_id, y[validation], scores),
            })
    metrics = pd.DataFrame(records)
    return metrics, summarize(metrics), audit


def run(data_dir: Path, train_split: Path, output_dir: Path) -> dict:
    # Never silently overwrite an earlier experiment or protected inputs/results.
    if output_dir.exists():
        raise FileExistsError("Output directory must be new")
    frame = load_frozen_training(data_dir, train_split)
    metrics, summary, folds = compare_training(frame)
    manifest = {
        "status": "exploratory_training_only_comparison", "seed": SEED,
        "training_rows": len(frame), "training_fail": int(frame.label.sum()),
        "test_rows_parsed_or_scored": 0, "final_model_fit": False, "candidate_selection": "none",
        "raw_hashes": frame.attrs["raw_hashes"], "train_split_sha256": TRAIN_SPLIT_SHA256,
        "module_sha256": sha256_file(Path(__file__)),
        "models": {family: build_comparison_pipeline(family, "current").named_steps["model"].get_params()
                   for family in (*FAMILIES, "dummy")},
        "feature_modes": list(MODES), "fits": len(metrics),
        "folds": folds,
        "metrics": {"AP": "sklearn average_precision_score, not trapezoidal PR area",
                    "budget": "ceil(0.10 * validation rows) separately per fold",
                    "capture_denominator": "all failed rows in the validation fold",
                    "ties": "score descending then sample_id ascending; bounds and random-tie expectation also saved",
                    "dispersion": "sample std (ddof=1), min/max across 3 dependent expanding folds, not a confidence interval",
                    "pooling": "sum captured / sum failures over disjoint validation blocks; not a global top10% ranking"},
        "environment": {"python": platform.python_version(), "numpy": np.__version__,
                        "pandas": pd.__version__, "scikit_learn": sklearn.__version__},
        "limitations": ["Training development evidence only, not independent validation",
                        "No new holdout result or production recommendation",
                        "Chronological date blocks do not establish lot/machine separation; those IDs are unavailable",
                        "Repeated historical training use and small failure counts limit generalization claims"],
    }
    output_dir.mkdir(parents=True, exist_ok=False)
    metrics.to_csv(output_dir / "fold_metrics.csv", index=False)
    summary.to_csv(output_dir / "summary.csv", index=False)
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--train-split", type=Path, default=Path("results/v1/train_split.csv"))
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.data_dir, args.train_split, args.output_dir)
    print(json.dumps({key: result[key] for key in ("status", "training_rows", "fits", "test_rows_parsed_or_scored")}, indent=2))


if __name__ == "__main__":
    main()
