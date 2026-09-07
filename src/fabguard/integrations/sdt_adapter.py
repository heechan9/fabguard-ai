"""Normalize Solar Data Tools reports without coupling the core contract to SDT."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import numpy as np


class SDTReportError(ValueError):
    """Raised when an SDT report violates the local result contract."""


_EXPECTED_KEYS = (
    "length",
    "capacity",
    "sampling",
    "quality score",
    "clearness score",
    "inverter clipping",
    "clipped fraction",
    "capacity change",
    "data quality warning",
    "time shift correction",
    "time zone correction",
)
_BOOLEAN_KEYS = (
    "inverter clipping",
    "capacity change",
    "data quality warning",
    "time shift correction",
)
_NUMERIC_KEYS = (
    "length",
    "capacity",
    "sampling",
    "quality score",
    "clearness score",
    "clipped fraction",
    "time zone correction",
)


def _as_bool(value: object, key: str) -> bool:
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, str) and value.strip().lower() in {"true", "false"}:
        return value.strip().lower() == "true"
    raise SDTReportError(f"{key} must be boolean")


def _as_finite_float(value: object, key: str) -> float:
    if isinstance(value, bool):
        raise SDTReportError(f"{key} must be numeric")
    try:
        converted = float(value)
    except (TypeError, ValueError) as exc:
        raise SDTReportError(f"{key} must be numeric") from exc
    if not np.isfinite(converted):
        raise SDTReportError(f"{key} must be finite")
    return converted


def normalize_sdt_report(report: Mapping[str, Any]) -> dict[str, object]:
    """Return a JSON-safe, versioned subset of DataHandler.report output."""
    if not isinstance(report, Mapping):
        raise SDTReportError("SDT report must be an object")
    missing = [key for key in _EXPECTED_KEYS if key not in report]
    if missing:
        raise SDTReportError(f"SDT report is missing keys: {', '.join(missing)}")

    normalized: dict[str, object] = {"schema_version": "fabguard-sdt-report/v1"}
    for key in _NUMERIC_KEYS:
        normalized[key] = _as_finite_float(report[key], key)
    for key in _BOOLEAN_KEYS:
        normalized[key] = _as_bool(report[key], key)

    if normalized["length"] < 0 or normalized["capacity"] < 0:
        raise SDTReportError("length and capacity must be non-negative")
    if normalized["sampling"] <= 0:
        raise SDTReportError("sampling must be positive")
    for key in ("quality score", "clearness score", "clipped fraction"):
        if not 0 <= normalized[key] <= 1:
            raise SDTReportError(f"{key} must be between 0 and 1")
    return normalized
