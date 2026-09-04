"""Local smoke runner for the dependency-free Fledge reading contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from .fledge_contract import FledgeContractError, normalize_fledge_readings


def load_readings(path: Path) -> list[dict[str, object]]:
    """Load either a JSON array or an object containing a ``readings`` array."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise FledgeContractError(f"invalid JSON in {path}: {error.msg}") from error

    readings = payload.get("readings") if isinstance(payload, dict) else payload
    if not isinstance(readings, list):
        raise FledgeContractError("input must be a JSON array or an object with a readings array")
    return readings


def build_quality_report(frame: pd.DataFrame, source: Path) -> dict[str, object]:
    """Describe the normalized batch without making model or field claims."""

    measurement_columns = [name for name in frame if name.startswith("measurement__")]
    missing_cells = int(frame[measurement_columns].isna().sum().sum()) if measurement_columns else 0
    total_measurement_cells = len(frame) * len(measurement_columns)
    return {
        "status": "contract_validated",
        "source": str(source),
        "readings": int(len(frame)),
        "assets": int(frame["asset_code"].nunique()) if not frame.empty else 0,
        "measurement_columns": measurement_columns,
        "event_time_min": frame["event_time"].min().isoformat() if not frame.empty else None,
        "event_time_max": frame["event_time"].max().isoformat() if not frame.empty else None,
        "missing_measurement_cells": missing_cells,
        "missing_measurement_rate": (
            missing_cells / total_measurement_cells if total_measurement_cells else 0.0
        ),
        "claim_boundary": "Local contract smoke test; not a Fledge plugin or field integration.",
    }


def run_smoke(
    input_path: Path,
    output_dir: Path,
    *,
    required_measurements: tuple[str, ...] = (),
) -> dict[str, object]:
    """Validate a fixture and write normalized CSV plus a JSON quality report."""

    readings = load_readings(input_path)
    frame = normalize_fledge_readings(readings, required_measurements=required_measurements)
    report = build_quality_report(frame, input_path)

    output_dir.mkdir(parents=True, exist_ok=True)
    csv_frame = frame.copy()
    if not csv_frame.empty:
        csv_frame["event_time"] = csv_frame["event_time"].map(lambda value: value.isoformat())
    csv_frame.to_csv(output_dir / "normalized_readings.csv", index=False)
    (output_dir / "quality_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a candidate Fledge reading fixture")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("results/fledge-smoke"))
    parser.add_argument("--require", action="append", default=[], help="required measurement name")
    args = parser.parse_args()
    report = run_smoke(args.input, args.output_dir, required_measurements=tuple(args.require))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
