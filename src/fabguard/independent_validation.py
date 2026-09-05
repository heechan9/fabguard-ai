"""Fail-closed profiling contract for independent manufacturing datasets.

This module does not train, select, or evaluate a model. It determines whether
an external CSV is structurally eligible for a future locked-model evaluation
and writes provenance-first validation evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from .data import sha256_file


class IndependentDataContractError(ValueError):
    """Raised when an external dataset cannot be trusted for validation."""


@dataclass(frozen=True)
class IndependentDataSpec:
    id_column: str = "sample_id"
    timestamp_column: str = "timestamp"
    label_column: str = "label"
    feature_prefix: str = "feature_"
    positive_label: str | int | float = 1
    expected_feature_count: int = 590


def _feature_columns(columns: Iterable[str], prefix: str) -> list[str]:
    return sorted(str(column) for column in columns if str(column).startswith(prefix))


def feature_names_sha256(features: Iterable[str]) -> str:
    """Return a stable digest for an ordered feature-name contract."""

    payload = json.dumps(list(features), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def inspect_external_csv(path: Path, spec: IndependentDataSpec) -> dict[str, object]:
    """Validate and profile an external CSV without mutating canonical results."""

    if not spec.feature_prefix or spec.expected_feature_count < 1:
        raise IndependentDataContractError("feature prefix must be non-empty and expected count positive")
    if not path.is_file():
        raise FileNotFoundError(f"independent dataset not found: {path}")
    frame = pd.read_csv(path)
    required = {spec.id_column, spec.timestamp_column, spec.label_column}
    missing_required = sorted(required - set(frame.columns))
    if missing_required:
        raise IndependentDataContractError(f"missing required columns: {missing_required}")
    if frame.empty:
        raise IndependentDataContractError("independent dataset must contain at least one row")
    identifiers = frame[spec.id_column].astype("string")
    if identifiers.isna().any() or identifiers.str.strip().eq("").any():
        raise IndependentDataContractError("sample identifiers must be non-empty")
    if identifiers.duplicated().any():
        raise IndependentDataContractError("sample identifiers must be unique")

    raw_timestamps = frame[spec.timestamp_column]
    if pd.api.types.is_numeric_dtype(raw_timestamps):
        raise IndependentDataContractError(
            "numeric epoch timestamps require an explicit unit and are not accepted by this contract"
        )
    timestamps = pd.to_datetime(raw_timestamps, utc=True, errors="coerce")
    if timestamps.isna().any():
        raise IndependentDataContractError("timestamps must be parseable and UTC-normalizable")

    features = _feature_columns(frame.columns, spec.feature_prefix)
    if not features:
        raise IndependentDataContractError(f"no feature columns start with {spec.feature_prefix!r}")
    converted = frame[features].apply(pd.to_numeric, errors="coerce")
    introduced_missing = converted.isna() & frame[features].notna()
    if introduced_missing.any().any():
        bad = sorted(introduced_missing.columns[introduced_missing.any()].tolist())
        raise IndependentDataContractError(f"non-numeric feature values found in: {bad}")
    if np.isinf(converted.to_numpy(dtype=float)).any():
        raise IndependentDataContractError("feature values must be finite numbers or missing")

    raw_labels = frame[spec.label_column]
    label_values = set(raw_labels.dropna().unique().tolist())
    if raw_labels.isna().any() or len(label_values) != 2 or spec.positive_label not in label_values:
        raise IndependentDataContractError(
            "labels must be complete, binary, and include the configured positive label"
        )
    labels = (raw_labels == spec.positive_label).astype(int)
    expected_features = [f"{spec.feature_prefix}{index:03d}" for index in range(spec.expected_feature_count)]
    exact_v1_schema = features == expected_features
    compatibility = "locked_model_candidate" if exact_v1_schema else "schema_only"

    missing_cells = int(converted.isna().sum().sum())
    return {
        "status": "independent_data_contract_validated",
        "evaluation_mode": compatibility,
        "source": {"filename": path.name, "sha256": sha256_file(path)},
        "contract": asdict(spec),
        "feature_contract": {
            "ordered_names_sha256": feature_names_sha256(features),
            "count": len(features),
        },
        "dataset": {
            "samples": int(len(frame)),
            "measurement_features": int(len(features)),
            "pass_count": int((labels == 0).sum()),
            "fail_count": int((labels == 1).sum()),
            "fail_rate": float(labels.mean()),
            "timestamp_min": timestamps.min().isoformat(),
            "timestamp_max": timestamps.max().isoformat(),
            "time_reversal_transitions": int((timestamps.diff().dropna() < pd.Timedelta(0)).sum()),
            "missing_cells": missing_cells,
            "missing_rate": float(missing_cells / converted.size),
            "all_missing_features": int(converted.isna().all().sum()),
            "constant_features": int((converted.nunique(dropna=True) <= 1).sum()),
        },
        "compatibility": {
            "exact_declared_feature_names": exact_v1_schema,
            "expected_feature_count": spec.expected_feature_count,
            "actual_feature_count": len(features),
            "model_scoring_performed": False,
            "reason": (
                "Exact anonymous feature-name contract; a separately versioned locked model is still required."
                if exact_v1_schema
                else "Feature contract differs from SECOM V1; do not reuse the V1 model or report performance."
            ),
        },
        "claim_boundary": (
            "Schema and provenance validation only. No model fitting, scoring, production deployment, "
            "yield improvement, cost reduction, or causal process claim is established."
        ),
    }


def render_validation_summary(report: dict[str, object]) -> str:
    dataset = report["dataset"]
    compatibility = report["compatibility"]
    source = report["source"]
    return f"""# Independent Manufacturing Data Validation Report

Status: **{report['status']}**  
Evaluation mode: **{report['evaluation_mode']}**

## Provenance

- File: `{source['filename']}`
- SHA-256: `{source['sha256']}`

## Data contract

- Samples: {dataset['samples']}
- Measurement features: {dataset['measurement_features']}
- Pass / Fail: {dataset['pass_count']} / {dataset['fail_count']}
- Missing cells: {dataset['missing_cells']} ({dataset['missing_rate']:.2%})
- Time reversals in supplied order: {dataset['time_reversal_transitions']}
- Constant / all-missing features: {dataset['constant_features']} / {dataset['all_missing_features']}

## Locked-model eligibility

- Exact declared anonymous feature names: {compatibility['exact_declared_feature_names']}
- Model scoring performed: {compatibility['model_scoring_performed']}
- Decision: {compatibility['reason']}

## Claim boundary

{report['claim_boundary']}
"""


def write_validation_report(path: Path, output_dir: Path, spec: IndependentDataSpec) -> dict[str, object]:
    report = inspect_external_csv(path, spec)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "validation_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
    )
    (output_dir / "VALIDATION_SUMMARY.md").write_text(
        render_validation_summary(report), encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate an independent manufacturing CSV contract")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("results/independent-validation"))
    parser.add_argument("--id-column", default="sample_id")
    parser.add_argument("--timestamp-column", default="timestamp")
    parser.add_argument("--label-column", default="label")
    parser.add_argument("--feature-prefix", default="feature_")
    parser.add_argument("--positive-label", default="1")
    parser.add_argument("--expected-feature-count", type=int, default=590)
    args = parser.parse_args()
    positive_label: str | int = int(args.positive_label) if args.positive_label.lstrip("-").isdigit() else args.positive_label
    spec = IndependentDataSpec(
        id_column=args.id_column,
        timestamp_column=args.timestamp_column,
        label_column=args.label_column,
        feature_prefix=args.feature_prefix,
        positive_label=positive_label,
        expected_feature_count=args.expected_feature_count,
    )
    report = write_validation_report(args.input, args.output_dir, spec)
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
