import tempfile
import unittest
from pathlib import Path

from fabguard.integrations.fledge_operations import (
    FledgeOperationsProcessor,
    JsonStateStore,
    OperationsConfig,
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

    def test_benchmark_verifies_restart_contract(self) -> None:
        report = run_benchmark(20, 2)
        self.assertTrue(report["restart_deduplication_verified"])
        self.assertGreater(report["throughput_min"], 0)


if __name__ == "__main__":
    unittest.main()
