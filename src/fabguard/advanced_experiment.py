"""Run FabGuard Phase-1 decision and temporal robustness analyses."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, replace
from pathlib import Path

import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import average_precision_score

try:
    from sklearn.frozen import FrozenEstimator
except ImportError:  # scikit-learn < 1.6
    FrozenEstimator = None

from .advanced_evaluation import (bootstrap_top_k_interval, calibration_metrics, drift_table,
                                  inspection_cost_table, walk_forward_slices)
from .config import ExperimentConfig
from .data import load_secom, time_holdout
from .experiment import feature_columns, run_cv
from .modeling import build_pipeline


def selected_candidate(train: pd.DataFrame, config: ExperimentConfig):
    metrics, selected = run_cv(train, config)
    eligible = metrics[metrics["family"].isin(["logistic", "random_forest"])]
    name = str(eligible.groupby("candidate")["pr_auc_average_precision"].mean().idxmax())
    return next(candidate for candidate in selected.values() if candidate.name == name)


def prefit_calibrator(estimator: object) -> CalibratedClassifierCV:
    """Build a calibrator compatible with both old and current scikit-learn."""
    if FrozenEstimator is not None:
        return CalibratedClassifierCV(FrozenEstimator(estimator), method="sigmoid")
    return CalibratedClassifierCV(estimator, method="sigmoid", cv="prefit")


def run_advanced_experiment(config: ExperimentConfig, *, output_dir: Path, bootstrap_replicates: int = 2000,
                            inspection_cost: float = 1.0, missed_fail_cost: float = 20.0) -> dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    frame = load_secom(config.data_dir)
    train, test = time_holdout(frame, config.train_size)
    features = feature_columns(frame)
    candidate = selected_candidate(train, config)

    calibration_start = int(len(train) * 0.80)
    fit, calibration = train.iloc[:calibration_start], train.iloc[calibration_start:]
    base = build_pipeline(candidate, config)
    base.fit(fit[features], fit["label"])
    calibrated = prefit_calibrator(base)
    calibrated.fit(calibration[features], calibration["label"])
    raw_probability = base.predict_proba(test[features])[:, 1]
    probability = calibrated.predict_proba(test[features])[:, 1]

    pd.DataFrame([
        {"variant": "uncalibrated", **calibration_metrics(test["label"], raw_probability)},
        {"variant": "sigmoid_train_tail", **calibration_metrics(test["label"], probability)},
    ]).to_csv(output_dir / "calibration_metrics.csv", index=False)
    inspection_cost_table(test["sample_id"], test["label"], probability, config.top_k_fractions,
                          inspection_cost=inspection_cost, missed_fail_cost=missed_fail_cost).to_csv(
                              output_dir / "inspection_cost_scenarios.csv", index=False)
    bootstrap_top_k_interval(test["sample_id"].tolist(), test["label"].tolist(), probability.tolist(),
                             config.top_k_fractions, n_bootstrap=bootstrap_replicates,
                             random_seed=config.random_seed).to_csv(output_dir / "top_k_bootstrap.csv", index=False)
    drift_table(train, test, features).to_csv(output_dir / "feature_drift.csv", index=False)

    ordered = frame.sort_values(["timestamp", "sample_id"], kind="stable").reset_index(drop=True)
    walk_rows = []
    for fold, (fit_index, validation_index) in enumerate(walk_forward_slices(ordered["timestamp"])):
        fit_fold, validation = ordered.iloc[fit_index], ordered.iloc[validation_index]
        if fit_fold["label"].nunique() < 2 or validation["label"].sum() == 0:
            continue
        pipeline = build_pipeline(candidate, config)
        pipeline.fit(fit_fold[features], fit_fold["label"])
        fold_probability = pipeline.predict_proba(validation[features])[:, 1]
        walk_rows.append({"fold": fold, "train_samples": len(fit_fold), "samples": len(validation),
                          "fail": int(validation["label"].sum()), "fail_rate": float(validation["label"].mean()),
                          "average_precision": float(average_precision_score(validation["label"], fold_probability)),
                          **calibration_metrics(validation["label"], fold_probability),
                          "validation_start": validation["timestamp"].min().isoformat(),
                          "validation_end": validation["timestamp"].max().isoformat()})
    pd.DataFrame(walk_rows).to_csv(output_dir / "walk_forward_metrics.csv", index=False)

    manifest = {"status": "scenario_and_provisional_validation", "selected_candidate": candidate.name,
                "base_contract": "results/v1/manifest.json", "test_split_changed": False,
                "calibration_fit_scope": "last_20_percent_of_training_period_only",
                "bootstrap_replicates": bootstrap_replicates, "cost_units_are_scenarios_not_currency": True,
                "inspection_cost_units": inspection_cost, "missed_fail_cost_units": missed_fail_cost,
                "config": asdict(config), "raw_hashes": frame.attrs["hashes"]}
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("results/phase1"))
    parser.add_argument("--bootstrap", type=int, default=2000)
    parser.add_argument("--inspection-cost", type=float, default=1.0)
    parser.add_argument("--missed-fail-cost", type=float, default=20.0)
    parser.add_argument("--fast", action="store_true")
    args = parser.parse_args()
    config = ExperimentConfig(data_dir=args.data_dir)
    if args.fast:
        config = replace(config, cv_repeats=1, rf_estimators=40)
    print(json.dumps(run_advanced_experiment(config, output_dir=args.output_dir,
        bootstrap_replicates=args.bootstrap, inspection_cost=args.inspection_cost,
        missed_fail_cost=args.missed_fail_cost), ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
