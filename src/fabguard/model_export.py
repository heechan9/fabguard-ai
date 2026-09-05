"""Export the already-selected FabGuard V1 pipeline as a locked model bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import sys
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn

from .config import ExperimentConfig
from .data import load_secom, sha256_file, time_holdout
from .experiment import feature_columns
from .independent_validation import feature_names_sha256
from .modeling import build_pipeline, candidates


class ModelExportContractError(ValueError):
    """Raised when a locked export would violate the frozen V1 contract."""


def _read_object(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ModelExportContractError(f"cannot read {label}: {path}") from error
    if not isinstance(payload, dict):
        raise ModelExportContractError(f"{label} must be a JSON object")
    return payload


def _stable_sha(payload: object) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _verify_frozen_selection(manifest: dict[str, Any], config: ExperimentConfig) -> str:
    selected = manifest.get("selected_candidate_from_train_cv")
    available = {candidate.name for candidate in candidates(config) if candidate.family != "dummy"}
    if selected not in available:
        raise ModelExportContractError("canonical manifest selected candidate is absent from fixed V1 candidates")
    if manifest.get("selection_metric") != "mean train repeated-CV average precision":
        raise ModelExportContractError("canonical selection metric differs from the V1 contract")
    declared = manifest.get("config")
    expected = asdict(config)
    if not isinstance(declared, dict):
        raise ModelExportContractError("canonical manifest lacks config")
    for key in (
        "random_seed", "train_size", "missing_threshold", "cv_splits", "cv_repeats",
        "logistic_c_values", "rf_candidates", "rf_estimators",
    ):
        # JSON manifests represent tuple-valued config as arrays. Compare their
        # canonical JSON forms rather than Python container types.
        if json.loads(json.dumps(declared.get(key))) != json.loads(json.dumps(expected[key])):
            raise ModelExportContractError(f"canonical config mismatch: {key}")
    return str(selected)


def _verify_split_contract(train: pd.DataFrame, split_path: Path) -> str:
    if not split_path.is_file():
        raise ModelExportContractError(f"canonical train split is missing: {split_path}")
    expected = pd.read_csv(split_path, dtype={"sample_id": "string"})
    if "sample_id" not in expected or expected["sample_id"].tolist() != train["sample_id"].tolist():
        raise ModelExportContractError("recreated training rows do not match canonical train_split.csv")
    return sha256_file(split_path)


def export_locked_model(
    config: ExperimentConfig,
    canonical_result_dir: Path,
    output_dir: Path,
) -> dict[str, Any]:
    """Fit only the frozen selected candidate on canonical Train and atomically export it.

    The function never reads labels or features from the temporal holdout for fitting,
    selection, calibration, or threshold changes. The holdout is recreated only by the
    existing split function so the Train identity contract can be checked.
    """

    if output_dir.exists():
        raise ModelExportContractError("output directory already exists; locked bundles are immutable")
    canonical_manifest_path = canonical_result_dir / "manifest.json"
    canonical_manifest = _read_object(canonical_manifest_path, "canonical manifest")
    selected_name = _verify_frozen_selection(canonical_manifest, config)

    frame = load_secom(config.data_dir)
    if canonical_manifest.get("raw_hashes") != frame.attrs.get("hashes"):
        raise ModelExportContractError("raw data hashes differ from the canonical V1 manifest")
    train, _holdout_not_used = time_holdout(frame, config.train_size)
    split_sha = _verify_split_contract(train, canonical_result_dir / "train_split.csv")
    features = feature_columns(frame)
    candidate = next(item for item in candidates(config) if item.name == selected_name)
    pipeline = build_pipeline(candidate, config)
    pipeline.fit(train[features], train["label"].to_numpy())

    parent = output_dir.parent.resolve()
    parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}-", dir=parent))
    try:
        artifact = temporary / "model.joblib"
        joblib.dump(pipeline, artifact, compress=0, protocol=4)
        artifact_sha = sha256_file(artifact)
        training_identity = {
            "raw_hashes": canonical_manifest["raw_hashes"],
            "train_split_sha256": split_sha,
            "train_samples": int(len(train)),
            "train_fail": int(train["label"].sum()),
        }
        manifest = {
            "schema_version": "fabguard.locked-model.v1",
            "model_id": f"fabguard-v1-{selected_name}",
            "frozen": True,
            "artifact": {
                "path": artifact.name,
                "sha256": artifact_sha,
                "serialization": "joblib-pickle-protocol-4",
                "trusted_artifact_only": True,
            },
            "input_contract": {
                "feature_count": len(features),
                "feature_names_sha256": feature_names_sha256(features),
            },
            "training": {
                "data_sha256": _stable_sha(training_identity),
                "split_contract": "canonical temporal Train rows from results/v1/train_split.csv",
                "train_split_sha256": split_sha,
                "train_samples": int(len(train)),
                "train_fail": int(train["label"].sum()),
                "selected_candidate": selected_name,
                "selection_complete": True,
                "holdout_used_for_fit_or_selection": False,
                "random_seed": config.random_seed,
                "raw_hashes": canonical_manifest["raw_hashes"],
                "canonical_manifest_sha256": sha256_file(canonical_manifest_path),
            },
            "environment": {
                "python": sys.version,
                "platform": platform.platform(),
                "numpy": np.__version__,
                "pandas": pd.__version__,
                "scikit_learn": sklearn.__version__,
                "joblib": joblib.__version__,
            },
            "claim_boundary": (
                "Frozen training artifact only. It does not establish independent performance, "
                "Fledge compatibility, factory deployment, yield, cost, or causal process impact."
            ),
        }
        (temporary / "model_manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
        )
        os.replace(temporary, output_dir.resolve())
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the frozen FabGuard V1 Train-only model bundle")
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--canonical-result-dir", type=Path, default=Path("results/v1"))
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    config = ExperimentConfig(data_dir=args.data_dir, output_dir=args.canonical_result_dir)
    result = export_locked_model(config, args.canonical_result_dir, args.output_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
