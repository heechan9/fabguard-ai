"""Repeatable local throughput and restart benchmark for the operational core."""

from __future__ import annotations

import argparse
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean

from .fledge_operations import FledgeOperationsProcessor, JsonStateStore, OperationsConfig


def make_readings(count: int, start: datetime) -> list[dict[str, object]]:
    return [
        {
            "asset_code": f"etch-{index % 8:02d}",
            "user_ts": (start + timedelta(milliseconds=index)).isoformat(),
            "reading": {"pressure": 1.0 + (index % 50) / 100, "temperature": 20 + index % 5},
        }
        for index in range(count)
    ]


def run_benchmark(count: int, repeats: int) -> dict[str, object]:
    if count < 1 or repeats < 1:
        raise ValueError("count and repeats must be positive")
    throughputs: list[float] = []
    start = datetime(2026, 9, 4, tzinfo=timezone.utc)
    for repeat in range(repeats):
        with tempfile.TemporaryDirectory() as directory:
            store = JsonStateStore(Path(directory) / "state.json")
            processor = FledgeOperationsProcessor(
                OperationsConfig(required_measurements=("pressure", "temperature")), store
            )
            report = processor.process_batch(
                make_readings(count, start),
                observed_at=start + timedelta(seconds=max(1, count / 1000)),
            )
            throughputs.append(float(report["throughput_readings_per_second"]))

            restarted = FledgeOperationsProcessor(processor.config, store)
            recovery = restarted.process_batch(
                [make_readings(1, start)[0]], observed_at=start + timedelta(seconds=2)
            )
            if recovery["dead_letter_count"] != 1:
                raise RuntimeError("restart deduplication verification failed")

    return {
        "status": "local_benchmark_completed",
        "readings_per_run": count,
        "repeats": repeats,
        "throughput_mean": mean(throughputs),
        "throughput_min": min(throughputs),
        "throughput_max": max(throughputs),
        "restart_deduplication_verified": True,
        "claim_boundary": "Single-process local benchmark; not a Fledge or factory capacity result.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark the local Fledge operational core")
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--output", type=Path, default=Path("results/fledge-operations/benchmark.json"))
    args = parser.parse_args()
    report = run_benchmark(args.count, args.repeats)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
