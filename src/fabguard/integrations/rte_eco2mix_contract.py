"""Fail-closed pre-ingestion contract for RTE éCO2mix national solar data."""

from __future__ import annotations

from collections.abc import Mapping
import unicodedata

import numpy as np
import pandas as pd

DATASET_ID = "eco2mix-national-cons-def"
API_ENDPOINT = (
    "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
    f"{DATASET_ID}/records"
)
ALLOWED_REVISION_STATUS = {"consolidated", "definitive"}


class RTEEco2MixContractError(ValueError):
    """Raised when RTE data cannot be admitted without ambiguity."""


def build_records_params(*, start_utc: str, end_utc: str, limit: int = 100) -> dict[str, object]:
    """Build one bounded, ordered Opendatasoft records request."""
    start = pd.Timestamp(start_utc)
    end = pd.Timestamp(end_utc)
    if start.tzinfo is None or end.tzinfo is None:
        raise RTEEco2MixContractError("start_utc and end_utc must include UTC offsets")
    start = start.tz_convert("UTC")
    end = end.tz_convert("UTC")
    if start >= end:
        raise RTEEco2MixContractError("start_utc must be earlier than end_utc")
    if end - start > pd.Timedelta(days=7):
        raise RTEEco2MixContractError("one RTE audit request is limited to seven days")
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
        raise RTEEco2MixContractError("limit must be an integer from 1 to 100")
    where = (
        f'date_heure >= "{start.strftime("%Y-%m-%dT%H:%M:%SZ")}" '
        f'and date_heure < "{end.strftime("%Y-%m-%dT%H:%M:%SZ")}"'
    )
    return {
        "select": "date_heure,solaire,nature",
        "where": where,
        "order_by": "date_heure",
        "limit": limit,
        "offset": 0,
    }


def _revision_status(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RTEEco2MixContractError("nature contains a missing revision state")
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    if "definit" in folded:
        return "definitive"
    if "consolid" in folded:
        return "consolidated"
    raise RTEEco2MixContractError(f"unsupported RTE revision state: {value}")


def normalize_eco2mix_records(
    records: list[Mapping[str, object]],
    *,
    expected_status: str | None = None,
    require_continuous: bool = True,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Normalize a bounded official response, including its 15-minute envelope."""
    if not isinstance(records, list) or not records:
        raise RTEEco2MixContractError("RTE records must be a non-empty list")
    if expected_status is not None and expected_status not in ALLOWED_REVISION_STATUS:
        raise RTEEco2MixContractError("expected_status must be consolidated or definitive")

    frame = pd.DataFrame(records)
    required = {"date_heure", "solaire", "nature"}
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise RTEEco2MixContractError(f"missing required RTE fields: {', '.join(missing)}")

    source_time = pd.to_datetime(frame["date_heure"], errors="coerce", utc=True)
    if source_time.isna().any():
        raise RTEEco2MixContractError("date_heure contains invalid or timezone-ambiguous values")
    if source_time.duplicated().any():
        raise RTEEco2MixContractError("RTE response contains duplicate timestamps")

    minute = source_time.dt.minute
    unsupported_minutes = sorted(set(minute).difference({0, 15, 30, 45}))
    if unsupported_minutes:
        raise RTEEco2MixContractError("RTE timestamps are outside the supported quarter-hour grid")
    structural_mask = minute.isin({15, 45})
    envelope_mode = bool(structural_mask.any())
    if envelope_mode and frame.loc[structural_mask, "solaire"].notna().any():
        raise RTEEco2MixContractError("quarter-hour structural slots unexpectedly contain solaire values")

    keep_mask = ~structural_mask if envelope_mode else pd.Series(True, index=frame.index)
    solar = pd.to_numeric(frame.loc[keep_mask, "solaire"], errors="coerce")
    if solar.isna().any() or not np.isfinite(solar.to_numpy(dtype=float)).all():
        raise RTEEco2MixContractError("solaire contains missing, non-numeric, or infinite half-hour values")
    if (solar < 0).any():
        raise RTEEco2MixContractError("solaire contains negative generation")

    statuses = frame["nature"].map(_revision_status)
    if expected_status is not None and not statuses.eq(expected_status).all():
        raise RTEEco2MixContractError("response revision state differs from expected_status")

    ordered_times = source_time.sort_values(kind="stable")
    response_cadence = 15 if envelope_mode else 30
    if require_continuous and len(ordered_times) > 1:
        gaps = ordered_times.diff().dropna()
        if not gaps.eq(pd.Timedelta(minutes=response_cadence)).all():
            raise RTEEco2MixContractError(
                f"RTE response is not a continuous {response_cadence}-minute series"
            )

    selected = frame.loc[keep_mask]
    normalized = pd.DataFrame({
        "timestamp_utc": source_time.loc[keep_mask],
        "solar_generation_mw": solar.astype(float),
        "revision_status": statuses.loc[keep_mask],
        "source_timestamp": selected["date_heure"].astype(str),
    }).sort_values("timestamp_utc", kind="stable").reset_index(drop=True)

    if require_continuous and len(normalized) > 1:
        gaps = normalized["timestamp_utc"].diff().dropna()
        if not gaps.eq(pd.Timedelta(minutes=30)).all():
            raise RTEEco2MixContractError("RTE solar timestamps are not a continuous 30-minute series")

    counts = normalized["revision_status"].value_counts().sort_index().to_dict()
    audit: dict[str, object] = {
        "schema_version": "fabguard-rte-eco2mix/v1",
        "status": "pre_ingestion_contract_validated",
        "source_type": "estimated",
        "provider": "RTE via Open Data Réseaux Énergies",
        "dataset_id": DATASET_ID,
        "api_endpoint": API_ENDPOINT,
        "geographic_scope": "France national electricity system",
        "timestamp_semantics": "source offset converted to UTC",
        "response_cadence_minutes": response_cadence,
        "sampling_minutes": 30,
        "power_unit": "MW",
        "input_rows": int(len(frame)),
        "structural_null_rows": int(structural_mask.sum()) if envelope_mode else 0,
        "normalized_rows": int(len(normalized)),
        "revision_status_counts": {str(k): int(v) for k, v in counts.items()},
        "claim_boundary": (
            "RTE national aggregate estimated/consolidated electricity data only; "
            "not plant telemetry, SECOM external validation, field validation, "
            "panel diagnosis, or proof of PV performance."
        ),
    }
    return normalized, audit
