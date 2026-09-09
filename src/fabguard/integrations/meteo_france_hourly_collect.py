"""Collect and normalize one official Météo-France hourly station resource."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

DATASET_ID = "6569b4473bedf2e7abad3b72"
RESOURCE_ID = "a77b4d44-d361-4e59-b6cc-cbbf435a2d89"
RESOURCE_URL = "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_75_previous-2020-2024.csv.gz"
STATION_ID = "75114001"
STATION_NAME = "PARIS-MONTSOURIS"


class MeteoFranceHourlyError(ValueError):
    """Raised when the official station resource is incomplete or ambiguous."""


def normalize_hourly_resource(raw_gzip: bytes, *, station_id: str, year: int) -> tuple[pd.DataFrame, dict[str, object]]:
    """Select one station-year and preserve radiation plus its explicit conversion."""
    try:
        decoded = gzip.decompress(raw_gzip)
        frame = pd.read_csv(io.BytesIO(decoded), sep=";", dtype={"NUM_POSTE": str})
    except (OSError, UnicodeError, pd.errors.ParserError) as exc:
        raise MeteoFranceHourlyError("resource is not a readable gzip semicolon CSV") from exc
    required = {"NUM_POSTE", "NOM_USUEL", "LAT", "LON", "ALTI", "AAAAMMJJHH", "T", "GLO", "QT", "QGLO"}
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise MeteoFranceHourlyError(f"missing required fields: {', '.join(missing)}")
    selected = frame.loc[frame["NUM_POSTE"].eq(str(station_id))].copy()
    timestamps = pd.to_datetime(selected["AAAAMMJJHH"].astype(str), format="%Y%m%d%H", errors="coerce", utc=True)
    selected = selected.loc[timestamps.dt.year.eq(year)].copy()
    timestamps = timestamps.loc[selected.index]
    if selected.empty:
        raise MeteoFranceHourlyError("requested station-year is absent")
    expected = pd.date_range(f"{year}-01-01", f"{year + 1}-01-01", freq="h", inclusive="left", tz="UTC")
    if timestamps.duplicated().any() or not pd.DatetimeIndex(timestamps.sort_values()).equals(expected):
        raise MeteoFranceHourlyError("station-year is not a unique complete UTC hourly grid")
    if selected["NOM_USUEL"].nunique() != 1:
        raise MeteoFranceHourlyError("station name changes inside selected year")
    temperature = pd.to_numeric(selected["T"], errors="coerce")
    radiation = pd.to_numeric(selected["GLO"], errors="coerce")
    if temperature.isna().any() or not np.isfinite(temperature.to_numpy(float)).all():
        raise MeteoFranceHourlyError("air temperature contains missing or invalid values")
    if radiation.isna().any() or not np.isfinite(radiation.to_numpy(float)).all() or (radiation < 0).any():
        raise MeteoFranceHourlyError("global radiation contains missing, invalid, or negative values")
    normalized = pd.DataFrame({
        "timestamp_utc": timestamps,
        "station_id": selected["NUM_POSTE"].astype(str),
        "station_name": selected["NOM_USUEL"].astype(str),
        "latitude": pd.to_numeric(selected["LAT"], errors="raise"),
        "longitude": pd.to_numeric(selected["LON"], errors="raise"),
        "altitude_m": pd.to_numeric(selected["ALTI"], errors="raise"),
        "air_temperature_c": temperature.astype(float),
        "global_radiation_j_cm2": radiation.astype(float),
        "global_irradiance_mean_w_m2": radiation.astype(float) * (10000.0 / 3600.0),
        "temperature_quality_code": selected["QT"],
        "radiation_quality_code": selected["QGLO"],
    }).sort_values("timestamp_utc", kind="stable").reset_index(drop=True)
    audit = {
        "schema_version": "fabguard-meteofrance-hourly/v1",
        "status": "meteo_france_resource_contract_validated",
        "source_type": "observed",
        "provider": "Météo-France",
        "dataset_id": DATASET_ID,
        "resource_id": RESOURCE_ID,
        "resource_url": RESOURCE_URL,
        "license": "Licence Ouverte / Open Licence 2.0",
        "station_id": str(station_id),
        "station_name": str(normalized["station_name"].iloc[0]),
        "year": year,
        "normalized_rows": int(len(normalized)),
        "sampling_minutes": 60,
        "timestamp_semantics": "metropolitan Météo-France hourly timestamp interpreted as UTC",
        "conversion": "hourly GLO J/cm2 multiplied by 10000/3600 to hourly mean W/m2",
        "claim_boundary": (
            "Météo-France station weather observations only; not PV generation, plant telemetry, "
            "SECOM external validation, field validation, or proof of PV performance."
        ),
    }
    return normalized, audit


def collect(*, output: Path, audit_output: Path, year: int = 2024, station_id: str = STATION_ID) -> dict[str, object]:
    request = Request(RESOURCE_URL, headers={"User-Agent": "FabGuard-AI/0.1 weather audit"})
    with urlopen(request, timeout=180) as response:
        if response.status != 200:
            raise MeteoFranceHourlyError(f"Météo-France returned HTTP {response.status}")
        raw = response.read()
    normalized, audit = normalize_hourly_resource(raw, station_id=station_id, year=year)
    output.parent.mkdir(parents=True, exist_ok=True)
    normalized.to_csv(output, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    audit.update({
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "normalized_file": output.name,
        "normalized_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    })
    audit_output.parent.mkdir(parents=True, exist_ok=True)
    audit_output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return audit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--station-id", default=STATION_ID)
    args = parser.parse_args()
    print(json.dumps(collect(output=args.output, audit_output=args.audit_output, year=args.year, station_id=args.station_id), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
