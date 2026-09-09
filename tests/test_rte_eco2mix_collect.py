import json
import unittest
from urllib.parse import parse_qs, urlparse

import pandas as pd

from fabguard.integrations.rte_eco2mix_collect import (
    RTEEco2MixCollectError,
    collect_rte_range,
    fetch_rte_day,
)


class RTEEco2MixCollectTest(unittest.TestCase):
    @staticmethod
    def payload(start="2024-06-01T00:00:00Z"):
        idx = pd.date_range(start, periods=96, freq="15min")
        rows = [
            {
                "date_heure": timestamp.isoformat(),
                "solaire": float(i) if timestamp.minute in (0, 30) else None,
                "nature": "Données définitives",
            }
            for i, timestamp in enumerate(idx)
        ]
        return {"total_count": 96, "results": rows}

    def test_fetches_one_complete_day_and_filters_structural_slots(self):
        seen = []

        def opener(url):
            seen.append(url)
            return json.dumps(self.payload()).encode()

        frame, audit = fetch_rte_day(
            start="2024-06-01T00:00:00Z",
            end="2024-06-02T00:00:00Z",
            opener=opener,
        )
        self.assertEqual(len(frame), 48)
        self.assertEqual(audit["structural_null_rows"], 48)
        self.assertEqual(audit["api_total_count"], 96)
        query = parse_qs(urlparse(seen[0]).query)
        self.assertEqual(query["limit"], ["100"])
        self.assertEqual(query["offset"], ["0"])

    def test_truncated_daily_response_fails_closed(self):
        payload = self.payload()
        payload["results"].pop()
        with self.assertRaisesRegex(RTEEco2MixCollectError, "truncated"):
            fetch_rte_day(
                start="2024-06-01T00:00:00Z",
                end="2024-06-02T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_daily_count_other_than_96_fails_closed(self):
        payload = self.payload()
        payload["results"] = payload["results"][:95]
        payload["total_count"] = 95
        with self.assertRaisesRegex(RTEEco2MixCollectError, "96"):
            fetch_rte_day(
                start="2024-06-01T00:00:00Z",
                end="2024-06-02T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_collects_daily_chunks_without_overlap(self):
        calls = []

        def fetcher(**kwargs):
            calls.append((kwargs["start"], kwargs["end"]))
            idx = pd.date_range(kwargs["start"], kwargs["end"], freq="30min", inclusive="left")
            frame = pd.DataFrame(
                {
                    "timestamp_utc": idx,
                    "solar_generation_mw": 1.0,
                    "revision_status": "definitive",
                    "source_timestamp": idx.astype(str),
                }
            )
            return frame, {
                "input_rows": 96,
                "structural_null_rows": 48,
                "raw_response_sha256": f"hash-{len(calls)}",
            }

        frame, audit = collect_rte_range(
            start="2024-06-01T00:00:00Z",
            end="2024-06-04T00:00:00Z",
            fetcher=fetcher,
        )
        self.assertEqual(len(calls), 3)
        self.assertEqual(len(frame), 144)
        self.assertEqual(audit["raw_rows"], 288)
        self.assertEqual(audit["structural_null_rows"], 144)
        self.assertEqual(calls[1][0], "2024-06-02T00:00:00Z")

    def test_gap_or_duplicate_fails_closed(self):
        def gap_fetcher(**kwargs):
            idx = pd.date_range(kwargs["start"], kwargs["end"], freq="30min", inclusive="left")[1:]
            frame = pd.DataFrame(
                {
                    "timestamp_utc": idx,
                    "solar_generation_mw": 1.0,
                    "revision_status": "definitive",
                    "source_timestamp": idx.astype(str),
                }
            )
            return frame, {
                "input_rows": 96,
                "structural_null_rows": 48,
                "raw_response_sha256": "hash",
            }

        with self.assertRaisesRegex(RTEEco2MixCollectError, "every half-hour"):
            collect_rte_range(
                start="2024-06-01T00:00:00Z",
                end="2024-06-02T00:00:00Z",
                fetcher=gap_fetcher,
            )

    def test_range_boundaries_fail_closed(self):
        with self.assertRaisesRegex(RTEEco2MixCollectError, "UTC midnight"):
            collect_rte_range(
                start="2024-06-01T00:30:00Z", end="2024-06-02T00:00:00Z"
            )
        with self.assertRaisesRegex(RTEEco2MixCollectError, "limited"):
            collect_rte_range(
                start="2023-01-01T00:00:00Z", end="2024-01-03T00:00:00Z"
            )


if __name__ == "__main__":
    unittest.main()
