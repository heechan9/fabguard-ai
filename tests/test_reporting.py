from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

import pandas as pd

from fabguard.reporting import write_phase1_web_data, write_summary, write_web_data


class ReportingTest(unittest.TestCase):
    def test_reporting_pipeline_round_trip(self) -> None:
        with TemporaryDirectory() as tmpdir:
            res_dir = Path(tmpdir) / "results"
            web_dir = Path(tmpdir) / "web_data"
            res_dir.mkdir(parents=True)
            web_dir.mkdir(parents=True)

            manifest_content = {
                "selected_candidate_from_train_cv": "dummy_candidate",
                "evaluation_status": "provisional"
            }
            (res_dir / "manifest.json").write_text(json.dumps(manifest_content), encoding="utf-8")

            cv_df = pd.DataFrame([{
                "candidate": "dummy_candidate",
                "pr_auc_average_precision_mean": 0.20,
                "pr_auc_average_precision_std": 0.05
            }])
            cv_df.to_csv(res_dir / "cv_summary.csv", index=False)

            test_df = pd.DataFrame([{
                "candidate": "dummy_candidate",
                "pr_auc_average_precision": 0.10,
                "tp": 0, "fp": 0, "fn": 24, "tn": 368
            }])
            test_df.to_csv(res_dir / "test_metrics.csv", index=False)

            topk_df = pd.DataFrame([{
                "k_fraction": 0.10,
                "inspection_count": 40,
                "captured_fail": 5,
                "total_fail": 24,
                "fail_capture_rate": 0.2083,
                "precision": 0.125,
                "lift": 2.04
            }])
            topk_df.to_csv(res_dir / "top_k_test.csv", index=False)

            prio_df = pd.DataFrame([{
                "rank": 1,
                "sample_id": "secom_0001",
                "risk_score": 0.95
            }])
            prio_df.to_csv(res_dir / "priority_table.csv", index=False)

            audit_content = {
                "samples": 100,
                "measurement_features": 10,
                "pass_count": 90,
                "fail_count": 10
            }
            (res_dir / "data_audit.json").write_text(json.dumps(audit_content), encoding="utf-8")

            write_summary(res_dir)
            write_web_data(res_dir, web_dir)

            self.assertTrue((res_dir / "RESULTS_SUMMARY.md").exists())
            self.assertTrue((web_dir / "summary.json").exists())
            self.assertTrue((web_dir / "priority_top50.json").exists())

            summary_md = (res_dir / "RESULTS_SUMMARY.md").read_text(encoding="utf-8")
            self.assertIn("dummy_candidate", summary_md)

            web_summary = json.loads((web_dir / "summary.json").read_text(encoding="utf-8"))
            self.assertEqual(web_summary["selected_model"], "dummy_candidate")
            self.assertIn("dataset", web_summary)
            self.assertEqual(web_summary["dataset"]["samples"], 100)

    def test_app_js_contains_no_numeric_fallbacks(self) -> None:
        app_js = Path("web/app.js").read_text(encoding="utf-8")
        self.assertNotIn("1567", app_js)
        self.assertNotIn("590", app_js)
        self.assertNotIn("40건", app_js)
        self.assertNotIn("불량 5건", app_js)

    def test_phase1_web_data_is_generated_from_canonical_csvs(self) -> None:
        with TemporaryDirectory() as tmpdir:
            phase1_dir = Path(tmpdir) / "phase1"
            web_dir = Path(tmpdir) / "web"
            phase1_dir.mkdir()
            pd.DataFrame([
                {"variant": "uncalibrated", "brier_score": .08, "expected_calibration_error": .12, "bins": 10, "populated_bins": 5},
                {"variant": "sigmoid_train_tail", "brier_score": .06, "expected_calibration_error": .04, "bins": 10, "populated_bins": 4},
            ]).to_csv(phase1_dir / "calibration_metrics.csv", index=False)
            pd.DataFrame([
                {"k_fraction": .1, "inspection_count": 10, "captured_fail": 2, "missed_fail": 8, "inspection_cost_units": 1, "missed_fail_cost_units": 20, "scenario_total_cost": 170, "no_review_cost": 200, "scenario_cost_reduction": 30},
                {"k_fraction": .2, "inspection_count": 20, "captured_fail": 4, "missed_fail": 6, "inspection_cost_units": 1, "missed_fail_cost_units": 20, "scenario_total_cost": 140, "no_review_cost": 200, "scenario_cost_reduction": 60},
            ]).to_csv(phase1_dir / "inspection_cost_scenarios.csv", index=False)
            pd.DataFrame([{"k_fraction": .1, "confidence": .95, "valid_replicates": 500, "fail_capture_mean": .2, "fail_capture_low": .05, "fail_capture_high": .4, "precision_mean": .1, "precision_low": 0, "precision_high": .2}]).to_csv(phase1_dir / "top_k_bootstrap.csv", index=False)
            pd.DataFrame([
                {"fold": 0, "average_precision": .07},
                {"fold": 1, "average_precision": .21},
            ]).to_csv(phase1_dir / "walk_forward_metrics.csv", index=False)

            write_phase1_web_data(phase1_dir, web_dir)
            payload = json.loads((web_dir / "phase1_summary.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["source"], "results/phase1 canonical CSV artifacts")
            self.assertEqual(payload["ece"]["populated_bins"], 4)
            self.assertEqual(payload["best_cost"]["k_fraction"], .2)
            self.assertEqual(payload["top10_capture"]["bootstrap_replicates"], 500)
            self.assertEqual(payload["walk_forward"], {"min": .07, "max": .21, "folds": 2})


if __name__ == "__main__":
    unittest.main()
