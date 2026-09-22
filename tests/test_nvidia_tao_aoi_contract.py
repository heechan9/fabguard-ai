from pathlib import Path
import json
import unittest


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "examples/nvidia_tao/optical_inspection_contract.json"


class NvidiaTaoAOIContractTest(unittest.TestCase):
    def setUp(self):
        self.contract = json.loads(CONTRACT.read_text(encoding="utf-8"))

    def test_contract_is_planning_only_and_separate_from_secom(self):
        self.assertEqual(
            self.contract["schema_version"],
            "fabguard-nvidia-tao-optical-inspection/v1",
        )
        self.assertEqual(
            self.contract["status"], "planned_blocked_pending_data_and_gpu"
        )
        self.assertFalse(self.contract["secom_v1_result_reused"])
        self.assertEqual(
            self.contract["evidence_scope"], "independent_aoi_visual_inspection"
        )

    def test_unavailable_inputs_outputs_and_thresholds_stay_null(self):
        for value in self.contract["dataset_gate"].values():
            if isinstance(value, str) and value.endswith("_csv"):
                self.fail("dataset paths must be represented by keys, not invented values")
        for key in (
            "train_images", "train_csv", "validation_images", "validation_csv",
            "test_images", "test_csv", "inference_images", "inference_csv",
        ):
            self.assertIsNone(self.contract["dataset_gate"][key])
        self.assertIsNone(self.contract["acceptance_gate"]["thresholds"])
        self.assertTrue(all(value is None for value in self.contract["artifacts"].values()))

    def test_runtime_and_failure_sensitive_metrics_are_explicit(self):
        self.assertEqual(self.contract["runtime_gate"]["minimum_vram_gb"], 8)
        self.assertGreaterEqual(self.contract["runtime_gate"]["gpu_count"], 1)
        metrics = set(self.contract["acceptance_gate"]["required_metrics"])
        self.assertTrue({"false_negative_count", "false_positive_count", "per_defect_type_recall"} <= metrics)
        self.assertIn("production ready", self.contract["claims_blocked"])
        self.assertIn("yield improved", self.contract["claims_blocked"])


if __name__ == "__main__":
    unittest.main()
