"""Reproducible normalization for DKASC Alice Springs aggregate PV data."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

DEFAULT_TIMESTAMP_COLUMN = "timestamp"
DEFAULT_POWER_COLUMN = "241_DKA_Totals_PV_Active_Power"


class DKASCNormalizationError(ValueError):
    """Raised when DKASC input cannot be normalized without ambiguity."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_dkasc_frame(
    frame: pd.DataFrame,
    *,
    start: str,
    end: str,
    timestamp_column: str = DEFAULT_TIMESTAMP_COLUMN,
    power_column: str = DEFAULT_POWER_COLUMN,
    interval_minutes: int = 5,
    max_clock_skew_seconds: int = 30,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Normalize one local-wall-clock DKASC series to a complete regular grid.

    Off-grid readings within the declared clock-skew allowance are rounded to
    the nearest interval. Within one resulting slot a finite value may replace
    a null placeholder. Distinct finite values in the same slot fail closed.
    Raw negative power is preserved while the SDT-specific column clips it to
    zero.
    """
    if interval_minutes <= 0:
        raise DKASCNormalizationError("interval_minutes must be positive")
    if max_clock_skew_seconds < 0:
        raise DKASCNormalizationError("max_clock_skew_seconds must be non-negative")
    missing = [
        name for name in (timestamp_column, power_column) if name not in frame.columns
    ]
    if missing:
        raise DKASCNormalizationError(
            f"missing required columns: {', '.join(missing)}"
        )

    source_timestamp = pd.to_datetime(frame[timestamp_column], errors="coerce")
    if source_timestamp.isna().any():
        raise DKASCNormalizationError("timestamp column contains invalid values")
    power = pd.to_numeric(frame[power_column], errors="coerce")
    newly_invalid = power.isna() & frame[power_column].notna()
    if newly_invalid.any():
        raise DKASCNormalizationError("power column contains non-numeric values")
    finite = power.dropna().to_numpy(dtype=float)
    if not np.isfinite(finite).all():
        raise DKASCNormalizationError("power column contains infinite values")

    start_ts = pd.Timestamp(start)
    end_ts = pd.Timestamp(end)
    if start_ts.tzinfo is not None or end_ts.tzinfo is not None:
        raise DKASCNormalizationError("start and end must use source local wall time")
    if end_ts <= start_ts:
        raise DKASCNormalizationError("end must be after start")

    work = pd.DataFrame(
        {"source_timestamp": source_timestamp, "power_raw": power.astype(float)}
    )
    work = work[
        (work["source_timestamp"] >= start_ts)
        & (work["source_timestamp"] < end_ts)
    ].copy()
    if work.empty:
        raise DKASCNormalizationError("no readings fall inside the requested range")

    frequency = f"{interval_minutes}min"
    work["timestamp"] = work["source_timestamp"].dt.round(frequency)
    skew = (work["timestamp"] - work["source_timestamp"]).abs().dt.total_seconds()
    if (skew > max_clock_skew_seconds).any():
        raise DKASCNormalizationError(
            "off-grid timestamp exceeds the configured clock-skew allowance"
        )
    work["timestamp_adjusted"] = work["timestamp"] != work["source_timestamp"]

    collision_groups = 0
    recovered_null_collisions = 0
    for _, group in work.groupby("timestamp", sort=False):
        if len(group) <= 1:
            continue
        collision_groups += 1
        values = group["power_raw"].dropna().to_numpy(dtype=float)
        if len(values) > 1 and not np.allclose(
            values, values[0], rtol=0.0, atol=1e-9
        ):
            raise DKASCNormalizationError(
                "multiple distinct finite power values map to the same interval"
            )
        if len(values) == 1 and group["power_raw"].isna().any():
            recovered_null_collisions += 1

    work["has_value"] = work["power_raw"].notna()
    work = work.sort_values(
        ["timestamp", "has_value", "timestamp_adjusted", "source_timestamp"],
        ascending=[True, False, True, True],
        kind="stable",
    ).drop_duplicates("timestamp", keep="first")

    expected = pd.date_range(
        start=start_ts,
        end=end_ts,
        freq=frequency,
        inclusive="left",
        name="timestamp",
    )
    normalized = work.set_index("timestamp").reindex(expected)
    normalized["timestamp_missing_from_source"] = normalized[
        "source_timestamp"
    ].isna()
    normalized["timestamp_adjusted"] = (
        normalized["timestamp_adjusted"].eq(True).astype(bool)
    )
    normalized["power_sdt"] = normalized["power_raw"].clip(lower=0)
    normalized = normalized.reset_index()[
        [
            "timestamp",
            "source_timestamp",
            "power_raw",
            "power_sdt",
            "timestamp_adjusted",
            "timestamp_missing_from_source",
        ]
    ]

    audit: dict[str, object] = {
        "schema_version": "fabguard-dkasc-normalization/v1",
        "input_rows_in_range": int(len(frame.loc[
            (source_timestamp >= start_ts) & (source_timestamp < end_ts)
        ])),
        "normalized_rows": int(len(normalized)),
        "interval_minutes": interval_minutes,
        "off_grid_timestamps_rounded": int(work["timestamp_adjusted"].sum()),
        "collision_groups": collision_groups,
        "valid_value_preferred_over_same_slot_null": recovered_null_collisions,
        "missing_timestamp_slots": int(
            normalized["timestamp_missing_from_source"].sum()
        ),
        "remaining_missing_power": int(normalized["power_sdt"].isna().sum()),
        "negative_values_clipped_for_sdt": int(
            (normalized["power_raw"] < 0).sum()
        ),
    }
    return normalized, audit


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize DKASC aggregate PV CSV")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--timestamp-column", default=DEFAULT_TIMESTAMP_COLUMN)
    parser.add_argument("--power-column", default=DEFAULT_POWER_COLUMN)
    parser.add_argument("--interval-minutes", type=int, default=5)
    parser.add_argument("--max-clock-skew-seconds", type=int, default=30)
    parser.add_argument("--timezone", default="Australia/Darwin")
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--source-accessed-at", required=True)
    args = parser.parse_args()

    if args.input.resolve() in {
        args.output.resolve(),
        args.audit_output.resolve(),
    }:
        parser.error("outputs must not overwrite the input")
    try:
        frame = pd.read_csv(
            args.input,
            usecols=[args.timestamp_column, args.power_column],
        )
        normalized, audit = normalize_dkasc_frame(
            frame,
            start=args.start,
            end=args.end,
            timestamp_column=args.timestamp_column,
            power_column=args.power_column,
            interval_minutes=args.interval_minutes,
            max_clock_skew_seconds=args.max_clock_skew_seconds,
        )
    except (DKASCNormalizationError, OSError, ValueError) as exc:
        parser.error(str(exc))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    normalized.to_csv(
        args.output,
        index=False,
        date_format="%Y-%m-%dT%H:%M:%S",
    )
    audit.update(
        {
            "source_file": args.input.name,
            "source_sha256": _sha256(args.input),
            "normalized_file": args.output.name,
            "normalized_sha256": _sha256(args.output),
            "source_type": "observed",
            "source_url": args.source_url,
            "source_accessed_at": args.source_accessed_at,
            "timezone": args.timezone,
            "power_unit_status": "inferred_kW_pending_direct_schema_confirmation",
            "claim_boundary": (
                "Observed DKASC data normalization only; not SECOM external "
                "validation, PV performance, or field validation."
            ),
        }
    )
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
