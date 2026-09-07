"""Run Solar Data Tools through the versioned FabGuard PV boundary."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import pandas as pd

from .pv_contract import normalize_pv_frame
from .sdt_adapter import normalize_sdt_report


class FrictionlessValidationError(ValueError):
    """Raised when a CSV fails the structural gate before SDT execution."""


def _aware_iso8601(value: str) -> str:
    parsed = pd.to_datetime(value, utc=False, errors="coerce")
    if pd.isna(parsed) or parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("--observed-at must be a timezone-aware ISO 8601 value")
    return parsed.isoformat()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_frictionless(input_path: Path) -> dict[str, object]:
    """Validate a local CSV relative to its own approved base directory."""
    from frictionless import Resource

    resolved = input_path.resolve(strict=True)
    if not resolved.is_file():
        raise FrictionlessValidationError("input must be a regular file")

    resource = Resource(path=resolved.name, basepath=str(resolved.parent))
    report = resource.validate()
    errors = report.flatten(["type", "message"])
    if not report.valid:
        summary = "; ".join(
            f"{item[0]}: {item[1]}" for item in errors[:5]
        )
        raise FrictionlessValidationError(
            f"Frictionless validation failed: {summary or 'unknown structural error'}"
        )
    try:
        frictionless_version = version("frictionless")
    except PackageNotFoundError as exc:
        raise FrictionlessValidationError(
            "cannot determine Frictionless version"
        ) from exc
    return {
        "valid": True,
        "version": frictionless_version,
        "resource_path": resolved.name,
        "error_count": 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a PV series with Solar Data Tools")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--timestamp-column")
    parser.add_argument("--power-column", required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument(
        "--source-type",
        required=True,
        choices=("synthetic", "observed", "estimated", "reference"),
    )
    parser.add_argument("--timezone", required=True)
    parser.add_argument("--power-unit", required=True, choices=("W", "kW", "MW"))
    parser.add_argument("--observed-at", required=True, type=_aware_iso8601)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--solver", default="CLARABEL")
    args = parser.parse_args()

    try:
        from solardatatools import DataHandler
    except ImportError:
        parser.error("Solar Data Tools is not installed; install the optional 'pv' dependency")

    try:
        frictionless_validation = _validate_frictionless(args.input)
    except ImportError:
        parser.error("Frictionless is not installed; install the optional 'pv' dependency")
    except (FrictionlessValidationError, OSError) as exc:
        parser.error(str(exc))

    if args.input.resolve() == args.output.resolve():
        parser.error("--output must not overwrite --input")

    frame = pd.read_csv(args.input)
    timestamp_column = args.timestamp_column or str(frame.columns[0])
    normalized = normalize_pv_frame(
        frame,
        timestamp_column=timestamp_column,
        power_column=args.power_column,
        source_id=args.source_id,
        source_type=args.source_type,
        timezone=args.timezone,
        power_unit=args.power_unit,
    )

    # SDT analyzes solar-day geometry in local wall-clock time. The shared
    # contract keeps UTC instants, but the SDT view converts back to the
    # explicitly declared source timezone before dropping the timezone marker.
    # SDT reports capacity in kW from a power series expressed in watts.
    local_index = (
        normalized["event_time"]
        .dt.tz_convert(args.timezone)
        .dt.tz_localize(None)
    )
    sdt_frame = pd.DataFrame(
        {"power_w": normalized["power_kw"].to_numpy() * 1000.0},
        index=pd.DatetimeIndex(local_index),
    )
    handler = DataHandler(sdt_frame)
    handler.run_pipeline(power_col="power_w", solver=args.solver)
    report = normalize_sdt_report(handler.report(verbose=False, return_values=True))

    try:
        sdt_version = version("solar-data-tools")
    except PackageNotFoundError as exc:
        parser.error(f"cannot determine Solar Data Tools version: {exc}")

    artifact = {
        "schema_version": "fabguard-pv-sdt/v1",
        "status": "sdt_contract_validated",
        "source": {
            "source_id": args.source_id,
            "source_type": args.source_type,
            "input_file": args.input.name,
            "input_sha256": _sha256(args.input),
            "input_rows": int(len(frame)),
            "timezone_declared": args.timezone,
            "normalized_timezone": "UTC",
            "sdt_analysis_clock": "declared source local wall time",
            "input_power_unit": args.power_unit,
            "normalized_power_unit": "kW",
            "sdt_input_power_unit": "W",
            "observed_at": args.observed_at,
        },
        "validation": {
            "frictionless": frictionless_validation,
        },
        "runtime": {
            "solar_data_tools_version": sdt_version,
            "frictionless_version": frictionless_validation["version"],
            "python_version": platform.python_version(),
            "solver": args.solver,
        },
        "matrix": {
            "raw_shape": list(handler.raw_data_matrix.shape),
            "filled_shape": list(handler.filled_data_matrix.shape),
        },
        "sdt_report": report,
        "claim_boundary": (
            "Engineering data-quality validation only; not SECOM external validation, "
            "field validation, production capacity evidence, or proof of PV performance."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    temporary.replace(args.output)
    print(json.dumps(artifact, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
