import json
from datetime import datetime, timezone
import unittest
from urllib.parse import parse_qs, urlparse

from fabguard.integrations.pvlive_fetch import (
    PVLiveFetchError,
    fetch_pvlive_range,
)


class PVLiveFetchTest(unittest.TestCase):
    def response(self) -> bytes:
        return json.dumps(
            {
                "meta": ["gsp_id", "datetime_gmt", "generation_mw", "updated_gmt"],
                "data": [
                    [0, "2025-06-01T00:30:00Z", 0.0, "2026-08-13T00:00:00Z"],
                    [0, "2025-06-01T01:00:00Z", 1.5, "2026-08-13T00:00:00Z"],
                ],
            },
            separators=(",", ":"),
        ).encode()

    def test_builds_bounded_query_and_audit(self) -> None:
        seen = []

        def opener(url: str) -> bytes:
            seen.append(url)
            return self.response()

        normalized, audit = fetch_pvlive_range(
            start="2025-06-01T00:30:00Z",
            end="2025-06-01T01:00:00Z",
            opener=opener,
            retrieved_at=datetime(2026, 9, 8, tzinfo=timezone.utc),
        )
        self.assertEqual(len(normalized), 2)
        self.assertEqual(audit["status"], "pvlive_live_contract_validated")
        self.assertEqual(audit["source_type"], "estimated")
        parsed = urlparse(seen[0])
        self.assertEqual(parsed.hostname, "api.pvlive.uk")
        query = parse_qs(parsed.query)
        self.assertEqual(query["extra_fields"], ["updated_gmt"])
        self.assertEqual(query["period"], ["30"])

    def test_range_and_timezone_fail_closed(self) -> None:
        with self.assertRaisesRegex(PVLiveFetchError, "seven days"):
            fetch_pvlive_range(
                start="2025-06-01T00:00:00Z",
                end="2025-06-09T00:00:00Z",
                opener=lambda _: self.response(),
            )
        with self.assertRaisesRegex(PVLiveFetchError, "explicitly use UTC"):
            fetch_pvlive_range(
                start="2025-06-01T00:00:00",
                end="2025-06-01T01:00:00Z",
                opener=lambda _: self.response(),
            )

    def test_malformed_payload_fails_closed(self) -> None:
        with self.assertRaisesRegex(PVLiveFetchError, "meta and data"):
            fetch_pvlive_range(
                start="2025-06-01T00:30:00Z",
                end="2025-06-01T01:00:00Z",
                opener=lambda _: b'{"unexpected":[]}',
            )
        bad = json.dumps({"meta": ["gsp_id"], "data": [[0, 1]]}).encode()
        with self.assertRaisesRegex(PVLiveFetchError, "do not match meta"):
            fetch_pvlive_range(
                start="2025-06-01T00:30:00Z",
                end="2025-06-01T01:00:00Z",
                opener=lambda _: bad,
            )


if __name__ == "__main__":
    unittest.main()
