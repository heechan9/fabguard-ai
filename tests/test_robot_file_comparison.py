"""Synthetic checks for saved-file audit semantics; no private data or fitting."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location(
    "robot_file_comparison",
    Path(__file__).resolve().parents[1] / "verification" / "compare_robot_files.py",
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class RobotFileComparisonTest(unittest.TestCase):
    def test_alignment_reports_reordering_without_hiding_metadata_changes(self):
        columns = ["id", "label"]
        reference = (columns, [{"id": "a", "label": "0"}, {"id": "b", "label": "1"}], {})
        reproduced = (columns, [{"id": "b", "label": "0"}, {"id": "a", "label": "0"}], {})
        _, aligned, result = audit.align(reference, reproduced, ("id",), ("label",))
        self.assertFalse(result["row_key_order_equal"])
        self.assertEqual([row["id"] for row in aligned], ["a", "b"])
        self.assertEqual(result["metadata_differences"]["label"], 1)

    def test_cutoff_tie_uses_segment_id_and_is_explicit(self):
        rows = [{"segment_id": name, "label": label, "anomaly_score": "1"}
                for name, label in [("z", "0"), ("a", "1"), ("b", "0"), ("c", "1")]]
        metrics, _, selected, captured, cutoff = audit.evaluate(rows)
        self.assertEqual(selected, {"a"})
        self.assertEqual(captured, {"a"})
        self.assertTrue(cutoff["tie_across_boundary"])
        self.assertEqual(metrics["top_10_percent"]["inspected"], 1)

    def test_tiny_difference_is_not_exact_equality(self):
        changed = np.nextafter(1.0, 2.0)
        result = audit.numeric_errors([1.0, 0.0], [changed, 0.0])
        self.assertEqual(result["exact_numeric_differences"], 1)
        self.assertTrue(result["allclose_atol_1e-14_rtol_1e-14"])
        self.assertGreater(result["max_absolute_error"], 0)

    def test_unrecognized_reference_bytes_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "example.csv"
            path.write_text("example\n1\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unexpected SHA-256"):
                audit.load_csv(path, "reference_features")


if __name__ == "__main__":
    unittest.main()
