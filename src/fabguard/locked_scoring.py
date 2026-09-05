"""Score approved independent data with a frozen trusted FabGuard model."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn

from .advanced_evaluation import bootstrap_top_k_interval, calibration_metrics
from .data import sha256_file
from .evaluation import classification_metrics, top_k_table
from .independent_validation import IndependentDataSpec
from .locked_evaluation import verify_locked_evaluation_bundle


class LockedScoringContractError(ValueError):
    """Raised when scoring inputs or outputs violate the approved contract."""


def _sha_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _json_bytes(payload: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise LockedScoringContractError(f"cannot parse {label}") from error
    if not isinstance(value, dict):
        raise LockedScoringContractError(f"{label} must be a JSON object")
    return value


def _safe_artifact(bundle_dir: Path, declared: object) -> Path:
    if not isinstance(declared, str) or not declared.strip():
        raise LockedScoringContractError("artifact.path must be non-empty text")
    relative = Path(declared)
    if relative.is_absolute() or ".." in relative.parts:
        raise LockedScoringContractError("artifact.path must remain inside the model bundle")
    artifact = (bundle_dir / relative).resolve()
    root = bundle_dir.resolve()
    if root not in artifact.parents or not artifact.is_file():
        raise LockedScoringContractError("artifact.path must identify a bundle file")
    return artifact


def _load_bound_inputs(
    dataset_path: Path,
    validation_report_path: Path,
    model_manifest_path: Path,
    readiness: dict[str, Any],
) -> tuple[pd.DataFrame, dict[str, Any], dict[str, Any], bytes]:
    bindings = readiness["bindings"]
    try:
        dataset_bytes = dataset_path.read_bytes()
        validation_bytes = validation_report_path.read_bytes()
        manifest_bytes = model_manifest_path.read_bytes()
    except OSError as error:
        raise LockedScoringContractError("approved input became unreadable before scoring") from error
    checks = {
        "dataset_sha256": _sha_bytes(dataset_bytes),
        "validation_report_sha256": _sha_bytes(validation_bytes),
        "model_manifest_sha256": _sha_bytes(manifest_bytes),
    }
    for name, actual in checks.items():
        if bindings.get(name) != actual:
            raise LockedScoringContractError(f"approved input changed before scoring: {name}")

    validation = _json_bytes(validation_bytes, "validation report")
    manifest = _json_bytes(manifest_bytes, "model manifest")
    artifact_section = manifest.get("artifact")
    if not isinstance(artifact_section, dict):
        raise LockedScoringContractError("model manifest lacks artifact contract")
    if artifact_section.get("serialization") != "joblib-pickle-protocol-4":
        raise LockedScoringContractError("unsupported model serialization")
    if artifact_section.get("trusted_artifact_only") is not True:
        raise LockedScoringContractError("model artifact does not declare trusted-only loading")
    artifact_path = _safe_artifact(model_manifest_path.parent, artifact_section.get("path"))
    artifact_bytes = artifact_path.read_bytes()
    if _sha_bytes(artifact_bytes) != bindings.get("model_artifact_sha256"):
        raise LockedScoringContractError("approved model artifact changed before deserialization")

    contract = validation.get("contract")
    if not isinstance(contract, dict):
        raise LockedScoringContractError("validation report lacks dataset contract")
    try:
        spec = IndependentDataSpec(**contract)
        frame = pd.read_csv(io.BytesIO(dataset_bytes))
    except (TypeError, ValueError) as error:
        raise LockedScoringContractError("cannot reconstruct approved dataset contract") from error
    features = sorted(column for column in frame.columns if str(column).startswith(spec.feature_prefix))
    if len(features) != manifest["input_contract"]["feature_count"]:
        raise LockedScoringContractError("scoring feature count differs from model contract")
    return frame, validation, manifest, artifact_bytes


def run_locked_scoring(
    dataset_path: Path,
    validation_report_path: Path,
    model_manifest_path: Path,
    approval_path: Path,
    output_dir: Path,
    *,
    trust_model_artifact: bool = False,
    bootstrap_replicates: int = 2000,
    random_seed: int = 20260905,
) -> dict[str, Any]:
    """Run a single approved evaluation without fitting, tuning, or calibration."""

    if not trust_model_artifact:
        raise LockedScoringContractError(
            "trusted pickle deserialization requires explicit trust_model_artifact=True"
        )
    if output_dir.exists():
        raise LockedScoringContractError("output directory already exists; evaluation evidence is immutable")
    if bootstrap_replicates < 1:
        raise LockedScoringContractError("bootstrap_replicates must be positive")

    readiness = verify_locked_evaluation_bundle(
        dataset_path, validation_report_path, model_manifest_path, approval_path
    )
    frame, validation, model_manifest, artifact_bytes = _load_bound_inputs(
        dataset_path, validation_report_path, model_manifest_path, readiness
    )
    environment = model_manifest.get("environment")
    if not isinstance(environment, dict):
        raise LockedScoringContractError("model manifest lacks training environment")
    if environment.get("scikit_learn") != sklearn.__version__ or environment.get("joblib") != joblib.__version__:
        raise LockedScoringContractError(
            "scikit-learn and joblib versions must exactly match the locked export environment"
        )

    # The bytes checked above are exactly the bytes deserialized here. Approval is
    # a governance record, not a sandbox; callers must still trust the artifact source.
    try:
        model = joblib.load(io.BytesIO(artifact_bytes))
    except Exception as error:
        raise LockedScoringContractError("trusted model artifact could not be deserialized") from error
    if not callable(getattr(model, "predict_proba", None)):
        raise LockedScoringContractError("locked artifact does not provide predict_proba")

    spec = IndependentDataSpec(**validation["contract"])
    features = sorted(column for column in frame.columns if str(column).startswith(spec.feature_prefix))
    X = frame[features].apply(pd.to_numeric, errors="raise")
    labels = (frame[spec.label_column] == spec.positive_label).astype(int).to_numpy()
    try:
        classes = list(model.classes_)
        positive_index = classes.index(1)
        probability = np.asarray(model.predict_proba(X)[:, positive_index], dtype=float)
    except (AttributeError, IndexError, ValueError, TypeError) as error:
        raise LockedScoringContractError("locked model probability interface is incompatible") from error
    if probability.shape != (len(frame),) or not np.isfinite(probability).all():
        raise LockedScoringContractError("model returned invalid probability shape or non-finite values")
    if ((probability < 0) | (probability > 1)).any():
        raise LockedScoringContractError("model returned values outside probability bounds")

    threshold = 0.5
    fractions = (0.05, 0.10, 0.20)
    metrics = classification_metrics(labels, probability, threshold=threshold)
    calibration = calibration_metrics(labels, probability)
    top_k = top_k_table(frame[spec.id_column], labels, probability, fractions)
    bootstrap = bootstrap_top_k_interval(
        frame[spec.id_column].astype(str).tolist(), labels.tolist(), probability.tolist(), fractions,
        n_bootstrap=bootstrap_replicates, random_seed=random_seed,
    )
    predictions = pd.DataFrame({
        "sample_id": frame[spec.id_column].astype(str),
        "timestamp": frame[spec.timestamp_column].astype(str),
        "label": labels,
        "risk_score": probability,
        "prediction_at_0_5": (probability >= threshold).astype(int),
    }).sort_values(["risk_score", "sample_id"], ascending=[False, True], kind="stable")
    predictions.insert(0, "rank", np.arange(1, len(predictions) + 1))

    report = {
        "schema_version": "fabguard.locked-evaluation-result.v1",
        "status": "independent_locked_evaluation_completed",
        "model_id": model_manifest["model_id"],
        "samples": int(len(frame)),
        "fail": int(labels.sum()),
        "metrics": metrics,
        "calibration": calibration,
        "bootstrap": {
            "replicates": bootstrap_replicates,
            "random_seed": random_seed,
            "confidence": 0.95,
        },
        "bindings": readiness["bindings"],
        "approval_identity_authenticated": readiness["approval_identity_authenticated"],
        "model_fitted_or_tuned": False,
        "canonical_results_modified": False,
        "claim_boundary": (
            "Independent performance on the bound dataset only. This does not establish factory "
            "deployment, yield, cost, uptime, or causal process impact."
        ),
    }

    parent = output_dir.parent.resolve()
    parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}-", dir=parent))
    try:
        (temporary / "evaluation_result.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
        )
        predictions.to_csv(temporary / "predictions.csv", index=False)
        top_k.to_csv(temporary / "top_k.csv", index=False)
        bootstrap.to_csv(temporary / "top_k_bootstrap.csv", index=False)
        (temporary / "EVALUATION_SUMMARY.md").write_text(
            "# Independent Locked Evaluation\n\n"
            f"Status: **{report['status']}**  \n"
            f"Model: `{report['model_id']}`  \n"
            f"Samples / Fail: {report['samples']} / {report['fail']}  \n"
            f"Average precision: {metrics['pr_auc_average_precision']:.6f}  \n"
            f"Brier score: {calibration['brier_score']:.6f}\n\n"
            "## Claim boundary\n\n"
            f"{report['claim_boundary']}\n",
            encoding="utf-8",
        )
        os.replace(temporary, output_dir.resolve())
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run one approved locked independent evaluation")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--validation-report", type=Path, required=True)
    parser.add_argument("--model-manifest", type=Path, required=True)
    parser.add_argument("--approval", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--bootstrap", type=int, default=2000)
    parser.add_argument(
        "--trust-model-artifact", action="store_true",
        help="Acknowledge that the hash-bound joblib/pickle source is trusted",
    )
    args = parser.parse_args()
    result = run_locked_scoring(
        args.dataset, args.validation_report, args.model_manifest, args.approval, args.output_dir,
        trust_model_artifact=args.trust_model_artifact, bootstrap_replicates=args.bootstrap,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
