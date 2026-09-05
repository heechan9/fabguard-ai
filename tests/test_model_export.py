import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import joblib
import pandas as pd

from fabguard.config import ExperimentConfig
from fabguard.data import sha256_file
from fabguard.independent_validation import feature_names_sha256
from fabguard.model_export import ModelExportContractError, export_locked_model


class LockedModelExportTest(unittest.TestCase):
    def fixture(self, root: Path) -> tuple[ExperimentConfig, Path, pd.DataFrame]:
        result_dir = root / "canonical"
        result_dir.mkdir()
        config = ExperimentConfig(
            data_dir=root / "raw",
            output_dir=result_dir,
            train_size=6,
            test_size=2,
            cv_splits=2,
            cv_repeats=1,
            rf_estimators=8,
            logistic_c_values=(0.01, 0.1, 1.0),
            rf_candidates=((8, 4, "sqrt"), (None, 8, "sqrt")),
        )
        frame = pd.DataFrame({
            "sample_id": [f"secom_{i:04d}" for i in range(8)],
            "feature_000": [0.0, 1.0, 0.5, 1.5, 0.2, 1.2, 0.7, 1.7],
            "feature_001": [2.0, 1.0, 2.5, 1.5, 2.2, 1.2, 2.7, 1.7],
            "timestamp": pd.date_range("2026-01-01", periods=8, freq="h"),
            "label": [0, 1, 0, 1, 0, 1, 0, 1],
        })
        frame.attrs["hashes"] = {"secom.data": "a" * 64, "secom.names": "b" * 64, "secom_labels.data": "c" * 64}
        train = frame.iloc[:6]
        train[["sample_id", "timestamp", "label"]].to_csv(result_dir / "train_split.csv", index=False)
        manifest = {
            "selected_candidate_from_train_cv": "random_forest_depth_none_leaf_8",
            "selection_metric": "mean train repeated-CV average precision",
            "config": json.loads(json.dumps(config.__dict__, default=str)),
            "raw_hashes": frame.attrs["hashes"],
        }
        (result_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return config, result_dir, frame

    def test_exports_train_only_bundle_matching_locked_evaluation_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config, results, frame = self.fixture(root)
            output = root / "bundle"
            with patch("fabguard.model_export.load_secom", return_value=frame), patch(
                "fabguard.model_export.time_holdout", return_value=(frame.iloc[:6].copy(), frame.iloc[6:].copy())
            ):
                manifest = export_locked_model(config, results, output)
            self.assertEqual(manifest["schema_version"], "fabguard.locked-model.v1")
            self.assertFalse(manifest["training"]["holdout_used_for_fit_or_selection"])
            self.assertEqual(manifest["input_contract"]["feature_names_sha256"], feature_names_sha256(["feature_000", "feature_001"]))
            self.assertEqual(sha256_file(output / "model.joblib"), manifest["artifact"]["sha256"])
            pipeline = joblib.load(output / "model.joblib")
            self.assertEqual(pipeline.named_steps["model"].n_features_in_, 2)

    def test_candidate_raw_hash_and_split_mismatches_fail_closed(self) -> None:
        for mutation in ("candidate", "raw", "split"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                config, results, frame = self.fixture(root)
                manifest_path = results / "manifest.json"
                manifest = json.loads(manifest_path.read_text())
                if mutation == "candidate":
                    manifest["selected_candidate_from_train_cv"] = "unknown"
                    manifest_path.write_text(json.dumps(manifest))
                elif mutation == "raw":
                    manifest["raw_hashes"]["secom.data"] = "0" * 64
                    manifest_path.write_text(json.dumps(manifest))
                else:
                    split = pd.read_csv(results / "train_split.csv")
                    split.loc[0, "sample_id"] = "changed"
                    split.to_csv(results / "train_split.csv", index=False)
                with patch("fabguard.model_export.load_secom", return_value=frame), patch(
                    "fabguard.model_export.time_holdout", return_value=(frame.iloc[:6].copy(), frame.iloc[6:].copy())
                ):
                    with self.assertRaises(ModelExportContractError):
                        export_locked_model(config, results, root / "bundle")

    def test_refuses_to_overwrite_an_existing_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config, results, frame = self.fixture(root)
            output = root / "bundle"
            output.mkdir()
            with patch("fabguard.model_export.load_secom", return_value=frame):
                with self.assertRaises(ModelExportContractError):
                    export_locked_model(config, results, output)


if __name__ == "__main__":
    unittest.main()
