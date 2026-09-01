from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

import pandas as pd

from fabguard.reporting import write_summary, write_web_data


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

            write_summary(res_dir)
            write_web_data(res_dir, web_dir)

            self.assertTrue((res_dir / "RESULTS_SUMMARY.md").exists())
            self.assertTrue((web_dir / "summary.json").exists())
            self.assertTrue((web_dir / "priority_top50.json").exists())

            summary_md = (res_dir / "RESULTS_SUMMARY.md").read_text(encoding="utf-8")
            self.assertIn("dummy_candidate", summary_md)

            web_summary = json.loads((web_dir / "summary.json").read_text(encoding="utf-8"))
            self.assertEqual(web_summary["selected_model"], "dummy_candidate")


if __name__ == "__main__":
    unittest.main()
