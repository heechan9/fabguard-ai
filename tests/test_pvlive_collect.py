import unittest

import pandas as pd

from fabguard.integrations.pvlive_collect import collect_pvlive_range
from fabguard.integrations.pvlive_fetch import PVLiveFetchError


class PVLiveCollectTest(unittest.TestCase):
    def test_chunks_without_overlap_and_requires_complete_grid(self) -> None:
        calls = []

        def fetcher(**kwargs):
            calls.append((kwargs["start"], kwargs["end"]))
            idx = pd.date_range(kwargs["start"], kwargs["end"], freq="30min")
            frame = pd.DataFrame(
                {
                    "entity_type": "gsp",
                    "entity_id": 0,
                    "interval_end_utc": idx,
                    "generation_mw": 1.0,
                    "updated_at_utc": idx + pd.Timedelta(minutes=6),
                }
            )
            return frame, {"raw_response_sha256": f"hash-{len(calls)}"}

        frame, audit = collect_pvlive_range(
            start="2025-01-01T00:30:00Z",
            end="2025-01-10T00:00:00Z",
            fetcher=fetcher,
        )
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(frame), 432)
        self.assertEqual(audit["chunks"], 2)
        self.assertEqual(audit["analysis_clock"], "continuous UTC/GMT")
        self.assertEqual(calls[1][0], "2025-01-08T00:30:00Z")

    def test_gap_fails_closed(self) -> None:
        def fetcher(**kwargs):
            idx = pd.date_range(kwargs["start"], kwargs["end"], freq="30min")[1:]
            frame = pd.DataFrame(
                {
                    "entity_type": "gsp",
                    "entity_id": 0,
                    "interval_end_utc": idx,
                    "generation_mw": 1.0,
                    "updated_at_utc": idx + pd.Timedelta(minutes=6),
                }
            )
            return frame, {"raw_response_sha256": "hash"}

        with self.assertRaisesRegex(PVLiveFetchError, "every requested interval"):
            collect_pvlive_range(
                start="2025-01-01T00:30:00Z",
                end="2025-01-01T02:00:00Z",
                fetcher=fetcher,
            )


if __name__ == "__main__":
    unittest.main()
