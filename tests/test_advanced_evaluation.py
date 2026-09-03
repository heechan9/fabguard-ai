import unittest

import numpy as np
import pandas as pd

from fabguard.advanced_evaluation import (bootstrap_top_k_interval, calibration_metrics, drift_table,
                                          inspection_cost_table, population_stability_index,
                                          walk_forward_slices)


class AdvancedEvaluationTest(unittest.TestCase):
    def test_cost_table_exposes_tradeoff(self) -> None:
        result = inspection_cost_table(["a", "b", "c", "d"], [1, 0, 1, 0], [0.9, 0.8, 0.7, 0.1],
                                       [0.25, 0.5], inspection_cost=1, missed_fail_cost=10)
        self.assertEqual(result.loc[0, "scenario_total_cost"], 11)
        self.assertEqual(result.loc[0, "no_review_cost"], 20)

    def test_bootstrap_is_reproducible_and_bounded(self) -> None:
        args = (["a", "b", "c", "d"], [1, 0, 1, 0], [0.9, 0.8, 0.7, 0.1], [0.5])
        first = bootstrap_top_k_interval(*args, n_bootstrap=50, random_seed=7)
        second = bootstrap_top_k_interval(*args, n_bootstrap=50, random_seed=7)
        pd.testing.assert_frame_equal(first, second)
        self.assertTrue(first.filter(like="fail_capture").to_numpy().min() >= 0)
        self.assertTrue(first.filter(like="fail_capture").to_numpy().max() <= 1)

    def test_perfect_calibration_has_zero_error(self) -> None:
        result = calibration_metrics([0, 0, 1, 1], [0, 0, 1, 1])
        self.assertEqual(result["brier_score"], 0)
        self.assertEqual(result["expected_calibration_error"], 0)

    def test_psi_detects_shift_and_missing_change(self) -> None:
        self.assertAlmostEqual(population_stability_index([0, 1, 2, 3], [0, 1, 2, 3]), 0)
        shifted = population_stability_index([0, 1, 2, 3], [10, 11, 12, np.nan])
        self.assertGreater(shifted, 0)
        table = drift_table(pd.DataFrame({"x": [0, 1, np.nan]}), pd.DataFrame({"x": [2, np.nan, np.nan]}), ["x"])
        self.assertGreater(table.loc[0, "missing_rate_change"], 0)

    def test_walk_forward_uses_only_earlier_rows(self) -> None:
        timestamps = pd.date_range("2026-01-01", periods=20, freq="D")
        for train, validation in walk_forward_slices(timestamps, folds=3):
            self.assertLess(train.max(), validation.min())
            self.assertFalse(set(train) & set(validation))


if __name__ == "__main__":
    unittest.main()
