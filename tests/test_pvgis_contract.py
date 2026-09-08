import unittest

import pandas as pd

from fabguard.integrations.pvgis_contract import (
    PVGISContractError,
    build_seriescalc_params,
    normalize_pvgis_payload,
)


class PVGISContractTest(unittest.TestCase):
    def params(self) -> dict[str, object]:
        return build_seriescalc_params(
            latitude=48.8566,
            longitude=2.3522,
            startyear=2020,
            endyear=2020,
            peakpower_kw=1.0,
            loss_percent=14.0,
        )

    def payload(self) -> dict[str, object]:
        return {
            "inputs": {"location": {"latitude": 48.8566, "longitude": 2.3522}},
            "outputs": {
                "hourly": [
                    {"time": "20200101:0010", "P": 0, "G(i)": 0, "H_sun": 0, "T2m": 5.2, "WS10m": 2.1, "Int": 0},
                    {"time": "20200101:0110", "P": 0, "G(i)": 0, "H_sun": 0, "T2m": 5.0, "WS10m": 2.0, "Int": 1},
                    {"time": "20200101:0210", "P": 2.5, "G(i)": 4.0, "H_sun": 1.2, "T2m": 4.9, "WS10m": 1.8, "Int": 0},
                ]
            },
            "meta": {"inputs": {}, "outputs": {}},
        }

    def test_normalizes_reference_payload_and_preserves_units(self) -> None:
        normalized, audit = normalize_pvgis_payload(
            self.payload(), request_params=self.params()
        )
        self.assertEqual(len(normalized), 3)
        self.assertEqual(audit["source_type"], "reference")
        self.assertEqual(audit["reconstructed_rows"], 1)
        self.assertEqual(audit["units"]["power_w"], "W")
        self.assertEqual(str(normalized["timestamp_utc"].dt.tz), "UTC")
        self.assertTrue(normalized["timestamp_utc"].is_monotonic_increasing)

    def test_request_builder_fails_closed(self) -> None:
        with self.assertRaisesRegex(PVGISContractError, "coordinates"):
            build_seriescalc_params(
                latitude=91, longitude=2, startyear=2020, endyear=2020,
                peakpower_kw=1, loss_percent=14,
            )
        with self.assertRaisesRegex(PVGISContractError, "startyear"):
            build_seriescalc_params(
                latitude=48, longitude=2, startyear=2021, endyear=2020,
                peakpower_kw=1, loss_percent=14,
            )

    def test_missing_structure_or_fields_fails_closed(self) -> None:
        broken = self.payload()
        del broken["meta"]
        with self.assertRaisesRegex(PVGISContractError, "top-level 'meta'"):
            normalize_pvgis_payload(broken, request_params=self.params())

        broken = self.payload()
        del broken["outputs"]["hourly"][0]["P"]
        with self.assertRaisesRegex(PVGISContractError, "missing required"):
            normalize_pvgis_payload(broken, request_params=self.params())

    def test_duplicate_or_non_hourly_time_fails_closed(self) -> None:
        duplicate = self.payload()
        duplicate["outputs"]["hourly"][1]["time"] = "20200101:0010"
        with self.assertRaisesRegex(PVGISContractError, "duplicate"):
            normalize_pvgis_payload(duplicate, request_params=self.params())

        gap = self.payload()
        gap["outputs"]["hourly"][1]["time"] = "20200101:0210"
        gap["outputs"]["hourly"][2]["time"] = "20200101:0310"
        with self.assertRaisesRegex(PVGISContractError, "continuous hourly"):
            normalize_pvgis_payload(gap, request_params=self.params())

    def test_invalid_physical_values_fail_closed(self) -> None:
        negative = self.payload()
        negative["outputs"]["hourly"][0]["G(i)"] = -1
        with self.assertRaisesRegex(PVGISContractError, "negative"):
            normalize_pvgis_payload(negative, request_params=self.params())

        bad_flag = self.payload()
        bad_flag["outputs"]["hourly"][0]["Int"] = 2
        with self.assertRaisesRegex(PVGISContractError, "0 or 1"):
            normalize_pvgis_payload(bad_flag, request_params=self.params())


if __name__ == "__main__":
    unittest.main()
