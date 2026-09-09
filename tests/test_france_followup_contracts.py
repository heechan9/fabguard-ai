import gzip
import io
import unittest

import pandas as pd

from enedis_production_contract import (
    EnedisProductionContractError, SOLAR_LABEL, TOTAL_BAND_LABEL,
    build_solar_total_query, normalize_enedis_rows,
)
from meteo_france_hourly_collect import MeteoFranceHourlyError, normalize_hourly_resource


class EnedisContractTest(unittest.TestCase):
    def rows(self):
        return [
            {"horodate": "2024-01-01T00:00:00+01:00", "filiere_de_production": SOLAR_LABEL,
             "plage_de_puissance_injection": TOTAL_BAND_LABEL, "total_energie_injectee_wh": 10, "nb_points_injection": 2},
            {"horodate": "2024-01-01T00:30:00+01:00", "filiere_de_production": SOLAR_LABEL,
             "plage_de_puissance_injection": TOTAL_BAND_LABEL, "total_energie_injectee_wh": 15, "nb_points_injection": 2},
        ]

    def test_query_uses_qs_and_normalizes_energy(self):
        query = build_solar_total_query(size=500)
        self.assertIn("filiere_de_production", query["qs"])
        normalized, audit = normalize_enedis_rows(self.rows())
        self.assertEqual(normalized["mean_power_w"].tolist(), [20.0, 30.0])
        self.assertEqual(audit["license"], "Licence Ouverte / Open Licence 2.0")

    def test_wrong_scope_gap_and_negative_fail_closed(self):
        rows = self.rows(); rows[0]["filiere_de_production"] = "F1 : Hydraulique"
        with self.assertRaises(EnedisProductionContractError): normalize_enedis_rows(rows)
        rows = self.rows(); rows[1]["horodate"] = "2024-01-01T01:00:00+01:00"
        with self.assertRaises(EnedisProductionContractError): normalize_enedis_rows(rows)
        rows = self.rows(); rows[1]["total_energie_injectee_wh"] = -1
        with self.assertRaises(EnedisProductionContractError): normalize_enedis_rows(rows)


def weather_gzip(*, missing=False):
    idx = pd.date_range("2024-01-01", "2025-01-01", freq="h", inclusive="left", tz="UTC")
    if missing: idx = idx[:-1]
    frame = pd.DataFrame({
        "NUM_POSTE": "75114001", "NOM_USUEL": "PARIS-MONTSOURIS", "LAT": 48.82,
        "LON": 2.34, "ALTI": 75, "AAAAMMJJHH": idx.strftime("%Y%m%d%H"),
        "T": 12.0, "GLO": 36.0, "QT": 1, "QGLO": 1,
    })
    buf = io.BytesIO(); frame.to_csv(buf, sep=";", index=False)
    return gzip.compress(buf.getvalue())


class MeteoFranceContractTest(unittest.TestCase):
    def test_complete_station_year_and_conversion(self):
        normalized, audit = normalize_hourly_resource(weather_gzip(), station_id="75114001", year=2024)
        self.assertEqual(len(normalized), 8784)
        self.assertAlmostEqual(normalized["global_irradiance_mean_w_m2"].iloc[0], 100.0)
        self.assertEqual(audit["source_type"], "observed")

    def test_missing_hour_and_negative_radiation_fail_closed(self):
        with self.assertRaises(MeteoFranceHourlyError):
            normalize_hourly_resource(weather_gzip(missing=True), station_id="75114001", year=2024)
        raw = gzip.decompress(weather_gzip()).decode().replace(";36.0;1;1\n", ";-1;1;1\n", 1)
        with self.assertRaises(MeteoFranceHourlyError):
            normalize_hourly_resource(gzip.compress(raw.encode()), station_id="75114001", year=2024)


if __name__ == "__main__": unittest.main()
