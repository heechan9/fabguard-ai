"""Run the fixed FabGuard V1 comparison and write reproducible artifacts."""

from __future__ import annotations

import argparse
import json
import platform
import sys
from dataclasses import asdict, replace
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import RepeatedStratifiedKFold

from .config import ExperimentConfig
from .data import audit_frame, load_secom, time_holdout
from .evaluation import classification_metrics, top_k_table
from .modeling import Candidate, build_pipeline, candidates, transformed_feature_names


def feature_columns(frame: pd.DataFrame) -> list[str]:
    return [column for column in frame if column.startswith("feature_")]


def run_cv(train: pd.DataFrame, config: ExperimentConfig) -> tuple[pd.DataFrame, dict[str, Candidate]]:
    X = train[feature_columns(train)]
    y = train["label"].to_numpy()
    splitter = RepeatedStratifiedKFold(
        n_splits=config.cv_splits,
        n_repeats=config.cv_repeats,
        random_state=config.random_seed,
    )
    split_indices = list(splitter.split(X, y))
    rows: list[dict[str, object]] = []
    items = candidates(config)

    for candidate in items:
        for fold, (fit_index, validation_index) in enumerate(split_indices):
            pipeline = build_pipeline(candidate, config)
            pipeline.fit(X.iloc[fit_index], y[fit_index])
            probability = pipeline.predict_proba(X.iloc[validation_index])[:, 1]
            metrics = classification_metrics(y[validation_index], probability)
            quality = pipeline.named_steps["quality"]
            rows.append({
                "candidate": candidate.name,
                "family": candidate.family,
                "fold": fold,
                "repeat": fold // config.cv_splits,
                "split": fold % config.cv_splits,
                "validation_samples": len(validation_index),
                "validation_fail": int(y[validation_index].sum()),
                "selected_features": len(quality.selected_columns_),
                "removed_high_missing": len(quality.high_missing_columns_),
                "removed_uninformative": len(quality.uninformative_columns_),
                "removed_duplicate": len(quality.duplicate_columns_),
                **metrics,
            })

    metrics_frame = pd.DataFrame(rows)
    selected: dict[str, Candidate] = {}
    for family in ("dummy", "logistic", "random_forest"):
        family_rows = metrics_frame[metrics_frame["family"] == family]
        means = family_rows.groupby("candidate")["pr_auc_average_precision"].mean()
        best_name = str(means.idxmax())
        selected[family] = next(item for item in items if item.name == best_name)
    return metrics_frame, selected


def cv_summary(metrics: pd.DataFrame) -> pd.DataFrame:
    metric_columns = [
        "pr_auc_average_precision",
        "fail_recall",
        "precision",
        "f1",
        "balanced_accuracy",
        "false_alarm_rate",
        "accuracy",
    ]
    summary = metrics.groupby(["candidate", "family"])[metric_columns].agg(["mean", "std", "min", "max"])
    summary.columns = [f"{metric}_{stat}" for metric, stat in summary.columns]
    return summary.reset_index().sort_values("pr_auc_average_precision_mean", ascending=False)


def model_importance(pipeline: object) -> pd.DataFrame:
    names = transformed_feature_names(pipeline)
    model = pipeline.named_steps["model"]
    if hasattr(model, "coef_"):
        raw = np.asarray(model.coef_[0], dtype=float)
        signed = raw
    elif hasattr(model, "feature_importances_"):
        raw = np.asarray(model.feature_importances_, dtype=float)
        signed = np.full_like(raw, np.nan)
    else:
        raw = np.zeros(len(names), dtype=float)
        signed = np.full_like(raw, np.nan)
    return pd.DataFrame({
        "feature": names,
        "importance": np.abs(raw),
        "signed_value": signed,
    }).sort_values(["importance", "feature"], ascending=[False, True], kind="stable")


def stability_for_candidate(train: pd.DataFrame, candidate: Candidate, config: ExperimentConfig) -> pd.DataFrame:
    X = train[feature_columns(train)]
    y = train["label"].to_numpy()
    splitter = RepeatedStratifiedKFold(
        n_splits=config.cv_splits,
        n_repeats=config.cv_repeats,
        random_state=config.random_seed,
    )
    records: list[dict[str, object]] = []
    for fold, (fit_index, _) in enumerate(splitter.split(X, y)):
        pipeline = build_pipeline(candidate, config)
        pipeline.fit(X.iloc[fit_index], y[fit_index])
        importance = model_importance(pipeline).reset_index(drop=True)
        top = importance.head(20)
        for rank, row in top.iterrows():
            records.append({
                "fold": fold,
                "feature": row["feature"],
                "rank": rank + 1,
                "importance": row["importance"],
                "sign": np.sign(row["signed_value"]) if pd.notna(row["signed_value"]) else np.nan,
            })
    raw = pd.DataFrame(records)
    grouped = raw.groupby("feature").agg(
        top20_frequency=("fold", "nunique"),
        median_rank=("rank", "median"),
        rank_iqr=("rank", lambda values: values.quantile(0.75) - values.quantile(0.25)),
        median_importance=("importance", "median"),
        positive_sign_rate=("sign", lambda values: float((values > 0).mean()) if values.notna().any() else np.nan),
    )
    grouped["top20_rate"] = grouped["top20_frequency"] / (config.cv_splits * config.cv_repeats)
    return grouped.reset_index().sort_values(["top20_frequency", "median_rank"], ascending=[False, True])


def priority_table(
    pipeline: object,
    test: pd.DataFrame,
    probability: np.ndarray,
    threshold: float,
    candidate: Candidate,
) -> pd.DataFrame:
    X = test[feature_columns(test)]
    importance = model_importance(pipeline)
    model = pipeline.named_steps["model"]
    names = transformed_feature_names(pipeline)
    transformed = pipeline[:-1].transform(X)

    evidence: list[str] = []
    scope: list[str] = []
    if hasattr(model, "coef_"):
        coefficient = np.asarray(model.coef_[0], dtype=float)
        local = np.asarray(transformed) * coefficient
        for row in local:
            order = np.argsort(np.abs(row))[::-1][:5]
            evidence.append(";".join(names[index] for index in order))
            scope.append("local_linear_contribution")
    else:
        global_features = ";".join(importance.head(5)["feature"].tolist())
        evidence = [global_features] * len(test)
        scope = ["global_model_importance"] * len(test)

    output = pd.DataFrame({
        "sample_id": test["sample_id"].to_numpy(),
        "timestamp": test["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S").to_numpy(),
        "risk_score": probability,
        "prediction": (probability >= threshold).astype(int),
        "label": test["label"].to_numpy(),
        "suggested_features": evidence,
        "evidence_scope": scope,
        "model": candidate.name,
        "limitation": "Anonymous variables are inspection candidates, not proven physical causes.",
    }).sort_values(["risk_score", "sample_id"], ascending=[False, True], kind="stable")
    output.insert(0, "rank", np.arange(1, len(output) + 1))
    return output


def run_experiment(config: ExperimentConfig) -> dict[str, object]:
    config.output_dir.mkdir(parents=True, exist_ok=True)
    frame = load_secom(config.data_dir)
    audit = audit_frame(frame)
    train, test = time_holdout(frame, config.train_size)
    feature_names = feature_columns(frame)
    train[["sample_id", "timestamp", "label"]].to_csv(config.output_dir / "train_split.csv", index=False)
    test[["sample_id", "timestamp", "label"]].to_csv(config.output_dir / "test_split.csv", index=False)
    (config.output_dir / "data_audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")

    cv_metrics, selected_by_family = run_cv(train, config)
    summary = cv_summary(cv_metrics)
    cv_metrics.to_csv(config.output_dir / "cv_metrics.csv", index=False)
    summary.to_csv(config.output_dir / "cv_summary.csv", index=False)

    X_train = train[feature_names]
    X_test = test[feature_names]
    y_train = train["label"].to_numpy()
    y_test = test["label"].to_numpy()
    test_rows: list[dict[str, object]] = []
    fitted: dict[str, tuple[Candidate, object, np.ndarray]] = {}
    for family, candidate in selected_by_family.items():
        pipeline = build_pipeline(candidate, config)
        pipeline.fit(X_train, y_train)
        probability = pipeline.predict_proba(X_test)[:, 1]
        fitted[family] = (candidate, pipeline, probability)
        test_rows.append({"family": family, "candidate": candidate.name, **classification_metrics(y_test, probability)})
    test_metrics = pd.DataFrame(test_rows).sort_values("pr_auc_average_precision", ascending=False)
    test_metrics.to_csv(config.output_dir / "test_metrics.csv", index=False)

    non_dummy = summary[summary["family"].isin(["logistic", "random_forest"])]
    selected_name = str(non_dummy.iloc[0]["candidate"])
    selected_family = str(non_dummy.iloc[0]["family"])
    candidate, pipeline, probability = fitted[selected_family]
    if candidate.name != selected_name:
        raise AssertionError("Selected family candidate mismatch")

    topk = top_k_table(test["sample_id"], y_test, probability, config.top_k_fractions)
    topk.to_csv(config.output_dir / "top_k_test.csv", index=False)
    priorities = priority_table(pipeline, test, probability, 0.5, candidate)
    priorities.to_csv(config.output_dir / "priority_table.csv", index=False)
    importance = model_importance(pipeline)
    importance.to_csv(config.output_dir / "final_model_importance.csv", index=False)
    stability = stability_for_candidate(train, candidate, config)
    stability.to_csv(config.output_dir / "feature_stability.csv", index=False)

    manifest = {
        "project": "FabGuard AI V1",
        "selected_candidate_from_train_cv": candidate.name,
        "selection_metric": "mean train repeated-CV average precision",
        "evaluation_status": "provisional_due_to_prior_engineering_smoke_test_exposure",
        "test_exposure_log": "docs/TEST_EXPOSURE.md",
        "threshold": 0.5,
        "config": asdict(config),
        "raw_hashes": frame.attrs["hashes"],
        "python": sys.version,
        "platform": platform.platform(),
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "scikit_learn": sklearn.__version__,
    }
    (config.output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return {
        "selected_candidate": candidate.name,
        "cv_summary": summary.to_dict(orient="records"),
        "test_metrics": test_metrics.to_dict(orient="records"),
        "top_k": topk.to_dict(orient="records"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("results/v1"))
    parser.add_argument("--fast", action="store_true", help="Use one 5-fold repeat and smaller forests for a smoke run")
    args = parser.parse_args()
    config = ExperimentConfig(data_dir=args.data_dir, output_dir=args.output_dir)
    if args.fast:
        config = replace(config, cv_repeats=1, rf_estimators=40)
    result = run_experiment(config)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
