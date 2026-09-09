"""Bounded, paginated collection of Enedis national solar injection aggregates."""

from __future__ import annotations

import argparse
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

import pandas as pd

from .enedis_production_contract import (
    API_ENDPOINT,
    EnedisProductionContractError,
    REQUIRED_FIELDS,
    SOLAR_LABEL,
    TOTAL_BAND_LABEL,
    normalize_enedis_rows,
)

MAX_DAYS = 366
PAGE_SIZE = 10000
ALLOWED_HOST = "opendata.enedis.fr"


class EnedisProductionCollectError(ValueError):
    """Raised when a bounded Enedis collection cannot be audited safely."""


def _parse_utc(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise EnedisProductionCollectError(f"{field} must be ISO-8601") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise EnedisProductionCollectError(f"{field} must explicitly use UTC")
    if parsed.minute or parsed.second or parsed.microsecond:
        raise EnedisProductionCollectError(f"{field} must be aligned to an hour")
    return parsed


def build_range_params(*, start: str, end: str, size: int = PAGE_SIZE) -> dict[str, object]:
    start_dt, end_dt = _parse_utc(start, "start"), _parse_utc(end, "end")
    if end_dt <= start_dt:
        raise EnedisProductionCollectError("end must be later than start")
    if end_dt - start_dt > timedelta(days=MAX_DAYS):
        raise EnedisProductionCollectError(f"one collection is limited to {MAX_DAYS} days")
    if not 1 <= size <= PAGE_SIZE:
        raise EnedisProductionCollectError(f"size must be between 1 and {PAGE_SIZE}")
    return {
        "size": size,
        "filiere_de_production_eq": SOLAR_LABEL,
        "plage_de_puissance_injection_eq": TOTAL_BAND_LABEL,
        "horodate_gte": start_dt.isoformat().replace("+00:00", "Z"),
        "horodate_lt": end_dt.isoformat().replace("+00:00", "Z"),
        "sort": "horodate",
        "select": ",".join(REQUIRED_FIELDS),
        "count": "exact",
        "hint": "true",
    }


def _default_opener(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "FabGuard-AI/0.1 Enedis audit"})
    with urlopen(request, timeout=180) as response:
        if response.status != 200:
            raise EnedisProductionCollectError(f"Enedis returned HTTP {response.status}")
        return response.read()


def collect_enedis_range(
    *, start: str, end: str,
    opener: Callable[[str], bytes] = _default_opener,
    retrieved_at: datetime | None = None,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Collect every page for one bounded UTC range and validate exact coverage."""
    params = build_range_params(start=start, end=end)
    url: str | None = f"{API_ENDPOINT}?{urlencode(params)}"
    seen_urls: set[str] = set()
    records: list[dict[str, object]] = []
    page_hashes: list[str] = []
    expected_total: int | None = None
    while url:
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
            raise EnedisProductionCollectError("pagination next URL left the official HTTPS host")
        if url in seen_urls:
            raise EnedisProductionCollectError("pagination next URL repeated")
        seen_urls.add(url)
        try:
            raw = opener(url)
            payload = json.loads(raw)
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise EnedisProductionCollectError("Enedis response was unavailable or invalid JSON") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
            raise EnedisProductionCollectError("Enedis response must contain a results list")
        total = payload.get("total")
        if isinstance(total, bool) or not isinstance(total, int) or total < 0:
            raise EnedisProductionCollectError("Enedis response must contain an exact integer total")
        if expected_total is None:
            expected_total = total
        elif total != expected_total:
            raise EnedisProductionCollectError("Enedis total changed during pagination")
        hints = payload.get("meta", {}).get("hints", [])
        if any("ignored" in str(hint).lower() for hint in hints):
            raise EnedisProductionCollectError("Enedis reported an ignored query parameter")
        records.extend(payload["results"])
        page_hashes.append(hashlib.sha256(raw).hexdigest())
        next_url = payload.get("next")
        if next_url is not None and not isinstance(next_url, str):
            raise EnedisProductionCollectError("Enedis next URL must be text or null")
        url = next_url
    if expected_total is None or len(records) != expected_total:
        raise EnedisProductionCollectError("paginated row count differs from exact total")
    try:
        normalized, contract_audit = normalize_enedis_rows(records)
    except EnedisProductionContractError as exc:
        raise EnedisProductionCollectError(f"Enedis rows failed contract: {exc}") from exc
    start_dt, end_dt = _parse_utc(start, "start"), _parse_utc(end, "end")
    expected = pd.date_range(start_dt, end_dt, freq="30min", inclusive="left")
    if not normalized["timestamp_utc"].equals(pd.Series(expected)):
        raise EnedisProductionCollectError("normalized rows do not cover the requested half-hour grid")
    when = retrieved_at or datetime.now(timezone.utc)
    if when.tzinfo is None:
        raise EnedisProductionCollectError("retrieved_at must be timezone-aware")
    audit = {
        **contract_audit,
        "status": "enedis_chunked_collection_validated",
        "start_utc": start_dt.isoformat(),
        "end_utc_exclusive": end_dt.isoformat(),
        "pages": len(page_hashes),
        "api_total": expected_total,
        "normalized_rows": len(normalized),
        "retrieved_at": when.astimezone(timezone.utc).isoformat(),
        "page_sha256": page_hashes,
        "query": params,
        "redistribution": "Raw API pages and normalized CSV remain local; compact audit evidence only.",
    }
    return normalized, audit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    args = parser.parse_args()
    normalized, audit = collect_enedis_range(start=args.start, end=args.end)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    normalized.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    audit["normalized_file"] = args.output.name
    audit["normalized_sha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
