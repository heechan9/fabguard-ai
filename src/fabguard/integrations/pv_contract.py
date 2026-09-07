"""Stable, dependency-light contract for photovoltaic time-series inputs."""

from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd

PVSourceType = Literal["synthetic", "observed", "estimated", "reference"]
_ALLOWED_SOURCE_TYPES = {"synthetic", "observed", "estimated", "reference"}
_UNIT_TO_KW = {"W": 0.001, "kW": 1.0, "MW": 1000.0}


class PVContractError(ValueError):
    """Raised when PV input cannot enter the shared FabGuard boundary."""


def normalize_pv_frame(
    frame: pd.DataFrame,
    *,
    timestamp_column: str,
    power_column: str,
    source_id: str,
    source_type: PVSourceType,
    timezone: str,
    power_unit: str,
) -> pd.DataFrame:
    """Validate and normalize one PV power series to UTC and kW.

    The caller must declare source semantics, timezone, and unit. Missing power
    values are preserved for downstream quality analysis. Duplicate timestamps,
    invalid timestamps, infinite values, and ambiguous localization fail closed.
    """
    if not isinstance(source_id, str) or not source_id.strip():
        raise PVContractError("source_id must be a non-empty string")
    if source_type not in _ALLOWED_SOURCE_TYPES:
        raise PVContractError(
            "source_type must be one of synthetic, observed, estimated, reference"
        )
    if not isinstance(timezone, str) or not timezone.strip():
        raise PVContractError("timezone must be explicitly declared")
    if power_unit not in _UNIT_TO_KW:
        raise PVContractError("power_unit must be one of W, kW, MW")
    missing_columns = [
        name for name in (timestamp_column, power_column) if name not in frame.columns
    ]
    if missing_columns:
        raise PVContractError(f"missing required columns: {', '.join(missing_columns)}")

    timestamps = pd.to_datetime(frame[timestamp_column], errors="coerce")
    if timestamps.isna().any():
        raise PVContractError("timestamp column contains invalid or missing values")
    try:
        if timestamps.dt.tz is None:
            timestamps = timestamps.dt.tz_localize(
                timezone, ambiguous="raise", nonexistent="raise"
            )
        else:
            timestamps = timestamps.dt.tz_convert(timezone)
        timestamps = timestamps.dt.tz_convert("UTC")
    except (TypeError, ValueError, KeyError) as exc:
        raise PVContractError("timestamps cannot be localized with the declared timezone") from exc
    if timestamps.duplicated().any():
        raise PVContractError("duplicate timestamps are not accepted")

    power = pd.to_numeric(frame[power_column], errors="coerce")
    newly_invalid = power.isna() & frame[power_column].notna()
    if newly_invalid.any():
        raise PVContractError("power column contains non-numeric values")
    finite = power.dropna().to_numpy(dtype=float)
    if not np.isfinite(finite).all():
        raise PVContractError("power column contains infinite values")

    normalized = pd.DataFrame(
        {
            "event_time": timestamps,
            "power_kw": power.astype(float) * _UNIT_TO_KW[power_unit],
            "source_id": source_id.strip(),
            "source_type": source_type,
        }
    )
    return normalized.sort_values("event_time", kind="stable").reset_index(drop=True)
