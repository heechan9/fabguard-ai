"""Daily-chunked RTE éCO2mix collection for reproducible long-range E2E runs."""

from __future__ import annotations

import argparse
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import pandas as pd

from .rte_eco2mix_contract import (
    API_ENDPOINT,
    RTEEco2MixContractError,
    build_records_params,
    normalize_eco2mix_records,
)

MAX_DAYS = 366
PARIS = ZoneInfo("Europe/Paris")
_REQUIRED_FIELDS = ["date_heure", "solaire", "nature"]


class RTEEco2MixCollectError(ValueError):
    """Raised when a live RTE range cannot be collected without ambiguity."""


def _parse_utc_midnight(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RTEEco2MixCollectError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise RTEEco2MixCollectError(f"{field} must explicitly use UTC")
    if parsed.time() != datetime.min.time():
        raise RTEEco2MixCollectError(f"{field} must be UTC midnight")
    return parsed


def _paris_offset_change_minutes(start_dt: datetime, end_dt: datetime) -> int:
    """Return the Europe/Paris UTC-offset change occurring inside one UTC day."""
    start_offset = start_dt.astimezone(PARIS).utcoffset()
    end_offset = (end_dt - timedelta(microseconds=1)).astimezone(PARIS).utcoffset()
    if start_offset is None or end_offset is None:
        raise RTEEco2MixCollectError("Europe/Paris offset could not be resolved")
    return int((end_offset - start_offset).total_seconds() // 60)


def _default_opener(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "FabGuard-AI/0.1 RTE audit"})
    with urlopen(request, timeout=120) as response:
        if response.status != 200:
            raise RTEEco2MixCollectError(f"RTE returned HTTP {response.status}")
        return response.read()


def _reconcile_dst_envelope(
    records: list[dict[str, object]],
    *,
    start_dt: datetime,
    end_dt: datetime,
) -> tuple[list[dict[str, object]], dict[str, int | bool]]:
    """Reconcile only the two empirically observed RTE DST envelope artifacts."""
    frame = pd.DataFrame(records)
    missing_fields = sorted(set(_REQUIRED_FIELDS).difference(frame.columns))
    if missing_fields:
        raise RTEEco2MixCollectError(
            f"missing required RTE fields: {', '.join(missing_fields)}"
        )

    timestamps = pd.to_datetime(frame["date_heure"], errors="coerce", utc=True)
    if timestamps.isna().any():
        raise RTEEco2MixCollectError(
            "date_heure contains invalid or timezone-ambiguous values"
        )

    offset_change = _paris_offset_change_minutes(start_dt, end_dt)
    duplicate_timestamp_mask = timestamps.duplicated(keep=False)
    exact_duplicate_mask = frame.duplicated(subset=_REQUIRED_FIELDS, keep=False)
    if (duplicate_timestamp_mask & ~exact_duplicate_mask).any():
        raise RTEEco2MixCollectError("RTE DST response contains conflicting duplicate rows")

    remove_mask = frame.duplicated(subset=_REQUIRED_FIELDS, keep="first")
    deduplicated_rows = int(remove_mask.sum())
    clean = frame.loc[~remove_mask, _REQUIRED_FIELDS].copy()
    clean_times = pd.DatetimeIndex(
        pd.to_datetime(clean["date_heure"], errors="coerce", utc=True)
    )
    expected_quarters = pd.date_range(
        start_dt, end_dt, freq="15min", inclusive="left"
    )
    missing_quarters = expected_quarters.difference(clean_times)
    extra_quarters = clean_times.difference(expected_quarters)
    if len(extra_quarters):
        raise RTEEco2MixCollectError("RTE response contains timestamps outside its UTC day")

    if offset_change == 60:
        valid_shape = len(records) == 100 and deduplicated_rows == 4 and not len(missing_quarters)
    elif offset_change == -60:
        valid_shape = len(records) == 92 and deduplicated_rows == 0 and len(missing_quarters) == 4
    else:
        valid_shape = len(records) == 96 and deduplicated_rows == 0 and not len(missing_quarters)
    if not valid_shape:
        if offset_change:
            raise RTEEco2MixCollectError(
                "RTE DST response does not match the audited 92/100-row transition shape"
            )
        raise RTEEco2MixCollectError(
            "RTE daily response must contain 96 unique quarter-hour rows"
        )

    missing_half_hours = int(sum(ts.minute in (0, 30) for ts in missing_quarters))
    missing_structural = int(len(missing_quarters) - missing_half_hours)
    return clean.to_dict("records"), {
        "dst_transition_day": bool(offset_change),
        "paris_utc_offset_change_minutes": offset_change,
        "deduplicated_raw_rows": deduplicated_rows,
        "missing_quarter_hour_rows": int(len(missing_quarters)),
        "missing_half_hour_rows": missing_half_hours,
        "missing_structural_rows": missing_structural,
    }


def fetch_rte_day(
    *,
    start: str,
    end: str,
    expected_status: str | None = "definitive",
    opener: Callable[[str], bytes] = _default_opener,
    retrieved_at: datetime | None = None,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Fetch one UTC day, preserving audited DST source gaps as explicit nulls."""
    start_dt = _parse_utc_midnight(start, "start")
    end_dt = _parse_utc_midnight(end, "end")
    if end_dt - start_dt != timedelta(days=1):
        raise RTEEco2MixCollectError("each RTE request must cover exactly one UTC day")

    params = build_records_params(start_utc=start, end_utc=end, limit=100)
    url = f"{API_ENDPOINT}?{urlencode(params)}"
    try:
        raw = opener(url)
        payload = json.loads(raw)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RTEEco2MixCollectError("RTE response was unavailable or invalid JSON") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise RTEEco2MixCollectError("RTE response must contain a results list")
    total_count = payload.get("total_count")
    if isinstance(total_count, bool) or not isinstance(total_count, int):
        raise RTEEco2MixCollectError("RTE response must contain an integer total_count")
    records = payload["results"]
    if total_count != len(records):
        raise RTEEco2MixCollectError("RTE response was truncated or total_count mismatched")

    clean_records, dst_audit = _reconcile_dst_envelope(
        records, start_dt=start_dt, end_dt=end_dt
    )
    try:
        normalized, contract_audit = normalize_eco2mix_records(
            clean_records,
            expected_status=expected_status,
            require_continuous=dst_audit["missing_quarter_hour_rows"] == 0,
        )
    except RTEEco2MixContractError as exc:
        raise RTEEco2MixCollectError(
            f"RTE day {start_dt.date()} failed contract: {exc}"
        ) from exc

    expected = pd.date_range(start_dt, end_dt, freq="30min", inclusive="left")
    normalized = (
        normalized.set_index("timestamp_utc")
        .reindex(expected)
        .rename_axis("timestamp_utc")
        .reset_index()
    )
    if not normalized["timestamp_utc"].equals(pd.Series(expected)):
        raise RTEEco2MixCollectError("normalized RTE day does not cover all 48 half-hours")
    if int(normalized["solar_generation_mw"].isna().sum()) != int(
        dst_audit["missing_half_hour_rows"]
    ):
        raise RTEEco2MixCollectError("RTE missing-power accounting is inconsistent")

    when = retrieved_at or datetime.now(timezone.utc)
    if when.tzinfo is None:
        raise RTEEco2MixCollectError("retrieved_at must be timezone-aware")
    audit = {
        **contract_audit,
        **dst_audit,
        "status": "rte_live_daily_contract_validated",
        "requested_revision_policy": expected_status or "published",
        "input_rows": total_count,
        "normalized_rows": len(normalized),
        "query": params,
        "start_utc": start_dt.isoformat(),
        "end_utc": end_dt.isoformat(),
        "api_total_count": total_count,
        "retrieved_at": when.astimezone(timezone.utc).isoformat(),
        "raw_response_sha256": hashlib.sha256(raw).hexdigest(),
        "redistribution": (
            "Raw API responses remain local; only bounded derived evidence is considered "
            "for repository publication after licence review."
        ),
    }
    return normalized, audit


def collect_rte_range(
    *,
    start: str,
    end: str,
    expected_status: str | None = "definitive",
    fetcher: Callable[..., tuple[pd.DataFrame, dict[str, object]]] = fetch_rte_day,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Collect a half-open UTC date range through non-overlapping daily requests."""
    start_dt = _parse_utc_midnight(start, "start")
    end_dt = _parse_utc_midnight(end, "end")
    if end_dt <= start_dt:
        raise RTEEco2MixCollectError("end must be later than start")
    days = (end_dt - start_dt).days
    if end_dt - start_dt != timedelta(days=days):
        raise RTEEco2MixCollectError("range must contain whole UTC days")
    if days > MAX_DAYS:
        raise RTEEco2MixCollectError(f"one collection is limited to {MAX_DAYS} days")

    frames: list[pd.DataFrame] = []
    chunk_audits: list[dict[str, object]] = []
    cursor = start_dt
    while cursor < end_dt:
        next_day = cursor + timedelta(days=1)
        frame, audit = fetcher(
            start=cursor.isoformat().replace("+00:00", "Z"),
            end=next_day.isoformat().replace("+00:00", "Z"),
            expected_status=expected_status,
        )
        frames.append(frame)
        chunk_audits.append(audit)
        cursor = next_day

    combined = pd.concat(frames, ignore_index=True)
    if combined["timestamp_utc"].duplicated().any():
        raise RTEEco2MixCollectError("daily merge produced duplicate timestamps")
    combined = combined.sort_values("timestamp_utc", kind="stable").reset_index(drop=True)
    expected = pd.date_range(start_dt, end_dt, freq="30min", inclusive="left")
    if not combined["timestamp_utc"].equals(pd.Series(expected)):
        raise RTEEco2MixCollectError("combined RTE response does not cover every half-hour")

    status_counts = (
        combined["revision_status"].dropna().value_counts().sort_index().astype(int).to_dict()
    )
    missing_power_rows = int(combined["solar_generation_mw"].isna().sum())
    audit: dict[str, object] = {
        "schema_version": "fabguard-rte-collection/v1",
        "status": "rte_chunked_collection_validated",
        "source_type": "estimated",
        "provider": "RTE via Open Data Réseaux Énergies",
        "dataset_id": "eco2mix-national-cons-def",
        "geographic_scope": "France national electricity system",
        "analysis_clock": "continuous UTC",
        "requested_revision_policy": expected_status or "published",
        "start_utc": start_dt.isoformat(),
        "end_utc_exclusive": end_dt.isoformat(),
        "days": days,
        "chunks": len(chunk_audits),
        "raw_rows": sum(int(a["input_rows"]) for a in chunk_audits),
        "structural_null_rows": sum(int(a["structural_null_rows"]) for a in chunk_audits),
        "deduplicated_raw_rows": sum(
            int(a.get("deduplicated_raw_rows", 0)) for a in chunk_audits
        ),
        "missing_quarter_hour_rows": sum(
            int(a.get("missing_quarter_hour_rows", 0)) for a in chunk_audits
        ),
        "missing_structural_rows": sum(
            int(a.get("missing_structural_rows", 0)) for a in chunk_audits
        ),
        "missing_power_rows": missing_power_rows,
        "dst_transition_days": sum(
            bool(a.get("dst_transition_day", False)) for a in chunk_audits
        ),
        "data_quality_warning": missing_power_rows > 0,
        "normalized_rows": len(combined),
        "sampling_minutes": 30,
        "power_unit": "MW",
        "revision_status_counts": {str(k): int(v) for k, v in status_counts.items()},
        "raw_chunk_sha256": [str(a["raw_response_sha256"]) for a in chunk_audits],
        "claim_boundary": (
            "RTE national aggregate estimated/consolidated electricity data only; "
            "not plant telemetry, SECOM external validation, field validation, "
            "panel diagnosis, or proof of PV performance."
        ),
    }
    return combined, audit


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect a long RTE éCO2mix range safely")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument(
        "--expected-status",
        choices=("consolidated", "definitive", "published"),
        default="definitive",
        help=(
            "Require one revision state, or accept both official states with "
            "'published' while preserving per-row revision lineage"
        ),
    )
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.resolve() == args.audit_output.resolve():
        parser.error("data and audit outputs must differ")
    try:
        frame, audit = collect_rte_range(
            start=args.start,
            end=args.end,
            expected_status=(
                None if args.expected_status == "published" else args.expected_status
            ),
        )
    except (RTEEco2MixCollectError, OSError, ValueError) as exc:
        parser.error(str(exc))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    audit["normalized_file"] = args.output.name
    audit["normalized_sha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {k: v for k, v in audit.items() if k != "raw_chunk_sha256"},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
