"""Chunked PV_Live collection for a reproducible long-range local E2E run."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from typing import Callable

import pandas as pd

from .pvlive_fetch import PVLiveFetchError, fetch_pvlive_range

CHUNK_DAYS = 7


def _parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise PVLiveFetchError("range timestamps must explicitly use UTC")
    return parsed


def collect_pvlive_range(
    *,
    start: str,
    end: str,
    entity_type: str = "gsp",
    entity_id: int = 0,
    fetcher: Callable[..., tuple[pd.DataFrame, dict[str, object]]] = fetch_pvlive_range,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Collect an inclusive interval-end range using non-overlapping chunks."""
    start_dt, end_dt = _parse_utc(start), _parse_utc(end)
    if end_dt < start_dt:
        raise PVLiveFetchError("end must not precede start")
    cursor = start_dt
    frames: list[pd.DataFrame] = []
    chunk_audits: list[dict[str, object]] = []
    while cursor <= end_dt:
        chunk_end = min(
            end_dt,
            cursor + timedelta(days=CHUNK_DAYS) - timedelta(minutes=30),
        )
        frame, audit = fetcher(
            start=cursor.isoformat().replace("+00:00", "Z"),
            end=chunk_end.isoformat().replace("+00:00", "Z"),
            entity_type=entity_type,
            entity_id=entity_id,
        )
        frames.append(frame)
        chunk_audits.append(audit)
        cursor = chunk_end + timedelta(minutes=30)

    combined = pd.concat(frames, ignore_index=True)
    identity = ["entity_type", "entity_id", "interval_end_utc", "updated_at_utc"]
    if combined.duplicated(identity).any():
        raise PVLiveFetchError("chunk merge produced duplicate revision identities")
    combined = combined.sort_values(
        ["interval_end_utc", "updated_at_utc"], kind="stable"
    ).reset_index(drop=True)
    intervals = combined["interval_end_utc"].drop_duplicates().sort_values()
    expected = pd.date_range(start_dt, end_dt, freq="30min")
    if not intervals.reset_index(drop=True).equals(pd.Series(expected)):
        raise PVLiveFetchError("combined response does not cover every requested interval")

    audit = {
        "schema_version": "fabguard-pvlive-collection/v1",
        "status": "pvlive_chunked_collection_validated",
        "source_type": "estimated",
        "geographic_scope": "GB electricity network",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "period_minutes": 30,
        "analysis_clock": "continuous UTC/GMT",
        "start_interval_end_utc": start_dt.isoformat(),
        "end_interval_end_utc": end_dt.isoformat(),
        "chunks": len(chunk_audits),
        "rows": len(combined),
        "intervals": len(intervals),
        "raw_chunk_sha256": [a["raw_response_sha256"] for a in chunk_audits],
        "claim_boundary": (
            "PV_Live estimated-data collection only; not direct observation, "
            "SECOM external validation, field validation, or PV performance proof."
        ),
    }
    return combined, audit


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect a long PV_Live range safely")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--entity-type", choices=("gsp", "pes"), default="gsp")
    parser.add_argument("--entity-id", type=int, default=0)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.resolve() == args.audit_output.resolve():
        parser.error("data and audit outputs must differ")
    try:
        frame, audit = collect_pvlive_range(
            start=args.start,
            end=args.end,
            entity_type=args.entity_type,
            entity_id=args.entity_id,
        )
    except (PVLiveFetchError, OSError, ValueError) as exc:
        parser.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    audit["normalized_file"] = args.output.name
    audit["normalized_sha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in audit.items() if k != "raw_chunk_sha256"}, indent=2))


if __name__ == "__main__":
    main()
