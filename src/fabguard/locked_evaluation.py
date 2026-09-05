"""Fail-closed readiness gate for a future independent locked-model evaluation.

The gate verifies hashes and declared contracts only. It deliberately does not
deserialize a model or score data.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .data import sha256_file
from .independent_validation import IndependentDataSpec, inspect_external_csv


class LockedEvaluationContractError(ValueError):
    """Raised when an evaluation bundle is incomplete, ambiguous, or altered."""


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise LockedEvaluationContractError(f"cannot read {label}: {path}") from error
    if not isinstance(payload, dict):
        raise LockedEvaluationContractError(f"{label} must be a JSON object")
    return payload


def _require_sha(value: object, label: str) -> str:
    if not isinstance(value, str) or len(value) != 64:
        raise LockedEvaluationContractError(f"{label} must be a 64-character SHA-256")
    try:
        int(value, 16)
    except ValueError as error:
        raise LockedEvaluationContractError(f"{label} must be hexadecimal") from error
    return value.lower()


def _require_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise LockedEvaluationContractError(f"{label} must be non-empty text")
    return value.strip()


def _safe_artifact_path(bundle_dir: Path, declared: object) -> Path:
    relative = Path(_require_text(declared, "artifact.path"))
    if relative.is_absolute() or ".." in relative.parts:
        raise LockedEvaluationContractError("artifact.path must remain inside the bundle directory")
    candidate = (bundle_dir / relative).resolve()
    root = bundle_dir.resolve()
    if candidate == root or root not in candidate.parents or not candidate.is_file():
        raise LockedEvaluationContractError("artifact.path must identify a file inside the bundle directory")
    return candidate


def _parse_utc_timestamp(value: object, label: str) -> str:
    text = _require_text(value, label)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise LockedEvaluationContractError(f"{label} must be ISO-8601") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise LockedEvaluationContractError(f"{label} must include a timezone")
    return parsed.isoformat()


def verify_locked_evaluation_bundle(
    dataset_path: Path,
    validation_report_path: Path,
    model_manifest_path: Path,
    approval_path: Path,
) -> dict[str, Any]:
    """Verify immutable inputs required before separately implemented scoring."""

    validation = _read_json(validation_report_path, "validation report")
    model = _read_json(model_manifest_path, "model manifest")
    approval = _read_json(approval_path, "evaluation approval")

    if validation.get("status") != "independent_data_contract_validated":
        raise LockedEvaluationContractError("independent data validation status is not accepted")
    contract = validation.get("contract")
    if not isinstance(contract, dict):
        raise LockedEvaluationContractError("validation report lacks its input contract")
    try:
        recreated = inspect_external_csv(dataset_path, IndependentDataSpec(**contract))
    except (TypeError, ValueError, FileNotFoundError) as error:
        raise LockedEvaluationContractError("dataset does not reproduce the validation report") from error
    if recreated != validation:
        raise LockedEvaluationContractError("dataset and validation report do not match exactly")
    if validation.get("evaluation_mode") != "locked_model_candidate":
        raise LockedEvaluationContractError("dataset is schema_only and cannot enter locked evaluation")
    compatibility = validation.get("compatibility")
    feature_contract = validation.get("feature_contract")
    source = validation.get("source")
    if not isinstance(compatibility, dict) or compatibility.get("model_scoring_performed") is not False:
        raise LockedEvaluationContractError("validation report must precede all model scoring")
    if not isinstance(feature_contract, dict) or not isinstance(source, dict):
        raise LockedEvaluationContractError("validation report lacks source or feature contract")

    if model.get("schema_version") != "fabguard.locked-model.v1" or model.get("frozen") is not True:
        raise LockedEvaluationContractError("model manifest must declare frozen fabguard.locked-model.v1")
    _require_text(model.get("model_id"), "model_id")
    artifact = model.get("artifact")
    model_input = model.get("input_contract")
    training = model.get("training")
    if not all(isinstance(item, dict) for item in (artifact, model_input, training)):
        raise LockedEvaluationContractError("model manifest sections are incomplete")
    artifact_path = _safe_artifact_path(model_manifest_path.parent, artifact.get("path"))
    artifact_sha = _require_sha(artifact.get("sha256"), "artifact.sha256")
    if sha256_file(artifact_path) != artifact_sha:
        raise LockedEvaluationContractError("model artifact hash mismatch")
    if model_input.get("feature_count") != feature_contract.get("count"):
        raise LockedEvaluationContractError("model and dataset feature counts differ")
    feature_sha = _require_sha(feature_contract.get("ordered_names_sha256"), "feature contract hash")
    if _require_sha(model_input.get("feature_names_sha256"), "model feature hash") != feature_sha:
        raise LockedEvaluationContractError("model and dataset ordered feature names differ")
    if training.get("selection_complete") is not True:
        raise LockedEvaluationContractError("model selection must be complete before approval")
    _require_sha(training.get("data_sha256"), "training.data_sha256")
    _require_text(training.get("split_contract"), "training.split_contract")

    if approval.get("schema_version") != "fabguard.evaluation-approval.v1" or approval.get("approved") is not True:
        raise LockedEvaluationContractError("explicit fabguard.evaluation-approval.v1 approval is required")
    _require_text(approval.get("approved_by"), "approved_by")
    approved_at = _parse_utc_timestamp(approval.get("approved_at"), "approved_at")
    if approval.get("purpose") != "independent_confirmation":
        raise LockedEvaluationContractError("approval purpose must be independent_confirmation")
    if approval.get("external_dataset_not_used_for_training") is not True:
        raise LockedEvaluationContractError("training independence must be explicitly affirmed")
    if approval.get("no_tuning_after_approval") is not True:
        raise LockedEvaluationContractError("post-approval tuning must be prohibited")

    bindings = {
        "dataset_sha256": _require_sha(source.get("sha256"), "dataset SHA-256"),
        "validation_report_sha256": sha256_file(validation_report_path),
        "model_manifest_sha256": sha256_file(model_manifest_path),
        "model_artifact_sha256": artifact_sha,
        "feature_names_sha256": feature_sha,
    }
    for name, actual in bindings.items():
        if _require_sha(approval.get(name), f"approval.{name}") != actual:
            raise LockedEvaluationContractError(f"approval binding mismatch: {name}")

    return {
        "status": "ready_for_separate_locked_scoring",
        "model_id": model["model_id"],
        "approved_by": approval["approved_by"],
        "approved_at": approved_at,
        "bindings": bindings,
        "model_deserialized": False,
        "model_scoring_performed": False,
        "claim_boundary": (
            "Integrity and approval readiness only. No model performance, factory deployment, "
            "yield, cost, or causal process outcome is established."
        ),
    }


def write_readiness_report(report: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "evaluation_readiness.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
    )
    (output_dir / "EVALUATION_READINESS.md").write_text(
        "# Locked Evaluation Readiness\n\n"
        f"Status: **{report['status']}**  \n"
        f"Model: `{report['model_id']}`  \n"
        f"Approved by: {report['approved_by']} at {report['approved_at']}  \n"
        f"Model deserialized: {report['model_deserialized']}  \n"
        f"Model scoring performed: {report['model_scoring_performed']}\n\n"
        "## Claim boundary\n\n"
        f"{report['claim_boundary']}\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify a locked independent-evaluation bundle")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--validation-report", type=Path, required=True)
    parser.add_argument("--model-manifest", type=Path, required=True)
    parser.add_argument("--approval", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    report = verify_locked_evaluation_bundle(
        args.dataset, args.validation_report, args.model_manifest, args.approval
    )
    write_readiness_report(report, args.output_dir)
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
