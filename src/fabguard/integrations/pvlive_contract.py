"""Fail-closed pre-ingestion contract for Sheffield Solar PV_Live estimates."""

from __future__ import annotations

import numpy as np
import pandas as pd

VALID_ENTITY_TYPES = {"gsp", "pes"}
DEFAULT_PERIOD_MINUTES = 30


class PVLiveContractError(ValueError):
    """Raised when PV_Live data cannot be accepted without ambiguity."""


def _parse_utc(series: pd.Series, field: str) -> pd.Series:
    parsed = pd.to_datetime(series, errors="coerce", utc=True)
    if parsed.isna().any():
        raise PVLiveContractError(f"{field} contains invalid values")
    return parsed


def normalize_pvlive_frame(
    frame: pd.DataFrame,
    *,
    entity_type: str,
    entity_id: int,
    period_minutes: int = DEFAULT_PERIOD_MINUTES,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Validate and normalize versioned PV_Live API rows.

    PV_Live labels an estimate with the UTC end of its settlement interval and
    can revise historical estimates. Every unique updated_gmt version is kept.
    """
    if entity_type not in VALID_ENTITY_TYPES:
        raise PVLiveContractError("entity_type must be 'gsp' or 'pes'")
    if isinstance(entity_id, bool) or not isinstance(entity_id, (int, np.integer)):
        raise PVLiveContractError("entity_id must be an integer")
    if entity_id < 0:
        raise PVLiveContractError("entity_id must be non-negative")
    if period_minutes != 30:
        raise PVLiveContractError("FabGuard PV_Live v1 accepts only 30-minute estimates")

    id_column = f"{entity_type}_id"
    required = {id_column, "datetime_gmt", "generation_mw", "updated_gmt"}
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise PVLiveContractError(f"missing required columns: {', '.join(missing)}")
    if frame.empty:
        raise PVLiveContractError("PV_Live response is empty")

    ids = pd.to_numeric(frame[id_column], errors="coerce")
    if ids.isna().any() or (ids % 1 != 0).any():
        raise PVLiveContractError(f"{id_column} contains non-integer values")
    if not ids.eq(entity_id).all():
        raise PVLiveContractError("response contains an unexpected entity ID")

    generation = pd.to_numeric(frame["generation_mw"], errors="coerce")
    if generation.isna().any():
        raise PVLiveContractError("generation_mw contains missing or non-numeric values")
    values = generation.to_numpy(dtype=float)
    if not np.isfinite(values).all():
        raise PVLiveContractError("generation_mw contains infinite values")
    if (generation < 0).any():
        raise PVLiveContractError("generation_mw contains negative estimates")

    interval_end = _parse_utc(frame["datetime_gmt"], "datetime_gmt")
    updated_at = _parse_utc(frame["updated_gmt"], "updated_gmt")
    if not (
        interval_end.dt.minute.mod(period_minutes).eq(0)
        & interval_end.dt.second.eq(0)
        & interval_end.dt.microsecond.eq(0)
    ).all():
        raise PVLiveContractError("datetime_gmt is not aligned to a 30-minute UTC boundary")
    if (updated_at < interval_end).any():
        raise PVLiveContractError("updated_gmt predates its interval end")

    normalized = pd.DataFrame(
        {
            "entity_type": entity_type,
            "entity_id": ids.astype("int64"),
            "interval_end_utc": interval_end,
            "generation_mw": generation.astype(float),
            "updated_at_utc": updated_at,
        }
    ).sort_values(["interval_end_utc", "updated_at_utc"], kind="stable")
    identity = ["entity_type", "entity_id", "interval_end_utc", "updated_at_utc"]
    if normalized.duplicated(identity).any():
        raise PVLiveContractError("duplicate revision identity in PV_Live response")

    revisions = normalized.groupby(
        ["entity_type", "entity_id", "interval_end_utc"], sort=False
    ).size()
    audit: dict[str, object] = {
        "schema_version": "fabguard-pvlive-contract/v1",
        "source_type": "estimated",
        "geographic_scope": "GB electricity network",
        "entity_type": entity_type,
        "entity_id": int(entity_id),
        "period_minutes": period_minutes,
        "timestamp_semantics": "UTC interval end",
        "power_unit": "MW",
        "input_rows": int(len(frame)),
        "normalized_rows": int(len(normalized)),
        "intervals": int(len(revisions)),
        "revised_intervals": int((revisions > 1).sum()),
        "revision_rows_beyond_first": int((revisions - 1).sum()),
        "claim_boundary": (
            "PV_Live model estimates only; not direct meter observations, "
            "SECOM external validation, field validation, or proof of PV performance."
        ),
    }
    return normalized.reset_index(drop=True), audit


def latest_pvlive_snapshot(normalized: pd.DataFrame) -> pd.DataFrame:
    """Select the latest recorded revision per entity and interval."""
    required = {
        "entity_type", "entity_id", "interval_end_utc",
        "generation_mw", "updated_at_utc",
    }
    missing = sorted(required.difference(normalized.columns))
    if missing:
        raise PVLiveContractError(f"missing normalized columns: {', '.join(missing)}")
    if normalized.empty:
        raise PVLiveContractError("normalized PV_Live frame is empty")
    keys = ["entity_type", "entity_id", "interval_end_utc"]
    return (
        normalized.sort_values(keys + ["updated_at_utc"], kind="stable")
        .drop_duplicates(keys, keep="last")
        .reset_index(drop=True)
    )
