"""Pull live Fledge readings into the existing FabGuard operational boundary."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .fledge_operations import (
    FledgeOperationsProcessor, JsonStateStore, OperationsConfig,
)
from .fledge_rest import FledgeRestConfig, fetch_asset_readings


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull and validate readings from a Fledge REST API")
    parser.add_argument("--base-url", required=True, help="Fledge base URL, for example http://localhost:8081")
    parser.add_argument("--asset", required=True, help="Exact Fledge asset code")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--observed-at", required=True, help="timezone-aware ISO 8601 poll time")
    parser.add_argument("--output-dir", type=Path, default=Path("results/fledge-live"))
    parser.add_argument("--require", action="append", default=[])
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--token-env", default="FLEDGE_AUTHTOKEN")
    parser.add_argument("--timeout-seconds", type=float, default=10.0)
    parser.add_argument("--max-response-bytes", type=int, default=5_000_000)
    parser.add_argument("--max-lateness-seconds", type=float, default=300.0)
    parser.add_argument("--max-future-skew-seconds", type=float, default=5.0)
    parser.add_argument("--disconnect-after-seconds", type=float, default=120.0)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    store = JsonStateStore(args.output_dir / "state.json")
    recovered = store.recover_pending()
    if recovered is not None:
        print(json.dumps(recovered, ensure_ascii=False, indent=2, allow_nan=False))
        return

    token = os.environ.get(args.token_env)
    readings = fetch_asset_readings(
        FledgeRestConfig(
            base_url=args.base_url,
            auth_token=token,
            timeout_seconds=args.timeout_seconds,
            max_response_bytes=args.max_response_bytes,
        ),
        args.asset,
        limit=args.limit,
    )
    reference = None
    if args.reference:
        reference = json.loads(args.reference.read_text(encoding="utf-8"))
        if not isinstance(reference, dict):
            parser.error("--reference must contain a JSON object")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    processor = FledgeOperationsProcessor(
        OperationsConfig(
            required_measurements=tuple(args.require),
            max_lateness_seconds=args.max_lateness_seconds,
            max_future_skew_seconds=args.max_future_skew_seconds,
            disconnect_after_seconds=args.disconnect_after_seconds,
        ),
        store,
    )
    report_context = {
        "source": {
            "type": "fledge_rest_asset",
            "base_url": args.base_url,
            "asset_code": args.asset,
            "requested_limit": args.limit,
            "authentication_token_recorded": False,
        },
        "claim_boundary": (
            "Read from a Fledge REST-compatible endpoint and processed by the local FabGuard boundary; "
            "not model scoring, field validation, or proof of production deployment."
        ),
    }

    report = processor.process_batch(
        readings,
        observed_at=args.observed_at,
        reference=reference,
        durable_output=True,
        report_context=report_context,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
