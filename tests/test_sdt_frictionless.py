import importlib.util
import tempfile
import unittest
from pathlib import Path

from fabguard.integrations.sdt_smoke_cli import (
    FrictionlessValidationError,
    _validate_frictionless,
)


@unittest.skipUnless(
    importlib.util.find_spec("frictionless"),
    "optional Frictionless dependency is not installed",
)
class FrictionlessGateTest(unittest.TestCase):
    def test_accepts_named_timestamp_and_numeric_power(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pv.csv"
            path.write_text(
                "timestamp,dc_power\n"
                "2025-01-01 00:00:00,0.0\n"
                "2025-01-01 00:15:00,1.0\n",
                encoding="utf-8",
            )

            result = _validate_frictionless(path)

            self.assertIs(result["valid"], True)
            self.assertEqual(result["version"], "5.19.0")
            self.assertEqual(result["resource_path"], "pv.csv")
            self.assertEqual(result["error_count"], 0)

    def test_rejects_blank_header_before_sdt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pv.csv"
            path.write_text(
                ",dc_power\n"
                "2025-01-01 00:00:00,0.0\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                FrictionlessValidationError, "blank-label"
            ):
                _validate_frictionless(path)


if __name__ == "__main__":
    unittest.main()
