import unittest

from fabguard.evaluation import classification_metrics, top_k_table


class EvaluationTest(unittest.TestCase):
    def test_classification_metrics(self) -> None:
        metrics = classification_metrics([0, 0, 1, 1], [0.1, 0.8, 0.7, 0.9])
        self.assertEqual(metrics["tp"], 2)
        self.assertEqual(metrics["fp"], 1)
        self.assertEqual(metrics["fail_recall"], 1.0)

    def test_top_k_uses_ceil_and_sample_id_tie_break(self) -> None:
        result = top_k_table(
            ["b", "a", "c", "d"],
            [0, 1, 0, 1],
            [0.9, 0.9, 0.8, 0.1],
            [0.25, 0.50],
        )
        self.assertEqual(result.loc[0, "inspection_count"], 1)
        self.assertEqual(result.loc[0, "captured_fail"], 1)
        self.assertEqual(result.loc[1, "captured_fail"], 1)


if __name__ == "__main__":
    unittest.main()

