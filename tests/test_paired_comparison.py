import unittest

import pandas as pd

from fabguard.paired_comparison import exact_sign_flip_pvalue, paired_repeat_comparison


class PairedComparisonTest(unittest.TestCase):
    def test_exact_sign_flip_has_honest_small_sample_floor(self):
        self.assertEqual(exact_sign_flip_pvalue([1, 1, 1, 1, 1]), 0.0625)

    def test_aggregates_shared_folds_before_testing(self):
        rows = []
        for repeat in range(5):
            for split in range(5):
                rows.extend([
                    {
                        "candidate": "log",
                        "family": "logistic",
                        "repeat": repeat,
                        "split": split,
                        "pr_auc_average_precision": 0.10 + repeat / 100,
                    },
                    {
                        "candidate": "rf",
                        "family": "random_forest",
                        "repeat": repeat,
                        "split": split,
                        "pr_auc_average_precision": 0.20 + repeat / 100,
                    },
                ])
        result = paired_repeat_comparison(pd.DataFrame(rows)).iloc[0]
        self.assertEqual(result["paired_repeats"], 5)
        self.assertEqual(result["pairing_unit"], "repeat_mean_of_shared_5_folds")
        self.assertAlmostEqual(result["mean_difference"], 0.1)
        self.assertEqual(result["two_sided_exact_sign_flip_p"], 0.0625)

    def test_rejects_incomplete_pairing(self):
        frame = pd.DataFrame([
            {
                "candidate": "log",
                "family": "logistic",
                "repeat": 0,
                "split": 0,
                "pr_auc_average_precision": 0.1,
            },
            {
                "candidate": "rf",
                "family": "random_forest",
                "repeat": 0,
                "split": 0,
                "pr_auc_average_precision": 0.2,
            },
            {
                "candidate": "rf",
                "family": "random_forest",
                "repeat": 0,
                "split": 1,
                "pr_auc_average_precision": 0.3,
            },
        ])
        with self.assertRaises(ValueError):
            paired_repeat_comparison(frame)


if __name__ == "__main__":
    unittest.main()
