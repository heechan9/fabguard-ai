"""Fail-closed contract for Enedis national half-hour production aggregates."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import numpy as np
import pandas as pd

DATASET_ID = "prod"
DATASET_PAGE = "https://opendata.enedis.fr/datasets/prod"
API_ENDPOINT = "https://opendata.enedis.fr/data-fair/api/v1/datasets/prod/lines"
SOLAR_LABEL = "F5 : Solaire"
TOTAL_BAND_LABEL = "P0 : Total toutes puissances"
REQUIRED_FIELDS = (
    "horodate", "filiere_de_production", "plage_de_puissance_injection",
    "total_energie_injectee_wh", "nb_points_injection",
)


class EnedisProductionContractError(ValueError):
    """Raised when Enedis rows cannot be accepted without ambiguity."""


def build_solar_total_query(*, size: int = 1000) -> dict[str, object]:
    """Build the audited Data Fair query; direct field parameters are ignored upstream."""
    if not 1 <= size <= 10000:
        raise EnedisProductionContractError("size must be between 1 and 10000")
    return {
        "size": size,
        "qs": (
            f'filiere_de_production:"{SOLAR_LABEL}" AND '
            f'plage_de_puissance_injection:"{TOTAL_BAND_LABEL}"'
        ),
        "sort": "horodate",
        "select": ",".join(REQUIRED_FIELDS),
    }


def normalize_enedis_rows(rows: Iterable[Mapping[str, Any]]) -> tuple[pd.DataFrame, dict[str, object]]:
    """Validate selected solar-total rows and normalize source offsets to UTC."""
    frame = pd.DataFrame(list(rows))
    if frame.empty:
        raise EnedisProductionContractError("Enedis response is empty")
    missing = sorted(set(REQUIRED_FIELDS).difference(frame.columns))
    if missing:
        raise EnedisProductionContractError(f"missing required fields: {', '.join(missing)}")
    if not frame["filiere_de_production"].eq(SOLAR_LABEL).all():
        raise EnedisProductionContractError("response contains a non-solar production row")
    if not frame["plage_de_puissance_injection"].eq(TOTAL_BAND_LABEL).all():
        raise EnedisProductionContractError("response contains a non-total power-band row")

    timestamps = pd.to_datetime(frame["horodate"], errors="coerce", utc=True)
    if timestamps.isna().any():
        raise EnedisProductionContractError("horodate contains invalid or timezone-naive values")
    if timestamps.duplicated().any():
        raise EnedisProductionContractError("response contains duplicate UTC timestamps")
    ordered = timestamps.sort_values(kind="stable")
    if len(ordered) > 1 and not ordered.diff().dropna().eq(pd.Timedelta(minutes=30)).all():
        raise EnedisProductionContractError("timestamps are not a continuous half-hour series")

    energy = pd.to_numeric(frame["total_energie_injectee_wh"], errors="coerce")
    points = pd.to_numeric(frame["nb_points_injection"], errors="coerce")
    if energy.isna().any() or not np.isfinite(energy.to_numpy(float)).all() or (energy < 0).any():
        raise EnedisProductionContractError("injected energy must be finite and non-negative")
    if points.isna().any() or (points < 0).any() or not np.equal(points, np.floor(points)).all():
        raise EnedisProductionContractError("injection-point count must be a non-negative integer")

    normalized = pd.DataFrame({
        "timestamp_utc": timestamps,
        "injected_energy_wh": energy.astype(float),
        "mean_power_w": energy.astype(float) * 2.0,
        "injection_points": points.astype("int64"),
        "source_timestamp": frame["horodate"].astype(str),
    }).sort_values("timestamp_utc", kind="stable").reset_index(drop=True)
    audit = {
        "schema_version": "fabguard-enedis-production/v1",
        "status": "pre_ingestion_contract_validated",
        "source_type": "estimated",
        "provider": "Enedis",
        "dataset_id": DATASET_ID,
        "dataset_page": DATASET_PAGE,
        "license": "Licence Ouverte / Open Licence 2.0",
        "geographic_scope": "France national distribution network",
        "sampling_minutes": 30,
        "timestamp_semantics": "source CET/CEST offset converted to UTC",
        "units": {"injected_energy_wh": "Wh per half-hour", "mean_power_w": "W", "injection_points": "count"},
        "normalized_rows": int(len(normalized)),
        "claim_boundary": (
            "Enedis national distribution aggregate only; not plant telemetry, SECOM external "
            "validation, field validation, panel diagnosis, or proof of PV performance."
        ),
    }
    return normalized, audit
