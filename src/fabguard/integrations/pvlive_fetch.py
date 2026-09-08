"""Small, auditable PV_Live fetcher isolated from the FabGuard core."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from typing import Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd

from .pvlive_contract import PVLiveContractError, normalize_pvlive_frame

API_HOST = "api.pvlive.uk"
API_VERSION = "v4"
MAX_RANGE = timedelta(days=7)


class PVLiveFetchError(ValueError):
    """Raised when a live response cannot be safely admitted."""


def _utc(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise PVLiveFetchError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise PVLiveFetchError(f"{field} must explicitly use UTC")
    return parsed


def _default_opener(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "FabGuard-AI/0.1 PVLive audit"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise PVLiveFetchError(f"PV_Live returned HTTP {response.status}")
        return response.read()


def fetch_pvlive_range(
    *,
    start: str,
    end: str,
    entity_type: str = "gsp",
    entity_id: int = 0,
    opener: Callable[[str], bytes] = _default_opener,
    retrieved_at: datetime | None = None,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Fetch at most seven days and return normalized versioned estimates."""
    start_dt = _utc(start, "start")
    end_dt = _utc(end, "end")
    if end_dt < start_dt:
        raise PVLiveFetchError("end must not precede start")
    if end_dt - start_dt > MAX_RANGE:
        raise PVLiveFetchError("one request may cover at most seven days")

    endpoint = f"/pvlive/api/{API_VERSION}/{entity_type}/{entity_id}"
    params = {
        "start": start_dt.isoformat().replace("+00:00", "Z"),
        "end": end_dt.isoformat().replace("+00:00", "Z"),
        "period": 30,
        "extra_fields": "updated_gmt",
    }
    url = f"https://{API_HOST}{endpoint}?{urlencode(params)}"
    try:
        raw = opener(url)
        payload = json.loads(raw)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PVLiveFetchError("PV_Live response was unavailable or invalid JSON") from exc
    if not isinstance(payload, dict) or set(payload) < {"meta", "data"}:
        raise PVLiveFetchError("PV_Live response must contain meta and data")
    meta = payload["meta"]
    data = payload["data"]
    if not isinstance(meta, list) or len(meta) != len(set(meta)):
        raise PVLiveFetchError("PV_Live meta must be a unique field list")
    if not isinstance(data, list) or any(
        not isinstance(row, list) or len(row) != len(meta) for row in data
    ):
        raise PVLiveFetchError("PV_Live data rows do not match meta")
    frame = pd.DataFrame(data, columns=meta)
    try:
        normalized, contract_audit = normalize_pvlive_frame(
            frame, entity_type=entity_type, entity_id=entity_id
        )
    except PVLiveContractError as exc:
        raise PVLiveFetchError(str(exc)) from exc

    when = retrieved_at or datetime.now(timezone.utc)
    if when.tzinfo is None:
        raise PVLiveFetchError("retrieved_at must be timezone-aware")
    audit: dict[str, object] = {
        **contract_audit,
        "status": "pvlive_live_contract_validated",
        "provider": "Sheffield Solar / NESO",
        "api_host": API_HOST,
        "api_version": API_VERSION,
        "endpoint": endpoint,
        "query": params,
        "retrieved_at": when.astimezone(timezone.utc).isoformat(),
        "raw_response_sha256": hashlib.sha256(raw).hexdigest(),
        "redistribution": (
            "Raw response is not a repository artifact; data redistribution "
            "terms require direct confirmation."
        ),
    }
    return normalized, audit


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and validate a small PV_Live range")
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
        normalized, audit = fetch_pvlive_range(
            start=args.start,
            end=args.end,
            entity_type=args.entity_type,
            entity_id=args.entity_id,
        )
    except PVLiveFetchError as exc:
        parser.error(str(exc))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    normalized.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    audit["normalized_file"] = args.output.name
    audit["normalized_sha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
