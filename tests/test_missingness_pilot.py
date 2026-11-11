"""Regression checks for the train-only ablation's leakage boundaries."""
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from sklearn.dummy import DummyClassifier

import numpy as np
import pandas as pd

from fabguard.config import ExperimentConfig
from fabguard.missingness_pilot import RowMissingCount, pilot_pipeline, temporal_splits


class MissingnessPilotTests(unittest.TestCase):
    def test_time_ties_stay_together_and_validation_is_disjoint(self):
        frame = pd.DataFrame({"timestamp": pd.to_datetime(np.repeat(
            pd.date_range("2020-01-01", periods=100), 3))})
        seen = set()
        for fit, validation in temporal_splits(frame):
            self.assertLess(frame.iloc[fit].timestamp.max(), frame.iloc[validation].timestamp.min())
            self.assertFalse(seen.intersection(validation))
            seen.update(validation)
            self.assertEqual(len(validation) % 3, 0)
        self.assertEqual(seen, set(range(165, 300)))

    def test_missing_count_precedes_filter_and_uses_fitted_columns(self):
        fit = pd.DataFrame({"feature_000": [1., 2., 3., 4.],
                            "feature_001": [np.nan, np.nan, np.nan, 1.]})
        pipeline = pilot_pipeline("rf_row_missing_count", ExperimentConfig())
        transformed = pipeline[:-1].fit_transform(fit, [0, 1, 0, 1])
        names = pipeline.named_steps["quality"].selected_columns_
        self.assertNotIn("feature_001", names)
        self.assertIn("row_missing_count", names)
        np.testing.assert_array_equal(transformed[:, names.index("row_missing_count")], [1, 1, 1, 0])
        probe = fit.copy()
        probe["unrelated"] = np.nan
        pd.testing.assert_frame_equal(RowMissingCount().fit(fit).transform(probe),
                                      RowMissingCount().fit(fit).transform(fit))

    def test_runner_never_fits_or_predicts_on_official_test(self):
        from fabguard.missingness_pilot import run
        train = pd.DataFrame({
            "timestamp": pd.date_range("2020-01-01", periods=100),
            "sample_id": [f"train_{i:03d}" for i in range(100)],
            "feature_000": np.arange(100), "label": np.arange(100) % 2})
        frame = train.copy()
        frame.attrs["hashes"] = {}

        class TrainOnlyDummy(DummyClassifier):
            def fit(self, X, y):
                if X.feature_000.max() >= 100:
                    raise AssertionError("Official test reached fit")
                return super().fit(X, y)

            def predict_proba(self, X):
                if X.feature_000.max() >= 100:
                    raise AssertionError("Official test reached prediction")
                return super().predict_proba(X)

        test = pd.DataFrame({"feature_000": [999]})
        with tempfile.TemporaryDirectory() as directory, \
                patch("fabguard.missingness_pilot.load_secom", return_value=frame), \
                patch("fabguard.missingness_pilot.time_holdout", return_value=(train, test)), \
                patch("fabguard.missingness_pilot.pilot_pipeline", side_effect=lambda *a: TrainOnlyDummy()), \
                patch("builtins.print"):
            run(Path(directory), Path(directory))
            saved = pd.read_csv(Path(directory) / "splits.csv")
            self.assertTrue(saved.sample_id.str.startswith("train_").all())

    def test_baseline_and_ablation_preserve_model_settings(self):
        config = ExperimentConfig()
        baseline = pilot_pipeline("v1_rf", config)
        ablation = pilot_pipeline("rf_no_indicator", config)
        self.assertEqual(baseline.named_steps["model"].get_params(),
                         ablation.named_steps["model"].get_params())
        self.assertTrue(baseline.named_steps["imputer"].add_indicator)
        self.assertFalse(ablation.named_steps["imputer"].add_indicator)


if __name__ == "__main__":
    unittest.main()
