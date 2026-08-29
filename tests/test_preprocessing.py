import unittest

import pandas as pd

from fabguard.preprocessing import TrainColumnFilter


class TrainColumnFilterTest(unittest.TestCase):
    def test_fit_rules_are_reused_without_test_refit(self) -> None:
        train = pd.DataFrame({
            "keep": [1.0, 2.0, 3.0, 4.0],
            "constant": [1.0, 1.0, 1.0, 1.0],
            "high_missing": [None, None, None, 9.0],
            "duplicate_keep": [1.0, 2.0, 3.0, 4.0],
        })
        test = pd.DataFrame({
            "keep": [10.0, 11.0],
            "constant": [2.0, 3.0],
            "high_missing": [1.0, 2.0],
            "duplicate_keep": [10.0, 999.0],
        })
        transformer = TrainColumnFilter(missing_threshold=0.50).fit(train)
        transformed = transformer.transform(test)

        self.assertEqual(transformer.selected_columns_, ["keep"])
        self.assertEqual(transformed.columns.tolist(), ["keep"])
        self.assertEqual(transformed["keep"].tolist(), [10.0, 11.0])


if __name__ == "__main__":
    unittest.main()

