import unittest

import numpy as np
import pandas as pd

from fabguard.integrations.pvlive_contract import (
    PVLiveContractError,
    latest_pvlive_snapshot,
    normalize_pvlive_frame,
)


class PVLiveContractTest(unittest.TestCase):
    def base_frame(self) -> pd.DataFrame:
        return pd.DataFrame(
            {
                "gsp_id": [0, 0, 0],
                "datetime_gmt": [
                    "2025-03-30T00:30:00Z",
                    "2025-03-30T00:30:00Z",
                    "2025-10-26T01:00:00Z",
                ],
                "generation_mw": [100.0, 101.5, 80.0],
                "updated_gmt": [
                    "2025-03-30T00:36:00Z",
                    "2025-03-31T10:31:00Z",
                    "2025-10-26T01:06:00Z",
                ],
            }
        )

    def test_preserves_revisions_and_selects_latest(self) -> None:
        normalized, audit = normalize_pvlive_frame(
            self.base_frame(), entity_type="gsp", entity_id=0
        )
        self.assertEqual(audit["source_type"], "estimated")
        self.assertEqual(audit["geographic_scope"], "GB electricity network")
        self.assertEqual(audit["revised_intervals"], 1)
        self.assertEqual(audit["revision_rows_beyond_first"], 1)
        latest = latest_pvlive_snapshot(normalized)
        self.assertEqual(len(latest), 2)
        self.assertEqual(latest.loc[0, "generation_mw"], 101.5)
        self.assertEqual(str(latest.loc[0, "interval_end_utc"].tz), "UTC")

    def test_wrong_entity_or_period_fails_closed(self) -> None:
        with self.assertRaisesRegex(PVLiveContractError, "unexpected entity"):
            normalize_pvlive_frame(self.base_frame(), entity_type="gsp", entity_id=1)
        with self.assertRaisesRegex(PVLiveContractError, "only 30-minute"):
            normalize_pvlive_frame(
                self.base_frame(), entity_type="gsp", entity_id=0, period_minutes=5
            )

    def test_missing_revision_field_fails_closed(self) -> None:
        with self.assertRaisesRegex(PVLiveContractError, "updated_gmt"):
            normalize_pvlive_frame(
                self.base_frame().drop(columns="updated_gmt"),
                entity_type="gsp", entity_id=0,
            )

    def test_bad_generation_and_alignment_fail_closed(self) -> None:
        bad = self.base_frame().iloc[[0]].copy()
        bad.loc[bad.index[0], "generation_mw"] = np.inf
        with self.assertRaisesRegex(PVLiveContractError, "infinite"):
            normalize_pvlive_frame(bad, entity_type="gsp", entity_id=0)

        bad = self.base_frame().iloc[[0]].copy()
        bad.loc[bad.index[0], "datetime_gmt"] = "2025-03-30T00:35:00Z"
        with self.assertRaisesRegex(PVLiveContractError, "30-minute UTC"):
            normalize_pvlive_frame(bad, entity_type="gsp", entity_id=0)

    def test_duplicate_revision_identity_fails_closed(self) -> None:
        row = self.base_frame().iloc[[0]]
        duplicate = pd.concat([row, row], ignore_index=True)
        with self.assertRaisesRegex(PVLiveContractError, "duplicate revision"):
            normalize_pvlive_frame(duplicate, entity_type="gsp", entity_id=0)


if __name__ == "__main__":
    unittest.main()
