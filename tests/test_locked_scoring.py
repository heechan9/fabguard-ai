import json
import tempfile
import unittest
from pathlib import Path

import joblib
import numpy as np
import sklearn

from fabguard.data import sha256_file
from fabguard.independent_validation import IndependentDataSpec, write_validation_report
from fabguard.locked_scoring import LockedScoringContractError, run_locked_scoring


class GuardedProbabilityModel:
    """Fixture model whose fit method must never be called by the scorer."""

    classes_ = np.array([0, 1])

    def fit(self, *_args, **_kwargs):
        raise AssertionError("locked scoring attempted to fit")

    def predict_proba(self, frame):
        probability = np.clip(frame["feature_000"].to_numpy(dtype=float), 0, 1)
        return np.column_stack([1 - probability, probability])


CSV = """sample_id,timestamp,label,feature_000,feature_001
x0,2026-01-01T00:00:00Z,0,0.05,2.0
x1,2026-01-01T00:01:00Z,0,0.10,2.1
x2,2026-01-01T00:02:00Z,0,0.20,2.2
x3,2026-01-01T00:03:00Z,0,0.30,2.3
x4,2026-01-01T00:04:00Z,0,0.40,2.4
x5,2026-01-01T00:05:00Z,1,0.60,2.5
x6,2026-01-01T00:06:00Z,0,0.70,2.6
x7,2026-01-01T00:07:00Z,1,0.80,2.7
x8,2026-01-01T00:08:00Z,0,0.90,2.8
x9,2026-01-01T00:09:00Z,1,0.95,2.9
"""


class LockedScoringTest(unittest.TestCase):
    def make_bundle(self, root: Path) -> tuple[Path, Path, Path, Path]:
        dataset = root / "external.csv"
        dataset.write_text(CSV, encoding="utf-8")
        validation_dir = root / "validation"
        report = write_validation_report(
            dataset, validation_dir, IndependentDataSpec(expected_feature_count=2)
        )
        validation = validation_dir / "validation_report.json"

        bundle = root / "bundle"
        bundle.mkdir()
        artifact = bundle / "model.joblib"
        joblib.dump(GuardedProbabilityModel(), artifact, compress=0, protocol=4)
        manifest_payload = {
            "schema_version": "fabguard.locked-model.v1",
            "model_id": "locked-scoring-fixture",
            "frozen": True,
            "artifact": {
                "path": artifact.name,
                "sha256": sha256_file(artifact),
                "serialization": "joblib-pickle-protocol-4",
                "trusted_artifact_only": True,
            },
            "input_contract": {
                "feature_count": 2,
                "feature_names_sha256": report["feature_contract"]["ordered_names_sha256"],
            },
            "training": {
                "data_sha256": "a" * 64,
                "split_contract": "synthetic Train-only fixture",
                "selection_complete": True,
            },
            "environment": {
                "scikit_learn": sklearn.__version__,
                "joblib": joblib.__version__,
            },
        }
        manifest = bundle / "model_manifest.json"
        manifest.write_text(json.dumps(manifest_payload), encoding="utf-8")
        approval_payload = {
            "schema_version": "fabguard.evaluation-approval.v1",
            "approved": True,
            "approved_by": "independent-test-reviewer",
            "approved_at": "2026-09-05T00:00:00Z",
            "purpose": "independent_confirmation",
            "external_dataset_not_used_for_training": True,
            "no_tuning_after_approval": True,
            "dataset_sha256": report["source"]["sha256"],
            "validation_report_sha256": sha256_file(validation),
            "model_manifest_sha256": sha256_file(manifest),
            "model_artifact_sha256": sha256_file(artifact),
            "feature_names_sha256": report["feature_contract"]["ordered_names_sha256"],
        }
        approval = root / "approval.json"
        approval.write_text(json.dumps(approval_payload), encoding="utf-8")
        return dataset, validation, manifest, approval

    def test_runs_once_without_fitting_and_writes_complete_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "evaluation"
            report = run_locked_scoring(
                *self.make_bundle(root), output,
                trust_model_artifact=True, bootstrap_replicates=50, random_seed=7,
            )
            self.assertEqual(report["status"], "independent_locked_evaluation_completed")
            self.assertFalse(report["model_fitted_or_tuned"])
            self.assertEqual(report["samples"], 10)
            self.assertEqual(report["fail"], 3)
            self.assertEqual(
                {path.name for path in output.iterdir()},
                {"evaluation_result.json", "predictions.csv", "top_k.csv", "top_k_bootstrap.csv", "EVALUATION_SUMMARY.md"},
            )
            predictions = (output / "predictions.csv").read_text(encoding="utf-8")
            self.assertIn("x9", predictions)

    def test_requires_explicit_pickle_trust_before_loading(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(LockedScoringContractError, "explicit"):
                run_locked_scoring(*self.make_bundle(root), root / "evaluation")

    def test_tampering_version_mismatch_and_existing_output_fail_closed(self) -> None:
        for mutation in ("artifact", "version", "output"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                paths = self.make_bundle(root)
                if mutation == "artifact":
                    (paths[2].parent / "model.joblib").write_bytes(b"changed")
                elif mutation == "version":
                    payload = json.loads(paths[2].read_text(encoding="utf-8"))
                    payload["environment"]["scikit_learn"] = "0.0"
                    paths[2].write_text(json.dumps(payload), encoding="utf-8")
                    approval = json.loads(paths[3].read_text(encoding="utf-8"))
                    approval["model_manifest_sha256"] = sha256_file(paths[2])
                    paths[3].write_text(json.dumps(approval), encoding="utf-8")
                else:
                    (root / "evaluation").mkdir()
                with self.assertRaises((LockedScoringContractError, ValueError)):
                    run_locked_scoring(
                        *paths, root / "evaluation",
                        trust_model_artifact=True, bootstrap_replicates=10,
                    )


if __name__ == "__main__":
    unittest.main()
