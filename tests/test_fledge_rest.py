import json
import os
import socket
import subprocess
import sys
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
    response_status = 200
    redirect_location = None

    def do_GET(self):
        type(self).received_path = self.path
        type(self).received_token = self.headers.get("authorization")
        body = json.dumps(type(self).response_payload).encode("utf-8")
        self.send_response(type(self).response_status)
        if type(self).redirect_location:
            self.send_header("Location", type(self).redirect_location)
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
        _Handler.response_status = 200
        _Handler.redirect_location = None
        _Handler.received_token = None
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

    def test_http_errors_and_redirects_fail_closed(self):
        for status in (401, 404, 500):
            _Handler.response_status = status
            with self.subTest(status=status), self.assertRaisesRegex(FledgeRestError, str(status)):
                fetch_asset_readings(FledgeRestConfig(self.base_url), "etch-01")

        _Handler.response_status = 302
        _Handler.redirect_location = f"{self.base_url}/token-sink"
        with self.assertRaisesRegex(FledgeRestError, "302"):
            fetch_asset_readings(
                FledgeRestConfig(self.base_url, auth_token="must-not-be-forwarded"), "etch-01"
            )
        self.assertEqual(_Handler.received_path, "/fledge/asset/etch-01?limit=20")

    def test_timeout_is_wrapped_without_leaking_details(self):
        def timeout_opener(*_args, **_kwargs):
            raise socket.timeout("secret endpoint detail")

        with self.assertRaisesRegex(FledgeRestError, "endpoint is unavailable") as caught:
            fetch_asset_readings(FledgeRestConfig(self.base_url), "etch-01", opener=timeout_opener)
        self.assertNotIn("secret", str(caught.exception))

    def test_empty_response_is_valid_and_malformed_items_fail_closed(self):
        _Handler.response_payload = []
        self.assertEqual(fetch_asset_readings(FledgeRestConfig(self.base_url), "etch-01"), [])

        malformed = [
            [None],
            [{"reading": {"x": 1}}],
            [{"timestamp": "2026-09-06 07:00:00", "reading": None}],
        ]
        for payload in malformed:
            _Handler.response_payload = payload
            with self.subTest(payload=payload), self.assertRaisesRegex(FledgeRestError, "reading\\[0\\]"):
                fetch_asset_readings(FledgeRestConfig(self.base_url), "etch-01")

    def test_cli_writes_expected_artifacts_without_recording_token(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "live"
            environment = os.environ.copy()
            environment["FLEDGE_AUTHTOKEN"] = "cli-secret-token"
            completed = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "fabguard.integrations.fledge_rest_cli",
                    "--base-url",
                    self.base_url,
                    "--asset",
                    "etch-01",
                    "--limit",
                    "2",
                    "--observed-at",
                    "2026-09-06T07:00:02Z",
                    "--require",
                    "pressure",
                    "--require",
                    "temperature",
                    "--output-dir",
                    str(output),
                ],
                cwd=Path(__file__).resolve().parents[1],
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(
                {path.name for path in output.iterdir()},
                {"alerts.json", "dead_letters.json", "report.json", "state.json"},
            )
            combined = completed.stdout + "".join(
                path.read_text(encoding="utf-8") for path in output.iterdir()
            )
            self.assertNotIn("cli-secret-token", combined)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["accepted_count"], 2)
            self.assertFalse(report["source"]["authentication_token_recorded"])

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
