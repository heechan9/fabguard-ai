import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

from fabguard.secom_comparison import (
    ComparisonFeatures, FAMILIES, MODES, TRAIN_SPLIT_SHA256, build_comparison_pipeline,
    expanding_day_folds, load_frozen_training, ranking_metrics, run, summarize,
)


class ComparisonFeaturesTest(unittest.TestCase):
    def setUp(self):
        self.fit = pd.DataFrame({
            "feature_000": [1., 2., np.nan, 4.],
            "feature_001": [1., 2., np.nan, 4.],
            "feature_002": [np.nan, np.nan, np.nan, 5.],
            "feature_003": [1., 1., 1., 1.],
            "feature_004": [1., 2., 3., 4.],
        })

    def test_filter_and_indicator_fit_only(self):
        transformer = ComparisonFeatures("current").fit(self.fit)
        validation = self.fit.copy()
        validation["feature_002"] = [1., 2., 3., 4.]
        validation.loc[0, "feature_004"] = np.nan
        before = transformer.imputer_.statistics_.copy()
        result = transformer.transform(validation)
        self.assertEqual(transformer.selected_columns_, ["feature_000", "feature_004"])
        self.assertEqual(result.shape, (4, 3))  # no new indicator for validation-only missingness
        np.testing.assert_array_equal(before, transformer.imputer_.statistics_)
        self.assertEqual(result[0, 1], 2.5)
        self.assertEqual(transformer.quality_.duplicate_columns_, ["feature_001"])

    def test_row_count_uses_all_raw_columns_and_retains_rows(self):
        transformer = ComparisonFeatures("current_plus_row_missing").fit(self.fit)
        result = transformer.transform(self.fit)
        np.testing.assert_array_equal(result[:, -1], [1, 1, 3, 0])
        self.assertEqual(len(result), len(self.fit))

    def test_modes_isolate_steps(self):
        sizes = [ComparisonFeatures(mode).fit_transform(self.fit).shape[1] for mode in MODES]
        self.assertEqual(sizes, [5, 2, 3, 4])

    def test_all_empty_impute_only_is_finite(self):
        frame = self.fit.assign(feature_005=np.nan)
        result = ComparisonFeatures("impute_only").fit_transform(frame)
        self.assertEqual(result.shape[1], 6)
        self.assertTrue(np.isfinite(result).all())
        np.testing.assert_array_equal(result[:, -1], 0)

    def test_rejects_label_extra_reordering_infinite_and_duplicate_columns(self):
        transformer = ComparisonFeatures().fit(self.fit)
        bad_inputs = [self.fit.assign(label=0), self.fit.iloc[:, ::-1],
                      self.fit.assign(feature_000=np.inf),
                      pd.concat([self.fit, self.fit.iloc[:, :1]], axis=1)]
        for frame in bad_inputs:
            with self.subTest(columns=frame.columns.tolist()), self.assertRaises(ValueError):
                transformer.transform(frame)

    def test_bad_mode(self):
        with self.assertRaises(ValueError):
            ComparisonFeatures("unknown").fit(self.fit)


class ComparisonProtocolTest(unittest.TestCase):
    @staticmethod
    def frame():
        return pd.DataFrame({"sample_id": [f"id_{i:03d}" for i in range(32)],
                             "timestamp": pd.date_range("2008-01-01", periods=16).repeat(2),
                             "label": [0, 1] * 16})

    def test_expanding_folds_keep_dates_disjoint_and_validation_once(self):
        frame = self.frame()
        folds = expanding_day_folds(frame)
        self.assertEqual([len(fit) for fit, _ in folds], [8, 16, 24])
        validation_seen = set()
        for fit, validation in folds:
            self.assertFalse(set(fit) & set(validation))
            self.assertFalse(validation_seen & set(validation))
            validation_seen.update(validation)
            self.assertLess(frame.iloc[fit].timestamp.max(), frame.iloc[validation].timestamp.min())
        self.assertEqual(validation_seen, set(range(8, 32)))

    def test_fold_contract_rejects_unsorted_missing_class_and_duplicate_ids(self):
        frame = self.frame()
        for bad in (frame.iloc[::-1], frame.assign(label=0), frame.assign(sample_id="same")):
            with self.assertRaises(ValueError):
                expanding_day_folds(bad)

    def test_top_budget_denominator_and_ties(self):
        ids = pd.Series(["b", "a", "c", "d", "e", "f", "g", "h", "i", "j", "k"])
        labels = np.array([1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0])
        metrics = ranking_metrics(ids, labels, np.ones(11))
        self.assertEqual(metrics["inspection_count"], 2)
        self.assertEqual(metrics["validation_fail"], 2)
        self.assertEqual(metrics["captured_fail"], 1)
        self.assertEqual(metrics["capture_rate"], .5)
        self.assertEqual(metrics["tie_capture_min"], 0)
        self.assertEqual(metrics["tie_capture_max"], 2)
        self.assertAlmostEqual(metrics["tie_capture_expected"], 4 / 11)
        self.assertAlmostEqual(metrics["average_precision"], 2 / 11)

    def test_top_metrics_reject_bad_values(self):
        for y, scores in (([0, 0], [0., 1.]), ([0, 1], [0., np.inf]), ([0, 1], [1.])):
            with self.assertRaises(ValueError):
                ranking_metrics(pd.Series(["a", "b"]), np.array(y), np.array(scores))

    def test_all_fixed_models_smoke(self):
        rng = np.random.default_rng(4)
        X = pd.DataFrame(rng.normal(size=(48, 5)), columns=[f"feature_{i:03d}" for i in range(5)])
        X.loc[::5, "feature_000"] = np.nan
        y = np.array([0, 1] * 24)
        from threadpoolctl import threadpool_limits
        with threadpool_limits(limits=1):
            for family in (*FAMILIES, "dummy"):
                for mode in MODES:
                    with self.subTest(family=family, mode=mode):
                        pipeline = build_comparison_pipeline(family, mode).fit(X, y)
                        self.assertTrue(np.isfinite(pipeline.predict_proba(X)).all())
        model = build_comparison_pipeline("hist_gradient_boosting", "current").named_steps["model"]
        self.assertFalse(model.early_stopping)

    def test_pinned_training_manifest(self):
        from fabguard.data import sha256_file
        path = Path(__file__).parents[1] / "results/v1/train_split.csv"
        self.assertEqual(sha256_file(path), TRAIN_SPLIT_SHA256)
        with tempfile.TemporaryDirectory() as directory:
            bad = Path(directory) / "train.csv"
            bad.write_text("changed")
            with self.assertRaisesRegex(ValueError, "manifest hash"):
                load_frozen_training(Path(directory), bad)

    def test_loader_never_parses_beyond_train_limit(self):
        root = Path(__file__).parents[1]
        manifest = pd.read_csv(root / "results/v1/train_split.csv", parse_dates=["timestamp"])
        features = pd.DataFrame(np.zeros((1175, 590)))
        labels = pd.DataFrame({"raw_label": manifest.label * 2 - 1,
                               "timestamp_text": manifest.timestamp.dt.strftime("%d/%m/%Y %H:%M:%S")})
        with patch("fabguard.secom_comparison.validate_raw_files", return_value={}), \
             patch("fabguard.secom_comparison.pd.read_csv", side_effect=[manifest, features, labels]) as read:
            frame = load_frozen_training(Path("unused"), root / "results/v1/train_split.csv")
        self.assertEqual(len(frame), 1175)
        self.assertEqual(len(read.call_args_list), 3)
        for call in read.call_args_list[1:]:
            self.assertEqual(call.kwargs["nrows"], 1175)

    def test_existing_output_refused_before_loading_data(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileExistsError):
                run(Path("unused"), Path("unused"), Path(directory))


class PersistedComparisonTest(unittest.TestCase):
    def test_saved_metrics_recompute_and_fold_membership(self):
        import json
        directory = Path(__file__).parents[1] / "experiments/secom-train-only-20261023/results"
        metrics = pd.read_csv(directory / "fold_metrics.csv")
        summary = pd.read_csv(directory / "summary.csv")
        pd.testing.assert_frame_equal(summarize(metrics), summary, check_exact=False, rtol=1e-12, atol=1e-12)
        self.assertEqual(len(metrics), 39)
        self.assertEqual(len(summary), 13)
        manifest = json.loads((directory / "manifest.json").read_text())
        self.assertEqual(manifest["training_rows"], 1175)
        self.assertEqual(manifest["test_rows_parsed_or_scored"], 0)
        self.assertFalse(manifest["final_model_fit"])
        self.assertEqual(manifest["candidate_selection"], "none")
        training = pd.read_csv(Path(__file__).parents[1] / "results/v1/train_split.csv", parse_dates=["timestamp"])
        for saved, (fit, validation) in zip(manifest["folds"], expanding_day_folds(training)):
            self.assertEqual(saved["fit_sample_ids"], training.iloc[fit].sample_id.tolist())
            self.assertEqual(saved["validation_sample_ids"], training.iloc[validation].sample_id.tolist())
        for row in metrics.itertuples():
            self.assertEqual(row.inspection_count, int(np.ceil(.10 * row.validation_rows)))
            self.assertAlmostEqual(row.capture_rate, row.captured_fail / row.validation_fail)
            self.assertLessEqual(row.tie_capture_min, row.captured_fail)
            self.assertLessEqual(row.captured_fail, row.tie_capture_max)


if __name__ == "__main__":
    unittest.main()
