import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fabguard.integrations import fledge_operations_cli, fledge_rest_cli
from fabguard.integrations.fledge_operations import (
    FledgeOperationsProcessor, JsonStateStore, OperationsConfig, StateStoreError,
)


class FledgeCliDeliveryTest(unittest.TestCase):
    def readings(self):
        return json.loads('''[
            {"asset_code":"good","user_ts":"2026-09-04T01:00:00Z","reading":{"pressure":1.2}},
            {"asset_code":"bad","user_ts":"2026-09-04T01:00:00Z","reading":{"pressure":1e999}},
            {"asset_code":"","reading":{"nested":[NaN,-Infinity]}}
        ]''')

    def run_cli(self, mode, directory, unavailable=False):
        args = ["fabguard", "--output-dir", str(directory),
                "--observed-at", "2026-09-04T01:00:00Z"]
        module = fledge_rest_cli if mode == "rest" else fledge_operations_cli
        if mode == "rest":
            args += ["--base-url", "http://localhost:8081", "--asset", "good"]
            input_patch = patch.object(module, "fetch_asset_readings", return_value=self.readings())
        else:
            args += ["--input", "fixture.json"]
            input_patch = patch.object(module, "load_readings", return_value=self.readings())
        with patch("sys.argv", args), input_patch as source, contextlib.redirect_stdout(io.StringIO()):
            if unavailable:
                source.side_effect = OSError("original input is no longer available")
            module.main()
            if unavailable:
                source.assert_not_called()

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

    def test_recovery_does_not_need_original_source(self):
        for mode in ("local", "rest"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                blocked = directory / "alerts.json"
                blocked.mkdir()
                with self.assertRaises(OSError):
                    self.run_cli(mode, directory)
                original = self.strict_read(directory / "report.json")
                blocked.rmdir()
                self.run_cli(mode, directory, unavailable=True)
                self.assertEqual(self.strict_read(directory / "report.json"), original)
                self.assertEqual(self.strict_read(directory / "dead_letters.json"), original["dead_letters"])
                self.assertEqual(self.strict_read(directory / "alerts.json"), original["alerts"])
                self.assertEqual(len(JsonStateStore(directory / "state.json").load()["seen"]), 1)

    def test_state_save_failure_recovers_without_refetch(self):
        for mode in ("local", "rest"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                with patch.object(JsonStateStore, "save", side_effect=OSError("state disk error")):
                    with self.assertRaisesRegex(OSError, "state disk error"):
                        self.run_cli(mode, directory)
                original = self.strict_read(directory / "report.json")
                self.run_cli(mode, directory, unavailable=True)
                self.assertEqual(self.strict_read(directory / "report.json"), original)
                self.assertEqual(len(JsonStateStore(directory / "state.json").load()["seen"]), 1)

    def test_cleanup_failure_after_state_commit_replays_exact_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            store = JsonStateStore(directory / "state.json")
            original_unlink = Path.unlink

            def fail_cleanup(path, *args, **kwargs):
                if path == store.pending_path:
                    raise OSError("journal cleanup failed")
                return original_unlink(path, *args, **kwargs)

            with patch.object(Path, "unlink", fail_cleanup):
                with self.assertRaisesRegex(OSError, "journal cleanup failed"):
                    self.run_cli("local", directory)
            committed = store.path.read_bytes()
            original = self.strict_read(directory / "report.json")
            self.run_cli("local", directory, unavailable=True)
            self.assertEqual(store.path.read_bytes(), committed)
            self.assertEqual(self.strict_read(directory / "report.json"), original)
            self.assertFalse(store.pending_path.exists())

    def test_journal_write_failure_does_not_publish_or_commit(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            store = JsonStateStore(directory / "state.json")
            store.pending_path.with_suffix(".json.tmp").mkdir()
            with self.assertRaises(OSError):
                self.run_cli("local", directory)
            self.assertFalse(store.path.exists())
            self.assertFalse(store.pending_path.exists())
            self.assertFalse((directory / "report.json").exists())

    def test_corrupt_journal_and_divergent_state_fail_closed(self):
        for failure in ("corrupt", "divergent"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                blocked = directory / "alerts.json"
                blocked.mkdir()
                with self.assertRaises(OSError):
                    self.run_cli("local", directory)
                blocked.rmdir()
                store = JsonStateStore(directory / "state.json")
                if failure == "corrupt":
                    store.pending_path.write_text('{"schema_version":99}', encoding="utf-8")
                else:
                    store.save({"seen": {"unrelated": "2026-09-04T01:00:00Z"},
                                "last_seen": {}, "disconnect_alerted": []})
                journal = store.pending_path.read_bytes()
                before = (directory / "report.json").read_bytes()
                with self.assertRaises(StateStoreError):
                    self.run_cli("local", directory, unavailable=True)
                self.assertEqual(store.pending_path.read_bytes(), journal)
                self.assertEqual((directory / "report.json").read_bytes(), before)

    def test_pending_batch_blocks_direct_processing(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / "alerts.json").mkdir()
            with self.assertRaises(OSError):
                self.run_cli("local", directory)
            processor = FledgeOperationsProcessor(OperationsConfig(), JsonStateStore(directory / "state.json"))
            with self.assertRaisesRegex(StateStoreError, "pending delivery"):
                processor.process_batch([], observed_at="2026-09-04T01:00:00Z")
