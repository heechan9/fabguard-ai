import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fabguard.integrations import fledge_operations_cli, fledge_rest_cli
from fabguard.integrations.fledge_operations import JsonStateStore


class FledgeCliDeliveryTest(unittest.TestCase):
    def readings(self):
        return json.loads('''[
            {"asset_code":"good","user_ts":"2026-09-04T01:00:00Z","reading":{"pressure":1.2}},
            {"asset_code":"bad","user_ts":"2026-09-04T01:00:00Z","reading":{"pressure":1e999}},
            {"asset_code":"","reading":{"nested":[NaN,-Infinity]}}
        ]''')

    def run_cli(self, mode, directory):
        args = ["fabguard", "--output-dir", str(directory),
                "--observed-at", "2026-09-04T01:00:00Z"]
        module = fledge_rest_cli if mode == "rest" else fledge_operations_cli
        if mode == "rest":
            args += ["--base-url", "http://localhost:8081", "--asset", "good"]
            input_patch = patch.object(module, "fetch_asset_readings", return_value=self.readings())
        else:
            args += ["--input", "fixture.json"]
            input_patch = patch.object(module, "load_readings", return_value=self.readings())
        with patch("sys.argv", args), input_patch, contextlib.redirect_stdout(io.StringIO()):
            module.main()

    def strict_read(self, path):
        def reject(value):
            raise AssertionError(f"Non-standard JSON constant: {value}")
        return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject)

    def test_mixed_batch_and_nested_rejection_are_strict_json(self):
        for mode in ("local", "rest"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                self.run_cli(mode, directory)
                report = self.strict_read(directory / "report.json")
                self.assertEqual(report["accepted_count"], 1)
                self.assertEqual(report["dead_letter_count"], 2)
                self.assertEqual(report["dead_letters"][1]["reading"]["reading"]["nested"], ["nan", "-inf"])
                self.assertEqual(self.strict_read(directory / "dead_letters.json"), report["dead_letters"])
                self.assertEqual(self.strict_read(directory / "alerts.json"), report["alerts"])
                self.assertEqual(len(JsonStateStore(directory / "state.json").load()["seen"]), 1)

    def test_each_output_failure_preserves_state_and_retry(self):
        for mode in ("local", "rest"):
            for name in ("report.json", "dead_letters.json", "alerts.json"):
                with self.subTest(mode=mode, artifact=name), tempfile.TemporaryDirectory() as tmp:
                    directory = Path(tmp)
                    store = JsonStateStore(directory / "state.json")
                    store.save({"seen": {}, "last_seen": {"old": "2026-09-04T00:00:00+00:00"}, "disconnect_alerted": []})
                    before = store.path.read_bytes()
                    blocked = directory / name
                    blocked.mkdir()
                    with self.assertRaises(OSError):
                        self.run_cli(mode, directory)
                    self.assertEqual(store.path.read_bytes(), before)
                    self.assertFalse(store.lock_path.exists())
                    self.assertEqual(list(directory.glob("*.tmp")), [])
                    blocked.rmdir()
                    self.run_cli(mode, directory)
                    report = self.strict_read(directory / "report.json")
                    self.assertEqual(report["accepted_count"], 1)
                    self.assertEqual(report["dead_letter_count"], 2)
                    self.assertEqual(report["alerts"][0]["type"], "asset_disconnect")
                    self.assertEqual(store.load()["disconnect_alerted"], ["old"])
                    self.run_cli(mode, directory)
                    self.assertEqual(self.strict_read(directory / "report.json")["accepted_count"], 0)
