"""Dependency-free boundary for evaluating a future Fledge integration.

This module deliberately does not import Fledge. It converts a small, documented
reading envelope into a stable table that FabGuard can validate independently.
The upstream plugin lifecycle remains future work pending maintainer discussion.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

import pandas as pd


class FledgeContractError(ValueError):
    """Raised when a candidate Fledge reading violates the local contract."""


def normalize_fledge_readings(
    readings: Iterable[Mapping[str, object]],
    *,
    required_measurements: Iterable[str] = (),
) -> pd.DataFrame:
    """Normalize candidate Fledge readings without adding a Fledge dependency.

    Expected envelope fields are ``asset_code``, ``reading`` and either
    ``user_ts`` or ``ts``. Timestamps must be ISO 8601 strings; numeric epoch
    values are deliberately rejected because their unit is ambiguous. Measurement values must be numeric or null. Missing
    required measurements fail closed so malformed edge data cannot silently
    enter an experiment or inference path.
    """

    required = tuple(dict.fromkeys(required_measurements))
    rows: list[dict[str, object]] = []
    feature_order = [f"measurement__{name}" for name in required]

    for index, item in enumerate(readings):
        if not isinstance(item, Mapping):
            raise FledgeContractError(f"reading[{index}] must be an object")

        asset_code = item.get("asset_code")
        measurements = item.get("reading")
        timestamp_value = item.get("user_ts", item.get("ts"))
        if not isinstance(asset_code, str) or not asset_code.strip():
            raise FledgeContractError(f"reading[{index}].asset_code must be a non-empty string")
        if not isinstance(measurements, Mapping):
            raise FledgeContractError(f"reading[{index}].reading must be an object")
        if timestamp_value is None:
            raise FledgeContractError(f"reading[{index}] requires user_ts or ts")
        if not isinstance(timestamp_value, str):
            raise FledgeContractError(
                f"reading[{index}] timestamp must be an ISO 8601 string; numeric epoch units are ambiguous"
            )

        timestamp = pd.to_datetime(timestamp_value, utc=True, errors="coerce")
        if pd.isna(timestamp):
            raise FledgeContractError(f"reading[{index}] has an invalid timestamp")

        missing = [name for name in required if name not in measurements]
        if missing:
            raise FledgeContractError(
                f"reading[{index}] is missing required measurements: {', '.join(missing)}"
            )

        row: dict[str, object] = {
            "sample_id": f"{asset_code}:{timestamp.isoformat()}",
            "asset_code": asset_code,
            "event_time": timestamp,
        }
        for name, value in measurements.items():
            if not isinstance(name, str) or not name:
                raise FledgeContractError(f"reading[{index}] contains an invalid measurement name")
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
                raise FledgeContractError(
                    f"reading[{index}].reading.{name} must be numeric or null"
                )
            feature = f"measurement__{name}"
            row[feature] = value
            if feature not in feature_order:
                feature_order.append(feature)
        rows.append(row)

    columns = ["sample_id", "asset_code", "event_time", *feature_order]
    if not rows:
        return pd.DataFrame(columns=columns)

    frame = pd.DataFrame(rows).reindex(columns=columns)
    if frame["sample_id"].duplicated().any():
        raise FledgeContractError("duplicate asset_code and timestamp pairs are not accepted")
    return frame.sort_values(["event_time", "asset_code"], kind="stable").reset_index(drop=True)
