"""CLI for local Fledge operational scenario validation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .fledge_operations import FledgeOperationsProcessor, JsonStateStore, OperationsConfig
from .fledge_smoke import load_readings


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local Fledge operational harness")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("results/fledge-operations"))
    parser.add_argument("--observed-at", required=True, help="timezone-aware ISO 8601 timestamp")
    parser.add_argument("--require", action="append", default=[])
    parser.add_argument("--reference", type=Path, help="JSON measurement-to-values baseline")
    parser.add_argument("--max-lateness-seconds", type=float, default=300.0)
    parser.add_argument("--max-future-skew-seconds", type=float, default=5.0)
    parser.add_argument("--disconnect-after-seconds", type=float, default=120.0)
    parser.add_argument("--dedupe-retention-seconds", type=float, default=86_400.0)
    parser.add_argument("--drift-min-samples", type=int, default=5)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    processor = FledgeOperationsProcessor(
        OperationsConfig(
            required_measurements=tuple(args.require),
            max_lateness_seconds=args.max_lateness_seconds,
            max_future_skew_seconds=args.max_future_skew_seconds,
            disconnect_after_seconds=args.disconnect_after_seconds,
            dedupe_retention_seconds=args.dedupe_retention_seconds,
            drift_min_samples=args.drift_min_samples,
        ),
        JsonStateStore(args.output_dir / "state.json"),
    )
    reference = None
    if args.reference:
        reference = json.loads(args.reference.read_text(encoding="utf-8"))
        if not isinstance(reference, dict):
            parser.error("--reference must contain a JSON object")
    report = processor.process_batch(
        load_readings(args.input), observed_at=args.observed_at, reference=reference
    )
    (args.output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    (args.output_dir / "dead_letters.json").write_text(
        json.dumps(report["dead_letters"], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output_dir / "alerts.json").write_text(
        json.dumps(report["alerts"], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
