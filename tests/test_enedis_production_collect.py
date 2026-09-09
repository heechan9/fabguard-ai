import json
import unittest
from datetime import datetime, timezone

from fabguard.integrations.enedis_production_collect import (
    EnedisProductionCollectError, build_range_params, collect_enedis_range,
)


def row(ts, energy=10):
    return {"horodate": ts, "filiere_de_production": "F5 : Solaire",
            "plage_de_puissance_injection": "P0 : Total toutes puissances",
            "total_energie_injectee_wh": energy, "nb_points_injection": 2}


class EnedisProductionCollectTest(unittest.TestCase):
    def test_structured_filters_are_bounded(self):
        p = build_range_params(start="2024-01-01T00:00:00Z", end="2024-01-02T00:00:00Z")
        self.assertEqual(p["filiere_de_production_eq"], "F5 : Solaire")
        self.assertEqual(p["horodate_lt"], "2024-01-02T00:00:00Z")
        self.assertEqual(p["count"], "exact")

    def test_collects_pages_and_preserves_hash_lineage(self):
        rows = [row("2024-01-01T01:00:00+01:00"), row("2024-01-01T01:30:00+01:00")]
        def opener(url):
            if "after=" not in url:
                return json.dumps({"total": 2, "results": rows[:1], "next": "https://opendata.enedis.fr/data-fair/api/v1/datasets/x/lines?after=1"}).encode()
            return json.dumps({"results": rows[1:]}).encode()
        frame, audit = collect_enedis_range(start="2024-01-01T00:00:00Z", end="2024-01-01T01:00:00Z", opener=opener, retrieved_at=datetime(2026,9,9,tzinfo=timezone.utc))
        self.assertEqual(len(frame), 2)
        self.assertEqual(audit["pages"], 2)
        self.assertEqual(len(audit["page_sha256"]), 2)
        self.assertEqual(audit["missing_energy_rows"], 0)

    def test_changed_later_total_fails_closed(self):
        rows = [row("2024-01-01T01:00:00+01:00"), row("2024-01-01T01:30:00+01:00")]
        def opener(url):
            if "after=" not in url:
                return json.dumps({"total": 2, "results": rows[:1], "next": "https://opendata.enedis.fr/data-fair/api/v1/datasets/x/lines?after=1"}).encode()
            return json.dumps({"total": 3, "results": rows[1:]}).encode()
        with self.assertRaisesRegex(EnedisProductionCollectError, "total changed"):
            collect_enedis_range(
                start="2024-01-01T00:00:00Z",
                end="2024-01-01T01:00:00Z",
                opener=opener,
            )

    def test_ignored_parameter_total_change_and_bad_next_fail_closed(self):
        cases = [
            {"total": 2, "results": [row("2024-01-01T01:00:00+01:00")], "meta": {"hints": ["Some parameters were ignored"]}},
            {"total": 1, "results": [row("2024-01-01T01:00:00+01:00")], "next": "https://evil.example/next"},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                with self.assertRaises(EnedisProductionCollectError):
                    collect_enedis_range(start="2024-01-01T00:00:00Z", end="2024-01-01T00:30:00Z", opener=lambda _: json.dumps(payload).encode())

    def test_gaps_and_oversized_ranges_fail_closed(self):
        with self.assertRaises(EnedisProductionCollectError):
            build_range_params(start="2024-01-01T00:00:00Z", end="2025-01-02T00:00:00Z")
        payload={"total":1,"results":[row("2024-01-01T01:30:00+01:00")]}
        with self.assertRaisesRegex(EnedisProductionCollectError,"requested half-hour grid"):
            collect_enedis_range(start="2024-01-01T00:00:00Z",end="2024-01-01T01:00:00Z",opener=lambda _:json.dumps(payload).encode())


if __name__ == "__main__": unittest.main()
