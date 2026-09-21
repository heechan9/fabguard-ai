"""Traceable manufacturing-event screening and human-review audit slice.

This module connects the existing Fledge reading contract to FabGuard's frozen
offline SPC screen.  It creates a review queue; it does not predict defects,
control equipment, or claim MES/FDC integration.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
from typing import Mapping

from .integrations.fledge_contract import FledgeContractError, normalize_fledge_readings
from .spc import csv_report


EVENT_SCHEMA = "fabguard-manufacturing-events/v1"
QUEUE_SCHEMA = "fabguard-manufacturing-review-queue/v1"
DECISION_SCHEMA = "fabguard-manufacturing-review-decisions/v1"
AUDIT_SCHEMA = "fabguard-manufacturing-review-audit/v1"
TRACE_FIELDS = (
    "lot_id",
    "unit_id",
    "equipment_id",
    "process_step",
    "run_id",
    "recipe_id",
    "recipe_version",
    "spec_version",
)
STREAM_FIELDS = (
    "equipment_id",
    "process_step",
    "recipe_id",
    "recipe_version",
    "spec_version",
)
OUTCOMES = {"confirmed_issue", "false_alarm", "insufficient_evidence"}
ACTIONS = {"reinspect", "equipment_check", "hold", "release", "no_action"}
STATUS_PRIORITY = {
    "baseline_review_required": (0, "BLOCKED_BASELINE"),
    "above_limit": (1, "P1_LIMIT_SIGNAL"),
    "below_limit": (1, "P1_LIMIT_SIGNAL"),
    "unknown": (2, "P2_EVIDENCE_GAP"),
}


class ManufacturingReviewError(ValueError):
    """Raised when manufacturing lineage or review evidence cannot be trusted."""


def _reject_json_constant(value: str) -> None:
    raise ManufacturingReviewError(f"non-standard JSON constant is not accepted: {value}")


def _sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def _strict_object(raw: bytes, *, label: str) -> dict[str, object]:
    try:
        value = json.loads(raw.decode("utf-8"), parse_constant=_reject_json_constant)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ManufacturingReviewError(f"{label} must be valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ManufacturingReviewError(f"{label} root must be an object")
    return value


def _nonempty(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ManufacturingReviewError(f"{field} must be a non-empty string")
    return value.strip()


def _aware_timestamp(value: object, field: str) -> datetime:
    text = _nonempty(value, field)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise ManufacturingReviewError(f"{field} must be an ISO 8601 timestamp") from error
    if parsed.utcoffset() is None:
        raise ManufacturingReviewError(f"{field} must include a timezone")
    return parsed.astimezone(timezone.utc)


def _python_number(value: object) -> float | int | None:
    if value is None:
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ManufacturingReviewError("normalized measurement must be finite numeric or null")
    return value


def _validate_trace(
    reading: Mapping[str, object], *, index: int, measurement_name: str, measurement_unit: str
) -> dict[str, str]:
    trace = reading.get("manufacturing")
    if not isinstance(trace, Mapping):
        raise ManufacturingReviewError(f"readings[{index}].manufacturing must be an object")
    expected = {*TRACE_FIELDS, "units"}
    if set(trace) != expected:
        missing = sorted(expected - set(trace))
        extra = sorted(set(trace) - expected)
        raise ManufacturingReviewError(
            f"readings[{index}].manufacturing fields mismatch; missing={missing}, extra={extra}"
        )
    normalized = {
        field: _nonempty(trace[field], f"readings[{index}].manufacturing.{field}")
        for field in TRACE_FIELDS
    }
    asset_code = _nonempty(reading.get("asset_code"), f"readings[{index}].asset_code")
    if normalized["equipment_id"] != asset_code:
        raise ManufacturingReviewError(
            f"readings[{index}] equipment_id must equal the Fledge asset_code"
        )
    units = trace["units"]
    if not isinstance(units, Mapping) or set(units) != {measurement_name}:
        raise ManufacturingReviewError(
            f"readings[{index}].manufacturing.units must declare only {measurement_name}"
        )
    if _nonempty(units[measurement_name], f"readings[{index}].manufacturing.units") != measurement_unit:
        raise ManufacturingReviewError(f"readings[{index}] measurement unit does not match the contract")
    return normalized


def build_review_package(raw: bytes, baseline_count: int) -> tuple[dict[str, object], dict[str, object]]:
    """Validate one declared process stream and build its offline review queue."""
    source = _strict_object(raw, label="manufacturing event input")
    if source.get("schema_version") != EVENT_SCHEMA:
        raise ManufacturingReviewError(f"schema_version must be {EVENT_SCHEMA}")
    source_id = _nonempty(source.get("source_id"), "source_id")
    data_role = source.get("data_role")
    if data_role not in ("observed", "synthetic"):
        raise ManufacturingReviewError("data_role must be observed or synthetic")
    measurement = source.get("measurement")
    if not isinstance(measurement, Mapping) or set(measurement) != {"name", "unit"}:
        raise ManufacturingReviewError("measurement must contain exactly name and unit")
    measurement_name = _nonempty(measurement["name"], "measurement.name")
    measurement_unit = _nonempty(measurement["unit"], "measurement.unit")
    readings = source.get("readings")
    if not isinstance(readings, list) or not readings:
        raise ManufacturingReviewError("readings must be a non-empty array")

    trace_by_sample: dict[str, dict[str, str]] = {}
    stream_dimensions: dict[str, str] | None = None
    try:
        frame = normalize_fledge_readings(readings, required_measurements=(measurement_name,))
        for index, reading in enumerate(readings):
            if not isinstance(reading, Mapping):
                raise ManufacturingReviewError(f"readings[{index}] must be an object")
            trace = _validate_trace(
                reading,
                index=index,
                measurement_name=measurement_name,
                measurement_unit=measurement_unit,
            )
            candidate_stream = {field: trace[field] for field in STREAM_FIELDS}
            if stream_dimensions is None:
                stream_dimensions = candidate_stream
            elif candidate_stream != stream_dimensions:
                raise ManufacturingReviewError(
                    "all readings must share equipment, process, recipe and specification dimensions"
                )
            single = normalize_fledge_readings([reading], required_measurements=(measurement_name,))
            sample_id = str(single.iloc[0]["sample_id"])
            if sample_id in trace_by_sample:
                raise ManufacturingReviewError("duplicate manufacturing sample_id is not accepted")
            trace_by_sample[sample_id] = trace
    except FledgeContractError as error:
        raise ManufacturingReviewError(str(error)) from error

    csv_buffer = io.StringIO(newline="")
    writer = csv.writer(csv_buffer, lineterminator="\n")
    writer.writerow(("timestamp", "value"))
    measurement_column = f"measurement__{measurement_name}"
    for _, row in frame.iterrows():
        value = _python_number(row[measurement_column])
        writer.writerow((row["event_time"].isoformat(), "" if value is None else value))
    try:
        spc = csv_report(csv_buffer.getvalue().encode("utf-8"), baseline_count, str(data_role))
    except (ValueError, OverflowError) as error:
        raise ManufacturingReviewError(str(error)) from error

    input_sha = _sha256(raw)
    queue_items: list[dict[str, object]] = []
    for observation in spc["observations"]:
        status = observation["status"]
        if status == "within_limits":
            continue
        row = frame.iloc[int(observation["row"]) - 1]
        sample_id = str(row["sample_id"])
        trace = trace_by_sample[sample_id]
        value = _python_number(row[measurement_column])
        tier, priority_class = STATUS_PRIORITY[status]
        if status == "above_limit":
            severity = (float(value) - float(spc["ucl"])) / (float(spc["ucl"]) - float(spc["center"]))
        elif status == "below_limit":
            severity = (float(spc["lcl"]) - float(value)) / (float(spc["center"]) - float(spc["lcl"]))
        else:
            severity = None
        event_evidence = {
            "sample_id": sample_id,
            "event_time": row["event_time"].isoformat(),
            "measurement": measurement_name,
            "value": value,
            "unit": measurement_unit,
            "trace": trace,
        }
        review_id = hashlib.sha256(
            f"{input_sha}:{sample_id}:{measurement_name}".encode("utf-8")
        ).hexdigest()[:24]
        queue_items.append({
            "review_id": review_id,
            "priority_class": priority_class,
            "screening_status": status,
            "screening_severity": severity,
            **event_evidence,
            "event_evidence_sha256": _sha256(_canonical_bytes(event_evidence)),
            "claim_boundary": "screening signal only; not a defect diagnosis or equipment command",
            "_tier": tier,
        })
    queue_items.sort(
        key=lambda item: (
            item["_tier"],
            -(item["screening_severity"] or 0.0),
            item["event_time"],
            item["review_id"],
        )
    )
    for item in queue_items:
        item.pop("_tier")

    queue = {
        "schema_version": QUEUE_SCHEMA,
        "source_id": source_id,
        "source_input_sha256": input_sha,
        "data_role": data_role,
        "measurement": {"name": measurement_name, "unit": measurement_unit},
        "stream_dimensions": stream_dimensions,
        "items": queue_items,
        "limitations": [
            "Offline review queue only; no MES, FDC, APC or equipment-control integration",
            "Control-limit signals are not product defects or specification failures",
            "Synthetic input is not field evidence",
        ],
    }
    queue_sha = _sha256(_canonical_bytes(queue))
    report = {
        "schema_version": "fabguard-manufacturing-review-report/v1",
        "status": "review_queue_built",
        "source": {
            "source_id": source_id,
            "data_role": data_role,
            "input_sha256": input_sha,
            "reading_count": len(readings),
        },
        "measurement": {"name": measurement_name, "unit": measurement_unit},
        "stream_dimensions": stream_dimensions,
        "fledge_contract": {
            "normalized_readings": len(frame),
            "required_measurement": measurement_name,
        },
        "spc": spc,
        "review_queue": {"item_count": len(queue_items), "canonical_sha256": queue_sha},
        "claim_boundary": (
            "Reproducible synthetic/observed data-contract and offline screening evidence only; "
            "not field performance, defect diagnosis, yield improvement or equipment control"
        ),
    }
    return report, queue


def record_review_decisions(
    queue_raw: bytes, decisions_raw: bytes, *, recorded_at: str
) -> dict[str, object]:
    """Bind explicit human decisions to a queue without altering screening evidence."""
    queue = _strict_object(queue_raw, label="review queue")
    if queue.get("schema_version") != QUEUE_SCHEMA or not isinstance(queue.get("items"), list):
        raise ManufacturingReviewError("review queue schema is invalid")
    decisions = _strict_object(decisions_raw, label="review decisions")
    if decisions.get("schema_version") != DECISION_SCHEMA or not isinstance(decisions.get("decisions"), list):
        raise ManufacturingReviewError("review decisions schema is invalid")
    recorded = _aware_timestamp(recorded_at, "recorded_at")

    queue_items: dict[str, dict[str, object]] = {}
    source_input_sha = _nonempty(queue.get("source_input_sha256"), "queue source_input_sha256")
    for item in queue["items"]:
        if not isinstance(item, dict):
            raise ManufacturingReviewError("review queue item must be an object")
        review_id = _nonempty(item.get("review_id"), "queue review_id")
        if review_id in queue_items:
            raise ManufacturingReviewError("review queue contains duplicate review_id")
        event_evidence = {
            "sample_id": item.get("sample_id"),
            "event_time": item.get("event_time"),
            "measurement": item.get("measurement"),
            "value": item.get("value"),
            "unit": item.get("unit"),
            "trace": item.get("trace"),
        }
        try:
            evidence_sha = _sha256(_canonical_bytes(event_evidence))
        except (TypeError, ValueError) as error:
            raise ManufacturingReviewError("review queue contains invalid event evidence") from error
        if item.get("event_evidence_sha256") != evidence_sha:
            raise ManufacturingReviewError("review queue event evidence hash does not match")
        expected_review_id = hashlib.sha256(
            f"{source_input_sha}:{item.get('sample_id')}:{item.get('measurement')}".encode("utf-8")
        ).hexdigest()[:24]
        if review_id != expected_review_id:
            raise ManufacturingReviewError("review queue review_id does not match its source evidence")
        queue_items[review_id] = item

    indexed: dict[str, dict[str, object]] = {}
    required = {"review_id", "reviewer_role", "decided_at", "outcome", "action", "rationale"}
    for index, decision in enumerate(decisions["decisions"]):
        if not isinstance(decision, dict) or set(decision) != required:
            raise ManufacturingReviewError(f"decisions[{index}] fields do not match the contract")
        review_id = _nonempty(decision["review_id"], f"decisions[{index}].review_id")
        if review_id not in queue_items:
            raise ManufacturingReviewError(f"decisions[{index}] references an unknown review_id")
        if review_id in indexed:
            raise ManufacturingReviewError("each review_id may be decided at most once")
        decided = _aware_timestamp(decision["decided_at"], f"decisions[{index}].decided_at")
        if decided > recorded:
            raise ManufacturingReviewError("decided_at cannot be later than recorded_at")
        if decision["outcome"] not in OUTCOMES:
            raise ManufacturingReviewError(f"decisions[{index}].outcome is invalid")
        if decision["action"] not in ACTIONS:
            raise ManufacturingReviewError(f"decisions[{index}].action is invalid")
        normalized = dict(decision)
        normalized["reviewer_role"] = _nonempty(decision["reviewer_role"], "reviewer_role")
        normalized["rationale"] = _nonempty(decision["rationale"], "rationale")
        normalized["decided_at"] = decided.isoformat()
        indexed[review_id] = normalized

    entries = []
    for review_id, item in queue_items.items():
        decision = indexed.get(review_id)
        entries.append({
            "review_id": review_id,
            "event_evidence_sha256": item.get("event_evidence_sha256"),
            "screening_status": item.get("screening_status"),
            "state": "decided" if decision else "pending",
            "decision": decision,
        })
    return {
        "schema_version": AUDIT_SCHEMA,
        "recorded_at": recorded.isoformat(),
        "queue_sha256": _sha256(queue_raw),
        "decisions_sha256": _sha256(decisions_raw),
        "counts": {
            "total": len(entries),
            "decided": len(indexed),
            "pending": len(entries) - len(indexed),
        },
        "entries": entries,
        "claim_boundary": "Human review evidence; decisions do not automatically retrain a model",
    }


def _write_json_atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build", help="build a traceable offline review queue")
    build.add_argument("--input", type=Path, required=True)
    build.add_argument("--baseline-count", type=int, required=True)
    build.add_argument("--output-dir", type=Path, required=True)
    record = subparsers.add_parser("record", help="bind human decisions to a review queue")
    record.add_argument("--queue", type=Path, required=True)
    record.add_argument("--decisions", type=Path, required=True)
    record.add_argument("--recorded-at", required=True)
    record.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "build":
            targets = [args.output_dir / "manufacturing_report.json", args.output_dir / "review_queue.json"]
            if any(args.input.resolve() == target.resolve() for target in targets):
                raise ManufacturingReviewError("output must not overwrite the input")
            report, queue = build_review_package(args.input.read_bytes(), args.baseline_count)
            _write_json_atomic(targets[0], report)
            _write_json_atomic(targets[1], queue)
        else:
            if args.output.resolve() in {args.queue.resolve(), args.decisions.resolve()}:
                raise ManufacturingReviewError("output must not overwrite queue or decisions")
            audit = record_review_decisions(
                args.queue.read_bytes(), args.decisions.read_bytes(), recorded_at=args.recorded_at
            )
            _write_json_atomic(args.output, audit)
    except (ManufacturingReviewError, OSError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
