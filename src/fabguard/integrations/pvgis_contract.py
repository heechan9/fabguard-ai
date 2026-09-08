"""Fail-closed pre-ingestion contract for JRC PVGIS hourly reference data."""

from __future__ import annotations

from collections.abc import Mapping
from hashlib import sha256
import json
from typing import Any

import numpy as np
import pandas as pd

API_VERSION = "v5_3"
API_ENDPOINT = f"https://re.jrc.ec.europa.eu/api/{API_VERSION}/seriescalc"
REQUIRED_FIELDS = ("time", "P", "G(i)", "H_sun", "T2m", "WS10m", "Int")


class PVGISContractError(ValueError):
    """Raised when a PVGIS response cannot be accepted without ambiguity."""


def build_seriescalc_params(
    *,
    latitude: float,
    longitude: float,
    startyear: int,
    endyear: int,
    peakpower_kw: float,
    loss_percent: float,
    raddatabase: str = "PVGIS-SARAH3",
) -> dict[str, object]:
    """Build the bounded PVGIS 5.3 hourly-PV request used by the first live audit."""
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        raise PVGISContractError("coordinates are outside latitude/longitude bounds")
    if startyear > endyear:
        raise PVGISContractError("startyear must not exceed endyear")
    if peakpower_kw <= 0:
        raise PVGISContractError("peakpower_kw must be positive")
    if not (0 <= loss_percent <= 100):
        raise PVGISContractError("loss_percent must be between 0 and 100")
    if not raddatabase.startswith("PVGIS-"):
        raise PVGISContractError("raddatabase must be an explicit PVGIS database")
    return {
        "lat": float(latitude),
        "lon": float(longitude),
        "startyear": int(startyear),
        "endyear": int(endyear),
        "pvcalculation": 1,
        "peakpower": float(peakpower_kw),
        "loss": float(loss_percent),
        "raddatabase": raddatabase,
        "outputformat": "json",
        "browser": 0,
    }


def normalize_pvgis_payload(
    payload: Mapping[str, Any],
    *,
    request_params: Mapping[str, object],
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Validate official seriescalc JSON and return an hourly UTC reference frame."""
    if not isinstance(payload, Mapping):
        raise PVGISContractError("PVGIS payload must be a JSON object")
    for key in ("inputs", "outputs", "meta"):
        if key not in payload:
            raise PVGISContractError(f"PVGIS payload is missing top-level '{key}'")

    outputs = payload["outputs"]
    if not isinstance(outputs, Mapping) or not isinstance(outputs.get("hourly"), list):
        raise PVGISContractError("PVGIS outputs.hourly must be a list")
    rows = outputs["hourly"]
    if not rows:
        raise PVGISContractError("PVGIS hourly response is empty")

    frame = pd.DataFrame(rows)
    missing = [field for field in REQUIRED_FIELDS if field not in frame.columns]
    if missing:
        raise PVGISContractError(f"missing required hourly fields: {', '.join(missing)}")

    timestamps = pd.to_datetime(frame["time"], format="%Y%m%d:%H%M", errors="coerce", utc=True)
    if timestamps.isna().any():
        raise PVGISContractError("time contains values outside YYYYMMDD:HHMM")
    if timestamps.duplicated().any():
        raise PVGISContractError("PVGIS response contains duplicate timestamps")
    ordered = timestamps.sort_values(kind="stable")
    intervals = ordered.diff().dropna()
    if not intervals.eq(pd.Timedelta(hours=1)).all():
        raise PVGISContractError("PVGIS timestamps are not a continuous hourly UTC series")

    numeric: dict[str, pd.Series] = {}
    for field in REQUIRED_FIELDS[1:]:
        values = pd.to_numeric(frame[field], errors="coerce")
        if values.isna().any() or not np.isfinite(values.to_numpy(dtype=float)).all():
            raise PVGISContractError(f"{field} contains missing, non-numeric, or infinite values")
        numeric[field] = values.astype(float)
    for field in ("P", "G(i)", "H_sun", "WS10m"):
        if (numeric[field] < 0).any():
            raise PVGISContractError(f"{field} contains negative values")
    if not numeric["Int"].isin([0.0, 1.0]).all():
        raise PVGISContractError("Int must contain only PVGIS reconstruction flags 0 or 1")

    normalized = pd.DataFrame({
        "timestamp_utc": timestamps,
        "power_w": numeric["P"],
        "plane_irradiance_w_m2": numeric["G(i)"],
        "sun_height_deg": numeric["H_sun"],
        "air_temperature_c": numeric["T2m"],
        "wind_speed_10m_m_s": numeric["WS10m"],
        "reconstructed": numeric["Int"].astype("int8"),
    }).sort_values("timestamp_utc", kind="stable").reset_index(drop=True)

    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    audit: dict[str, object] = {
        "schema_version": "fabguard-pvgis-series/v1",
        "status": "pre_ingestion_contract_validated",
        "source_type": "reference",
        "provider": "European Commission Joint Research Centre",
        "api_version": API_VERSION,
        "endpoint": API_ENDPOINT,
        "request_params": dict(request_params),
        "timestamp_semantics": "UTC hourly timestamp",
        "units": {
            "power_w": "W",
            "plane_irradiance_w_m2": "W/m2",
            "sun_height_deg": "degree",
            "air_temperature_c": "degree C",
            "wind_speed_10m_m_s": "m/s",
        },
        "input_rows": int(len(frame)),
        "normalized_rows": int(len(normalized)),
        "reconstructed_rows": int(normalized["reconstructed"].sum()),
        "response_canonical_sha256": sha256(canonical.encode("utf-8")).hexdigest(),
        "claim_boundary": (
            "JRC PVGIS modelled reference data only; not direct observation, "
            "SECOM external validation, field validation, or proof of PV performance."
        ),
    }
    return normalized, audit
