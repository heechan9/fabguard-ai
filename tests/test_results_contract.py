from pathlib import Path
import json
import unittest

import pandas as pd


RESULT_DIR = Path("results/v1")


@unittest.skipUnless((RESULT_DIR / "manifest.json").exists(), "V1 results not generated")
class ResultsContractTest(unittest.TestCase):
    def test_priority_table_matches_temporal_test(self) -> None:
        priorities = pd.read_csv(RESULT_DIR / "priority_table.csv")
        split = pd.read_csv(RESULT_DIR / "test_split.csv")
        self.assertEqual(len(priorities), 392)
        self.assertEqual(priorities["rank"].tolist(), list(range(1, 393)))
        self.assertEqual(set(priorities["sample_id"]), set(split["sample_id"]))
        self.assertTrue(priorities["risk_score"].is_monotonic_decreasing)

    def test_top10_contract(self) -> None:
        topk = pd.read_csv(RESULT_DIR / "top_k_test.csv")
        row = topk.loc[(topk["k_fraction"] - 0.10).abs().idxmin()]
        self.assertEqual(int(row["inspection_count"]), 40)
        self.assertEqual(int(row["total_fail"]), 24)

    def test_manifest_keeps_provisional_status(self) -> None:
        manifest = json.loads((RESULT_DIR / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn("provisional", manifest["evaluation_status"])
        self.assertEqual(manifest["test_exposure_log"], "docs/TEST_EXPOSURE.md")

    def test_web_data_contract(self) -> None:
        web_dir = Path("web/data")
        self.assertTrue((web_dir / "summary.json").exists())
        self.assertTrue((web_dir / "priority_top50.json").exists())
        self.assertTrue((web_dir / "phase1_summary.json").exists())

        web_summary = json.loads((web_dir / "summary.json").read_text(encoding="utf-8"))
        manifest = json.loads((RESULT_DIR / "manifest.json").read_text(encoding="utf-8"))
        audit_data = json.loads((RESULT_DIR / "data_audit.json").read_text(encoding="utf-8"))
        topk_csv = pd.read_csv(RESULT_DIR / "top_k_test.csv")
        priority_csv = pd.read_csv(RESULT_DIR / "priority_table.csv")

        self.assertEqual(web_summary["selected_model"], manifest["selected_candidate_from_train_cv"])
        self.assertEqual(len(web_summary["top_k"]), len(topk_csv))

        self.assertIn("dataset", web_summary)
        ds = web_summary["dataset"]
        self.assertEqual(ds["samples"], audit_data["samples"])
        self.assertEqual(ds["measurement_features"], audit_data["measurement_features"])
        self.assertEqual(ds["pass_count"], audit_data["pass_count"])
        self.assertEqual(ds["fail_count"], audit_data["fail_count"])
        self.assertEqual(ds["pass_count"] + ds["fail_count"], ds["samples"])

        web_top50 = json.loads((web_dir / "priority_top50.json").read_text(encoding="utf-8"))
        self.assertEqual(len(web_top50), 50)
        self.assertEqual(web_top50[0]["sample_id"], priority_csv.iloc[0]["sample_id"])
        self.assertEqual(int(web_top50[0]["rank"]), 1)

        phase1 = json.loads((web_dir / "phase1_summary.json").read_text(encoding="utf-8"))
        self.assertEqual(phase1["status"], "scenario_and_provisional_validation")
        self.assertFalse(phase1["test_split_changed"])
        self.assertLess(phase1["ece"]["after"], phase1["ece"]["before"])
        self.assertEqual(phase1["best_cost"]["inspection_cost"], 1)
        self.assertEqual(phase1["best_cost"]["missed_fail_cost"], 20)


if __name__ == "__main__":
    unittest.main()
