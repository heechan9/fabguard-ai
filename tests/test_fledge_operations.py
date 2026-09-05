import tempfile
import unittest
from pathlib import Path

from fabguard.integrations.fledge_operations import (
    FledgeOperationsProcessor,
    JsonStateStore,
    OperationsConfig,
    StateStoreError,
    population_stability_index,
)
from fabguard.integrations.fledge_benchmark import run_benchmark


class FledgeOperationsTest(unittest.TestCase):
    def test_isolates_invalid_late_and_duplicate_readings(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStateStore(Path(directory) / "state.json")
            processor = FledgeOperationsProcessor(
                OperationsConfig(required_measurements=("pressure",), max_lateness_seconds=90), store
            )
            valid = {
                "asset_code": "etch-01",
                "user_ts": "2026-09-04T01:00:00Z",
                "reading": {"pressure": 1.2},
            }
            report = processor.process_batch(
                [valid, {**valid, "user_ts": "2026-09-04T00:00:00Z"}, {"bad": True}],
                observed_at="2026-09-04T01:01:00Z",
            )
            self.assertEqual(report["accepted_count"], 1)
            self.assertEqual(report["dead_letter_count"], 2)

            restarted = FledgeOperationsProcessor(processor.config, store)
            duplicate = restarted.process_batch([valid], observed_at="2026-09-04T01:01:30Z")
            self.assertEqual(duplicate["accepted_count"], 0)
            self.assertIn("already processed", duplicate["dead_letters"][0]["reason"])

    def test_disconnect_and_drift_alerts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            processor = FledgeOperationsProcessor(
                OperationsConfig(
                    required_measurements=("pressure",),
                    disconnect_after_seconds=30,
                    drift_threshold=0.1,
                ),
                JsonStateStore(Path(directory) / "state.json"),
            )
            readings = [
                {
                    "asset_code": "etch-01",
                    "user_ts": f"2026-09-04T01:00:{second:02d}Z",
                    "reading": {"pressure": 100.0 + second},
                }
                for second in range(10)
            ]
            report = processor.process_batch(
                readings,
                observed_at="2026-09-04T01:01:00Z",
                reference={"pressure": range(10)},
            )
            kinds = {alert["type"] for alert in report["alerts"]}
            self.assertIn("asset_disconnect", kinds)
            self.assertIn("distribution_drift", kinds)

    def test_psi_is_zero_for_same_distribution_and_positive_for_shift(self) -> None:
        reference = list(range(100))
        self.assertAlmostEqual(population_stability_index(reference, reference), 0.0)
        self.assertGreater(population_stability_index(reference, range(100, 200)), 0.2)

    def test_psi_handles_constant_missing_and_small_samples(self) -> None:
        self.assertEqual(population_stability_index([1.0] * 10, [1.0] * 10), 0.0)
        self.assertGreater(population_stability_index([1.0] * 10, [2.0] * 10), 0.2)
        self.assertIsNone(population_stability_index([1.0] * 10, [None] * 10))
        self.assertIsNone(population_stability_index(range(10), [1.0, 2.0]))

    def test_future_reading_is_isolated_without_poisoning_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStateStore(Path(directory) / "state.json")
            processor = FledgeOperationsProcessor(OperationsConfig(max_future_skew_seconds=5), store)
            report = processor.process_batch(
                [{"asset_code": "etch-01", "user_ts": "2026-09-04T01:01:00Z", "reading": {"pressure": 1.0}}],
                observed_at="2026-09-04T01:00:00Z",
            )
            self.assertEqual(report["dead_letter_count"], 1)
            self.assertEqual(store.load()["last_seen"], {})

    def test_disconnect_alert_is_one_shot_and_resets_after_recovery(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStateStore(Path(directory) / "state.json")
            processor = FledgeOperationsProcessor(
                OperationsConfig(disconnect_after_seconds=10, max_lateness_seconds=1000), store
            )
            first = processor.process_batch(
                [{"asset_code": "etch-01", "user_ts": "2026-09-04T01:00:00Z", "reading": {"pressure": 1.0}}],
                observed_at="2026-09-04T01:00:20Z",
            )
            second = processor.process_batch([], observed_at="2026-09-04T01:00:30Z")
            recovery = processor.process_batch(
                [{"asset_code": "etch-01", "user_ts": "2026-09-04T01:00:31Z", "reading": {"pressure": 1.0}}],
                observed_at="2026-09-04T01:00:31Z",
            )
            third = processor.process_batch([], observed_at="2026-09-04T01:00:50Z")
            self.assertEqual([a["type"] for a in first["alerts"]], ["asset_disconnect"])
            self.assertEqual(second["alerts"], [])
            self.assertEqual(recovery["alerts"], [])
            self.assertEqual([a["type"] for a in third["alerts"]], ["asset_disconnect"])

    def test_seen_retention_bounds_persisted_dedupe_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStateStore(Path(directory) / "state.json")
            processor = FledgeOperationsProcessor(
                OperationsConfig(dedupe_retention_seconds=10, max_lateness_seconds=1000), store
            )
            processor.process_batch(
                [{"asset_code": "etch-01", "user_ts": "2026-09-04T01:00:00Z", "reading": {"pressure": 1.0}}],
                observed_at="2026-09-04T01:00:00Z",
            )
            processor.process_batch(
                [{"asset_code": "etch-01", "user_ts": "2026-09-04T01:00:20Z", "reading": {"pressure": 1.0}}],
                observed_at="2026-09-04T01:00:20Z",
            )
            self.assertEqual(len(store.load()["seen"]), 1)

    def test_corrupt_state_and_concurrent_writer_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            path.write_text("{broken", encoding="utf-8")
            store = JsonStateStore(path)
            with self.assertRaises(StateStoreError):
                store.load()
            path.unlink()
            with store.exclusive():
                with self.assertRaises(StateStoreError):
                    with store.exclusive():
                        pass

    def test_benchmark_verifies_restart_contract(self) -> None:
        report = run_benchmark(20, 2, stress=True)
        self.assertTrue(report["restart_deduplication_verified"])
        self.assertGreater(report["throughput_min"], 0)
        self.assertEqual(report["profile"], "deterministic_out_of_order_and_duplicate")


if __name__ == "__main__":
    unittest.main()
