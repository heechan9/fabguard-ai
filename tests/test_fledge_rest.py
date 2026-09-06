import json
import tempfile
import threading
import unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from fabguard.integrations.fledge_operations import FledgeOperationsProcessor, JsonStateStore, OperationsConfig
from fabguard.integrations.fledge_rest import FledgeRestConfig, FledgeRestError, fetch_asset_readings


class _Handler(BaseHTTPRequestHandler):
    response_payload = [
        {"timestamp": "2026-09-06 07:00:00.000", "reading": {"pressure": 1.2, "temperature": 22.4}},
        {"timestamp": "2026-09-06 07:00:01.000", "reading": {"pressure": 1.3, "temperature": 22.5}},
    ]
    received_path = ""
    received_token = None

    def do_GET(self):
        type(self).received_path = self.path
        type(self).received_token = self.headers.get("authtoken")
        body = json.dumps(type(self).response_payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


class FledgeRestTest(unittest.TestCase):
    def setUp(self):
        _Handler.response_payload = [
            {"timestamp": "2026-09-06 07:00:00.000", "reading": {"pressure": 1.2, "temperature": 22.4}},
            {"timestamp": "2026-09-06 07:00:01.000", "reading": {"pressure": 1.3, "temperature": 22.5}},
        ]
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_live_rest_response_enters_operational_boundary(self):
        readings = fetch_asset_readings(
            FledgeRestConfig(self.base_url, auth_token="test-token"), "etch/01", limit=2
        )
        self.assertEqual(_Handler.received_path, "/fledge/asset/etch%2F01?limit=2")
        self.assertEqual(_Handler.received_token, "test-token")
        with tempfile.TemporaryDirectory() as directory:
            processor = FledgeOperationsProcessor(
                OperationsConfig(required_measurements=("pressure", "temperature")),
                JsonStateStore(Path(directory) / "state.json"),
            )
            report = processor.process_batch(
                readings, observed_at=datetime(2026, 9, 6, 7, 0, 2, tzinfo=timezone.utc)
            )
        self.assertEqual(report["accepted_count"], 2)
        self.assertEqual(report["dead_letter_count"], 0)

    def test_malformed_and_oversized_responses_fail_closed(self):
        _Handler.response_payload = {"rows": []}
        with self.assertRaisesRegex(FledgeRestError, "JSON array"):
            fetch_asset_readings(FledgeRestConfig(self.base_url), "etch-01")
        _Handler.response_payload = [{"timestamp": "2026-09-06 07:00:00", "reading": {"x": 1}}]
        with self.assertRaisesRegex(FledgeRestError, "exceeds"):
            fetch_asset_readings(FledgeRestConfig(self.base_url, max_response_bytes=2), "etch-01")

    def test_url_limit_and_token_contracts_reject_unsafe_values(self):
        invalid = [
            FledgeRestConfig("file:///tmp/fledge"),
            FledgeRestConfig("http://user:pass@localhost:8081"),
            FledgeRestConfig("http://localhost:8081?token=secret"),
        ]
        for config in invalid:
            with self.subTest(config=config), self.assertRaises(FledgeRestError):
                fetch_asset_readings(config, "etch-01")
        with self.assertRaises(FledgeRestError):
            fetch_asset_readings(FledgeRestConfig(self.base_url), "etch-01", limit=0)
        with self.assertRaises(FledgeRestError):
            fetch_asset_readings(FledgeRestConfig(self.base_url, auth_token=" "), "etch-01")


if __name__ == "__main__":
    unittest.main()
