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

import pandas as pd

from .rte_eco2mix_contract import (
    API_ENDPOINT,
    RTEEco2MixContractError,
    build_records_params,
    normalize_eco2mix_records,
)

MAX_DAYS = 366


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


def _default_opener(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "FabGuard-AI/0.1 RTE audit"})
    with urlopen(request, timeout=120) as response:
        if response.status != 200:
            raise RTEEco2MixCollectError(f"RTE returned HTTP {response.status}")
        return response.read()


def fetch_rte_day(
    *,
    start: str,
    end: str,
    expected_status: str = "definitive",
    opener: Callable[[str], bytes] = _default_opener,
    retrieved_at: datetime | None = None,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Fetch exactly one UTC day and validate the complete 15-minute envelope."""
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
    if total_count != 96:
        raise RTEEco2MixCollectError("RTE daily response must contain 96 quarter-hour rows")

    try:
        normalized, contract_audit = normalize_eco2mix_records(
            records, expected_status=expected_status
        )
    except RTEEco2MixContractError as exc:
        raise RTEEco2MixCollectError(str(exc)) from exc

    expected = pd.date_range(start_dt, end_dt, freq="30min", inclusive="left")
    if not normalized["timestamp_utc"].reset_index(drop=True).equals(pd.Series(expected)):
        raise RTEEco2MixCollectError("normalized RTE day does not cover all 48 half-hours")

    when = retrieved_at or datetime.now(timezone.utc)
    if when.tzinfo is None:
        raise RTEEco2MixCollectError("retrieved_at must be timezone-aware")
    audit = {
        **contract_audit,
        "status": "rte_live_daily_contract_validated",
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
    expected_status: str = "definitive",
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
        combined["revision_status"].value_counts().sort_index().astype(int).to_dict()
    )
    audit: dict[str, object] = {
        "schema_version": "fabguard-rte-collection/v1",
        "status": "rte_chunked_collection_validated",
        "source_type": "estimated",
        "provider": "RTE via Open Data Réseaux Énergies",
        "dataset_id": "eco2mix-national-cons-def",
        "geographic_scope": "France national electricity system",
        "analysis_clock": "continuous UTC",
        "start_utc": start_dt.isoformat(),
        "end_utc_exclusive": end_dt.isoformat(),
        "days": days,
        "chunks": len(chunk_audits),
        "raw_rows": sum(int(a["input_rows"]) for a in chunk_audits),
        "structural_null_rows": sum(int(a["structural_null_rows"]) for a in chunk_audits),
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
        "--expected-status", choices=("consolidated", "definitive"), default="definitive"
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
            expected_status=args.expected_status,
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
    print(json.dumps({k: v for k, v in audit.items() if k != "raw_chunk_sha256"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
