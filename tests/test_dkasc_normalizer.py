import unittest

import numpy as np
import pandas as pd

from fabguard.integrations.dkasc_normalizer import (
    DKASCNormalizationError,
    normalize_dkasc_frame,
)


class DKASCNormalizerTest(unittest.TestCase):
    def test_recovers_small_clock_skew_and_null_collision(self) -> None:
        frame = pd.DataFrame(
            {
                "timestamp": [
                    "2025-01-01 00:00:00",
                    "2025-01-01 00:00:01",
                    "2025-01-01 00:05:02",
                ],
                "power": [np.nan, 2.0, -0.5],
            }
        )

        result, audit = normalize_dkasc_frame(
            frame,
            start="2025-01-01",
            end="2025-01-01 00:15:00",
            power_column="power",
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result.loc[0, "power_raw"], 2.0)
        self.assertEqual(result.loc[1, "power_raw"], -0.5)
        self.assertEqual(result.loc[1, "power_sdt"], 0.0)
        self.assertTrue(result.loc[0, "timestamp_adjusted"])
        self.assertTrue(result.loc[2, "timestamp_missing_from_source"])
        self.assertTrue(pd.isna(result.loc[2, "power_sdt"]))
        self.assertEqual(audit["collision_groups"], 1)
        self.assertEqual(audit["valid_value_preferred_over_same_slot_null"], 1)
        self.assertEqual(audit["missing_timestamp_slots"], 1)
        self.assertEqual(audit["negative_values_clipped_for_sdt"], 1)

    def test_distinct_finite_collision_fails_closed(self) -> None:
        frame = pd.DataFrame(
            {
                "timestamp": [
                    "2025-01-01 00:00:00",
                    "2025-01-01 00:00:01",
                ],
                "power": [1.0, 2.0],
            }
        )

        with self.assertRaisesRegex(
            DKASCNormalizationError, "distinct finite power"
        ):
            normalize_dkasc_frame(
                frame,
                start="2025-01-01",
                end="2025-01-01 00:05:00",
                power_column="power",
            )

    def test_excessive_clock_skew_and_invalid_power_fail_closed(self) -> None:
        skewed = pd.DataFrame(
            {"timestamp": ["2025-01-01 00:01:00"], "power": [1.0]}
        )
        with self.assertRaisesRegex(DKASCNormalizationError, "clock-skew"):
            normalize_dkasc_frame(
                skewed,
                start="2025-01-01",
                end="2025-01-01 00:05:00",
                power_column="power",
                max_clock_skew_seconds=30,
            )

        invalid = pd.DataFrame(
            {"timestamp": ["2025-01-01 00:00:00"], "power": ["bad"]}
        )
        with self.assertRaisesRegex(DKASCNormalizationError, "non-numeric"):
            normalize_dkasc_frame(
                invalid,
                start="2025-01-01",
                end="2025-01-01 00:05:00",
                power_column="power",
            )


if __name__ == "__main__":
    unittest.main()
