import json
import tempfile
import unittest
from pathlib import Path

from fabguard.data import sha256_file
from fabguard.independent_validation import IndependentDataSpec, write_validation_report
from fabguard.locked_evaluation import (
    LockedEvaluationContractError,
    verify_locked_evaluation_bundle,
    write_readiness_report,
)


CSV = """sample_id,timestamp,label,feature_000,feature_001
x1,2026-01-01T00:00:00Z,0,1.0,2.0
x2,2026-01-01T00:01:00Z,1,1.5,2.5
"""


class LockedEvaluationTest(unittest.TestCase):
    def make_bundle(self, root: Path, expected_features: int = 2) -> tuple[Path, Path, Path, Path]:
        source = root / "external.csv"
        validation_dir = root / "validation"
        bundle_dir = root / "bundle"
        bundle_dir.mkdir()
        source.write_text(CSV, encoding="utf-8")
        validation = write_validation_report(
            source, validation_dir, IndependentDataSpec(expected_feature_count=expected_features)
        )
        validation_path = validation_dir / "validation_report.json"

        artifact = bundle_dir / "locked-model.bin"
        artifact.write_bytes(b"synthetic-test-artifact-not-an-executable-model")
        model_manifest = {
            "schema_version": "fabguard.locked-model.v1",
            "model_id": "synthetic-contract-fixture",
            "frozen": True,
            "artifact": {"path": artifact.name, "sha256": sha256_file(artifact)},
            "input_contract": {
                "feature_count": validation["feature_contract"]["count"],
                "feature_names_sha256": validation["feature_contract"]["ordered_names_sha256"],
            },
            "training": {
                "data_sha256": "a" * 64,
                "split_contract": "synthetic-test-only",
                "selection_complete": True,
            },
        }
        manifest_path = bundle_dir / "model_manifest.json"
        manifest_path.write_text(json.dumps(model_manifest), encoding="utf-8")
        approval = {
            "schema_version": "fabguard.evaluation-approval.v1",
            "approved": True,
            "approved_by": "test-reviewer",
            "approved_at": "2026-09-05T00:00:00Z",
            "purpose": "independent_confirmation",
            "external_dataset_not_used_for_training": True,
            "no_tuning_after_approval": True,
            "dataset_sha256": validation["source"]["sha256"],
            "validation_report_sha256": sha256_file(validation_path),
            "model_manifest_sha256": sha256_file(manifest_path),
            "model_artifact_sha256": sha256_file(artifact),
            "feature_names_sha256": validation["feature_contract"]["ordered_names_sha256"],
        }
        approval_path = root / "approval.json"
        approval_path.write_text(json.dumps(approval), encoding="utf-8")
        return source, validation_path, manifest_path, approval_path

    def test_verified_bundle_is_ready_without_loading_or_scoring(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = verify_locked_evaluation_bundle(*self.make_bundle(root))
            self.assertEqual(report["status"], "ready_for_separate_locked_scoring")
            self.assertFalse(report["model_deserialized"])
            self.assertFalse(report["model_scoring_performed"])
            output = root / "readiness"
            write_readiness_report(report, output)
            self.assertTrue((output / "evaluation_readiness.json").is_file())
            self.assertTrue((output / "EVALUATION_READINESS.md").is_file())

    def test_schema_only_dataset_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            paths = self.make_bundle(Path(directory), expected_features=590)
            with self.assertRaises(LockedEvaluationContractError):
                verify_locked_evaluation_bundle(*paths)

    def test_artifact_and_manifest_tampering_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset, validation, manifest, approval = self.make_bundle(root)
            (manifest.parent / "locked-model.bin").write_bytes(b"tampered")
            with self.assertRaises(LockedEvaluationContractError):
                verify_locked_evaluation_bundle(dataset, validation, manifest, approval)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset, validation, manifest, approval = self.make_bundle(root)
            payload = json.loads(manifest.read_text(encoding="utf-8"))
            payload["model_id"] = "changed-after-approval"
            manifest.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(LockedEvaluationContractError):
                verify_locked_evaluation_bundle(dataset, validation, manifest, approval)

    def test_approval_mismatch_and_unsafe_artifact_path_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset, validation, manifest, approval = self.make_bundle(root)
            payload = json.loads(approval.read_text(encoding="utf-8"))
            payload["dataset_sha256"] = "0" * 64
            approval.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(LockedEvaluationContractError):
                verify_locked_evaluation_bundle(dataset, validation, manifest, approval)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset, validation, manifest, approval = self.make_bundle(root)
            payload = json.loads(manifest.read_text(encoding="utf-8"))
            payload["artifact"]["path"] = "../external.csv"
            manifest.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(LockedEvaluationContractError):
                verify_locked_evaluation_bundle(dataset, validation, manifest, approval)

    def test_dataset_tampering_cannot_reuse_an_approved_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset, validation, manifest, approval = self.make_bundle(root)
            dataset.write_text(CSV.replace("1.5,2.5", "9.5,2.5"), encoding="utf-8")
            with self.assertRaises(LockedEvaluationContractError):
                verify_locked_evaluation_bundle(dataset, validation, manifest, approval)


if __name__ == "__main__":
    unittest.main()
