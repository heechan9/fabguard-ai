"""Minimal end-to-end skeleton for the FabGuard priority-table contract."""

from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class PriorityRow:
    sample_id: str
    risk_score: float
    rank: int
    prediction: str
    label: str
    suggested_features: str
    limitation: str


def build_example_priority_row() -> PriorityRow:
    """Return one deterministic row until the real model slice is implemented."""

    return PriorityRow(
        sample_id="SECOM_DEMO_0001",
        risk_score=0.82,
        rank=1,
        prediction="Fail-risk",
        label="unknown-demo",
        suggested_features="feature_059;feature_103;feature_348",
        limitation="Anonymous variables are inspection candidates, not proven causes.",
    )


def write_priority_table(row: PriorityRow, output: Path) -> Path:
    """Persist one priority row and return the written path."""

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(asdict(row)))
        writer.writeheader()
        writer.writerow(asdict(row))
    return output


def read_priority_table(output: Path) -> list[dict[str, str]]:
    """Read the persisted table so the skeleton proves a complete round trip."""

    with output.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    written = write_priority_table(build_example_priority_row(), args.output)
    rows = read_priority_table(written)
    print(f"wrote={written} rows={len(rows)} sample_id={rows[0]['sample_id']}")


if __name__ == "__main__":
    main()

