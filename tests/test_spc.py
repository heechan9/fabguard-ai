import unittest

from fabguard.spc import csv_report, individuals_report


class IndividualsTests(unittest.TestCase):
    def test_nist_worked_example_and_limits(self):
        baseline = [49.6, 47.6, 49.9, 51.3, 47.8, 51.2, 52.6, 52.4, 53.6, 52.1]
        report = individuals_report(baseline + [56, 45, 50, None], 10)
        self.assertAlmostEqual(report["center"], 50.81)
        self.assertAlmostEqual(report["ucl"], 55.8041, places=4)
        self.assertAlmostEqual(report["lcl"], 45.8159, places=4)
        self.assertEqual([r["status"] for r in report["observations"]],
                         ["above_limit", "below_limit", "within_limits", "unknown"])

    def test_future_values_cannot_change_limits_and_boundaries_are_inclusive(self):
        baseline = [99, 101] * 5
        first = individuals_report(baseline + [100], 10)
        second = individuals_report(baseline + [first["lcl"], first["ucl"], 1e20], 10)
        for key in ("center", "lcl", "ucl", "mean_moving_range"):
            self.assertEqual(first[key], second[key])
        self.assertEqual([r["status"] for r in second["observations"]],
                         ["within_limits", "within_limits", "above_limit"])

    def test_invalid_or_unusable_baseline(self):
        for values, count in [([1] * 11, 10), ([1, None] * 6, 10),
                              ([1, 2] * 6, 9), ([1, 2] * 6, True),
                              ([1, 2] * 5, 10)]:
            with self.subTest(values=values, count=count), self.assertRaises(ValueError):
                individuals_report(values, count)
        for invalid in (float("nan"), float("inf"), True, "100"):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                individuals_report([99, 101] * 5 + [invalid], 10)

    def test_suspect_baseline_withholds_monitoring_judgment(self):
        report = individuals_report([100] * 9 + [200, 100, None], 10)
        self.assertEqual(report["baseline_flagged_rows"], [10])
        self.assertEqual(report["counts"]["baseline_review_required"], 1)
        self.assertEqual(report["counts"]["unknown"], 1)

    @staticmethod
    def sample():
        return "timestamp,value\n" + "".join(
            f"2026-01-01T00:{i:02d}:00Z,{99 if i % 2 else 101}\n" for i in range(11))

    def test_csv_provenance_and_missing_value(self):
        raw = (self.sample() + "2026-01-01T00:11:00Z,\n").encode()
        report = csv_report(raw, 10, "synthetic")
        self.assertEqual(report["counts"]["unknown"], 1)
        self.assertEqual(report["data_role"], "synthetic")
        self.assertEqual(len(report["input_sha256"]), 64)
        self.assertEqual(report["observations"][0]["timestamp"], "2026-01-01T00:10:00Z")

    def test_rejects_bad_order_timezone_schema_and_nonfinite_csv(self):
        base = self.sample()
        invalid = [base + "2026-01-01T00:10:00Z,1\n", base.replace("Z", ""),
                   base.replace("timestamp,value", "time,value"),
                   base + "2026-01-01T00:11:00Z,nan\n",
                   base + "2026-01-01T00:11:00Z,1,extra\n",
                   base + "2026-01-01T00:11:00Z\n"]
        for text in invalid:
            with self.subTest(text=text[-60:]), self.assertRaises(ValueError):
                csv_report(text.encode(), 10, "synthetic")
        with self.assertRaises(ValueError):
            csv_report(base.encode(), 10, "estimated")


if __name__ == "__main__":
    unittest.main()
