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
        self.assertFalse(audit["dst_transition_day"])
        self.assertEqual(audit["deduplicated_raw_rows"], 0)
        query = parse_qs(urlparse(seen[0]).query)
        self.assertEqual(query["limit"], ["100"])
        self.assertEqual(query["offset"], ["0"])

    def test_published_policy_preserves_mixed_revision_lineage(self):
        payload = self.payload("2024-12-31T00:00:00Z")
        for row in payload["results"][-4:]:
            row["nature"] = "Données consolidées"

        frame, audit = fetch_rte_day(
            start="2024-12-31T00:00:00Z",
            end="2025-01-01T00:00:00Z",
            expected_status=None,
            opener=lambda _: json.dumps(payload).encode(),
        )

        self.assertEqual(len(frame), 48)
        self.assertEqual(
            frame["revision_status"].value_counts().to_dict(),
            {"definitive": 46, "consolidated": 2},
        )
        self.assertEqual(
            audit["revision_status_counts"],
            {"consolidated": 2, "definitive": 46},
        )
        self.assertEqual(audit["requested_revision_policy"], "published")

    def test_definitive_policy_rejects_mixed_tail_with_day_context(self):
        payload = self.payload("2024-12-31T00:00:00Z")
        for row in payload["results"][-4:]:
            row["nature"] = "Données consolidées"

        with self.assertRaisesRegex(
            RTEEco2MixCollectError, "2024-12-31.*differs from expected_status"
        ):
            fetch_rte_day(
                start="2024-12-31T00:00:00Z",
                end="2025-01-01T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_spring_dst_exact_duplicates_are_deduplicated(self):
        payload = self.payload("2024-03-31T00:00:00Z")
        payload["results"].extend(dict(row) for row in payload["results"][4:8])
        payload["total_count"] = 100

        frame, audit = fetch_rte_day(
            start="2024-03-31T00:00:00Z",
            end="2024-04-01T00:00:00Z",
            opener=lambda _: json.dumps(payload).encode(),
        )

        self.assertEqual(len(frame), 48)
        self.assertEqual(frame["solar_generation_mw"].isna().sum(), 0)
        self.assertTrue(audit["dst_transition_day"])
        self.assertEqual(audit["paris_utc_offset_change_minutes"], 60)
        self.assertEqual(audit["deduplicated_raw_rows"], 4)
        self.assertEqual(audit["missing_quarter_hour_rows"], 0)

    def test_spring_dst_conflicting_duplicate_fails_closed(self):
        payload = self.payload("2024-03-31T00:00:00Z")
        duplicates = [dict(row) for row in payload["results"][4:8]]
        duplicates[0]["solaire"] = 999.0
        payload["results"].extend(duplicates)
        payload["total_count"] = 100

        with self.assertRaisesRegex(RTEEco2MixCollectError, "conflicting duplicate"):
            fetch_rte_day(
                start="2024-03-31T00:00:00Z",
                end="2024-04-01T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_autumn_dst_missing_hour_is_preserved_as_null(self):
        payload = self.payload("2024-10-27T00:00:00Z")
        payload["results"] = payload["results"][4:]
        payload["total_count"] = 92

        frame, audit = fetch_rte_day(
            start="2024-10-27T00:00:00Z",
            end="2024-10-28T00:00:00Z",
            opener=lambda _: json.dumps(payload).encode(),
        )

        self.assertEqual(len(frame), 48)
        self.assertEqual(frame["solar_generation_mw"].isna().sum(), 2)
        self.assertTrue(frame.loc[:1, "revision_status"].isna().all())
        self.assertTrue(audit["dst_transition_day"])
        self.assertEqual(audit["paris_utc_offset_change_minutes"], -60)
        self.assertEqual(audit["missing_quarter_hour_rows"], 4)
        self.assertEqual(audit["missing_half_hour_rows"], 2)
        self.assertEqual(audit["missing_structural_rows"], 2)

    def test_dst_shape_is_rejected_on_an_ordinary_day(self):
        payload = self.payload()
        payload["results"] = payload["results"][4:]
        payload["total_count"] = 92
        with self.assertRaisesRegex(RTEEco2MixCollectError, "96 unique"):
            fetch_rte_day(
                start="2024-06-01T00:00:00Z",
                end="2024-06-02T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_truncated_daily_response_fails_closed(self):
        payload = self.payload()
        payload["results"].pop()
        with self.assertRaisesRegex(RTEEco2MixCollectError, "truncated"):
            fetch_rte_day(
                start="2024-06-01T00:00:00Z",
                end="2024-06-02T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_daily_count_other_than_supported_shapes_fails_closed(self):
        payload = self.payload()
        payload["results"] = payload["results"][:95]
        payload["total_count"] = 95
        with self.assertRaisesRegex(RTEEco2MixCollectError, "96 unique"):
            fetch_rte_day(
                start="2024-06-01T00:00:00Z",
                end="2024-06-02T00:00:00Z",
                opener=lambda _: json.dumps(payload).encode(),
            )

    def test_collects_daily_chunks_without_overlap(self):
        calls = []

        def fetcher(**kwargs):
            calls.append((kwargs["start"], kwargs["end"]))
            idx = pd.date_range(
                kwargs["start"], kwargs["end"], freq="30min", inclusive="left"
            )
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
                "deduplicated_raw_rows": 0,
                "missing_quarter_hour_rows": 0,
                "missing_structural_rows": 0,
                "dst_transition_day": False,
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
        self.assertEqual(audit["missing_power_rows"], 0)
        self.assertFalse(audit["data_quality_warning"])
        self.assertEqual(calls[1][0], "2024-06-02T00:00:00Z")

    def test_range_audit_counts_preserved_missing_power(self):
        def fetcher(**kwargs):
            idx = pd.date_range(
                kwargs["start"], kwargs["end"], freq="30min", inclusive="left"
            )
            frame = pd.DataFrame(
                {
                    "timestamp_utc": idx,
                    "solar_generation_mw": [pd.NA, pd.NA] + [1.0] * 46,
                    "revision_status": [pd.NA, pd.NA] + ["definitive"] * 46,
                    "source_timestamp": [pd.NA, pd.NA] + list(idx.astype(str)[2:]),
                }
            )
            return frame, {
                "input_rows": 92,
                "structural_null_rows": 46,
                "raw_response_sha256": "hash",
                "deduplicated_raw_rows": 0,
                "missing_quarter_hour_rows": 4,
                "missing_structural_rows": 2,
                "dst_transition_day": True,
            }

        _, audit = collect_rte_range(
            start="2024-10-27T00:00:00Z",
            end="2024-10-28T00:00:00Z",
            fetcher=fetcher,
        )
        self.assertEqual(audit["missing_power_rows"], 2)
        self.assertEqual(audit["missing_quarter_hour_rows"], 4)
        self.assertEqual(audit["missing_structural_rows"], 2)
        self.assertEqual(audit["dst_transition_days"], 1)
        self.assertTrue(audit["data_quality_warning"])
        self.assertEqual(audit["revision_status_counts"], {"definitive": 46})

    def test_gap_or_duplicate_fails_closed(self):
        def gap_fetcher(**kwargs):
            idx = pd.date_range(
                kwargs["start"], kwargs["end"], freq="30min", inclusive="left"
            )[1:]
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
