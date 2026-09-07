import unittest

import numpy as np
import pandas as pd

from fabguard.integrations.pv_contract import PVContractError, normalize_pv_frame
from fabguard.integrations.sdt_adapter import SDTReportError, normalize_sdt_report


class PVContractTest(unittest.TestCase):
    def test_normalizes_declared_timezone_and_unit(self) -> None:
        frame = pd.DataFrame(
            {
                "timestamp": ["2026-01-01 10:00", "2026-01-01 10:15"],
                "power": [1000.0, None],
            }
        )

        result = normalize_pv_frame(
            frame,
            timestamp_column="timestamp",
            power_column="power",
            source_id="fixture-au",
            source_type="synthetic",
            timezone="Australia/Melbourne",
            power_unit="W",
        )

        self.assertEqual(
            list(result.columns),
            ["event_time", "power_kw", "source_id", "source_type"],
        )
        self.assertEqual(str(result.loc[0, "event_time"]), "2025-12-31 23:00:00+00:00")
        self.assertEqual(result.loc[0, "power_kw"], 1.0)
        self.assertTrue(pd.isna(result.loc[1, "power_kw"]))
        self.assertEqual(result.loc[0, "source_type"], "synthetic")

    def test_rejects_ambiguous_or_invalid_inputs(self) -> None:
        base = pd.DataFrame({"timestamp": ["2026-01-01"], "power": [1.0]})
        cases = [
            ({"source_type": "unknown"}, "source_type"),
            ({"power_unit": "GW"}, "power_unit"),
            ({"source_id": ""}, "source_id"),
            ({"timezone": ""}, "timezone"),
        ]
        defaults = {
            "timestamp_column": "timestamp",
            "power_column": "power",
            "source_id": "pv-1",
            "source_type": "observed",
            "timezone": "UTC",
            "power_unit": "kW",
        }
        for override, message in cases:
            with self.subTest(override=override):
                with self.assertRaisesRegex(PVContractError, message):
                    normalize_pv_frame(base, **(defaults | override))

        invalid = pd.DataFrame({"timestamp": ["bad"], "power": [1.0]})
        with self.assertRaisesRegex(PVContractError, "timestamp"):
            normalize_pv_frame(invalid, **defaults)

        non_numeric = pd.DataFrame({"timestamp": ["2026-01-01"], "power": ["bad"]})
        with self.assertRaisesRegex(PVContractError, "non-numeric"):
            normalize_pv_frame(non_numeric, **defaults)

        duplicate = pd.DataFrame(
            {"timestamp": ["2026-01-01", "2026-01-01"], "power": [1.0, 2.0]}
        )
        with self.assertRaisesRegex(PVContractError, "duplicate"):
            normalize_pv_frame(duplicate, **defaults)

        infinite = pd.DataFrame({"timestamp": ["2026-01-01"], "power": [np.inf]})
        with self.assertRaisesRegex(PVContractError, "infinite"):
            normalize_pv_frame(infinite, **defaults)


class SDTReportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.report = {
            "length": 0.33,
            "capacity": 0.96,
            "sampling": 15,
            "quality score": 1.0,
            "clearness score": 0.99,
            "inverter clipping": False,
            "clipped fraction": 0.0,
            "capacity change": False,
            "data quality warning": "True",
            "time shift correction": np.bool_(False),
            "time zone correction": 0,
        }

    def test_normalizes_numpy_and_string_booleans(self) -> None:
        result = normalize_sdt_report(self.report)

        self.assertEqual(result["schema_version"], "fabguard-sdt-report/v1")
        self.assertIs(result["data quality warning"], True)
        self.assertIs(result["time shift correction"], False)
        self.assertEqual(result["sampling"], 15.0)

    def test_fails_closed_on_missing_nonfinite_and_out_of_range_values(self) -> None:
        missing = dict(self.report)
        del missing["capacity"]
        with self.assertRaisesRegex(SDTReportError, "missing keys"):
            normalize_sdt_report(missing)

        nonfinite = dict(self.report, capacity=np.inf)
        with self.assertRaisesRegex(SDTReportError, "finite"):
            normalize_sdt_report(nonfinite)

        out_of_range = dict(self.report)
        out_of_range["quality score"] = 1.1
        with self.assertRaisesRegex(SDTReportError, "between 0 and 1"):
            normalize_sdt_report(out_of_range)


if __name__ == "__main__":
    unittest.main()
