"""Offline change-history review; never refits limits or controls equipment."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from .integrations.fledge_contract import normalize_fledge_readings
from .manufacturing_review import (
    DECISION_SCHEMA, ManufacturingReviewError, _write_json_atomic as _atomic_json, _aware_timestamp,
    _canonical_bytes, _nonempty, _python_number, _sha256, _validate_trace,
    build_review_package, record_review_decisions,
)

HISTORY_SCHEMA = "fabguard-maintenance-history/v1"
PACKAGE_SCHEMA = "fabguard-context-review/v1"
DECISIONS_SCHEMA = "fabguard-context-review-decisions/v1"
KINDS = {"maintenance", "calibration", "recipe_change"}
LIMIT = 20000


def _object(raw: bytes) -> dict:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ManufacturingReviewError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    def constant(value):
        raise ManufacturingReviewError(f"nonfinite JSON constant: {value}")

    if len(raw) > 5 * 1024 * 1024:
        raise ManufacturingReviewError("JSON exceeds 5 MiB")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)
    except (ValueError, UnicodeError) as error:
        raise ManufacturingReviewError(str(error)) from error
    if not isinstance(value, dict):
        raise ManufacturingReviewError("JSON root must be an object")
    return value


def _fields(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ManufacturingReviewError(f"{label} fields do not match the contract")


def build_context_review(events_raw: bytes, history_raw: bytes, baseline_count: int, *, as_of: str) -> dict:
    """Review the whole batch at a declared knowledge cutoff, not a historical backtest."""
    source, history = _object(events_raw), _object(history_raw)
    if not isinstance(source.get("readings"), list) or len(source["readings"]) > LIMIT:
        raise ManufacturingReviewError("readings must contain at most 20000 entries")
    report, original_queue = build_review_package(events_raw, baseline_count)
    cutoff = _aware_timestamp(as_of, "as_of")
    measurement = report["measurement"]
    frame = normalize_fledge_readings(source["readings"], required_measurements=(measurement["name"],))
    times = [row["event_time"].to_pydatetime() for _, row in frame.iterrows()]
    if times[-1] > cutoff:
        raise ManufacturingReviewError("measurement after the decision cutoff")
    _fields(history, {"schema_version", "source_id", "data_role", "equipment_id", "process_step",
                      "available_at", "coverage", "changes"}, "history")
    if history["schema_version"] != HISTORY_SCHEMA or history["data_role"] != source["data_role"]:
        raise ManufacturingReviewError("history schema or data role mismatch")
    _nonempty(history["source_id"], "history.source_id")
    for field in ("equipment_id", "process_step"):
        if history[field] != report["stream_dimensions"][field]:
            raise ManufacturingReviewError(f"history {field} differs from the measured stream")
    published = _aware_timestamp(history["available_at"], "history.available_at")
    if published > cutoff:
        raise ManufacturingReviewError("history was unavailable at the declared cutoff")
    coverage = history["coverage"]
    _fields(coverage, {"start", "end", "complete"}, "coverage")
    start = _aware_timestamp(coverage["start"], "coverage.start")
    end = _aware_timestamp(coverage["end"], "coverage.end")
    if start > end or end > published or type(coverage["complete"]) is not bool:
        raise ManufacturingReviewError("coverage dates or completeness declaration are invalid")
    changes = history["changes"]
    if not isinstance(changes, list) or len(changes) > LIMIT:
        raise ManufacturingReviewError("changes must be an array of at most 20000 entries")
    matched, excluded, ids = [], [], set()
    for event in changes:
        _fields(event, {"change_id", "equipment_id", "process_step", "kind", "effective_at",
                        "available_at", "description"}, "change")
        for field in ("change_id", "equipment_id", "process_step", "description"):
            _nonempty(event[field], f"change.{field}")
        if event["change_id"] in ids or event["kind"] not in KINDS:
            raise ManufacturingReviewError("duplicate change ID or unsupported change kind")
        ids.add(event["change_id"])
        effective = _aware_timestamp(event["effective_at"], "change.effective_at")
        available = _aware_timestamp(event["available_at"], "change.available_at")
        if available > published:
            raise ManufacturingReviewError("change information postdates its history snapshot")
        if any(event[field] != history[field] for field in ("equipment_id", "process_step")):
            excluded.append(event["change_id"])
            continue
        matched.append((effective, event))
    matched.sort(key=lambda pair: (pair[0], pair[1]["change_id"]))
    base_end = times[baseline_count - 1]
    base_changes = [event["change_id"] for time, event in matched if times[0] <= time <= base_end]
    coverage_ok = coverage["complete"] and start <= times[0] and end >= times[-1]
    # Reuse the existing normalized event evidence and exact frozen-SPC calculation.
    queue = {**original_queue, "items": []}
    input_sha = _sha256(events_raw)
    traces = {str(normalize_fledge_readings([reading], required_measurements=(measurement["name"],))
                  .iloc[0]["sample_id"]): _validate_trace(reading, index=index, measurement_name=measurement["name"],
                                                     measurement_unit=measurement["unit"])
              for index, reading in enumerate(source["readings"])}
    observations = []
    original_by_id = {item["review_id"]: item for item in original_queue["items"]}
    for observation in report["spc"]["observations"]:
        index = int(observation["row"]) - 1
        row, at = frame.iloc[index], times[index]
        sample_id = str(row["sample_id"])
        review_id = hashlib.sha256(f"{input_sha}:{sample_id}:{measurement['name']}".encode()).hexdigest()[:24]
        reasons = []
        if not coverage_ok:
            reasons.append("history_coverage_unverified")
        if base_changes:
            reasons.append("change_inside_baseline")
        after_changes = [event["change_id"] for time, event in matched if base_end < time <= at]
        if after_changes:
            reasons.append("change_after_baseline")
        if observation["status"] == "unknown":
            reasons.append("measurement_missing")
        if report["spc"]["baseline_flagged_rows"]:
            reasons.append("statistical_baseline_requires_review")
        evidence = {"sample_id": sample_id, "event_time": at.isoformat(),
                    "measurement": measurement["name"], "unit": measurement["unit"],
                    "value": _python_number(row[f"measurement__{measurement['name']}"]),
                    "trace": traces[sample_id]}
        item = original_by_id.get(review_id, {
            "review_id": review_id, **evidence,
            "event_evidence_sha256": _sha256(_canonical_bytes(evidence)),
            "screening_status": observation["status"], "screening_severity": None,
            "priority_class": "P3_CONTEXT_REVIEW",
            "claim_boundary": "Reference statistic only; not product approval or a control command",
        })
        if reasons:
            item = {**item, "priority_class": "BLOCKED_CONTEXT", "screening_severity": None}
        queue["items"].append(item)
        observations.append({"review_id": review_id, **evidence,
                             "reference_status": observation["status"],
                             "context_state": "withheld" if reasons else "context_clear",
                             "reasons": reasons, "related_changes": base_changes + after_changes})
    result = {
        "schema_version": PACKAGE_SCHEMA, "as_of": cutoff.isoformat(),
        "baseline_count": baseline_count, "baseline_end": base_end.isoformat(),
        "source_input_sha256": _sha256(events_raw), "history_input_sha256": _sha256(history_raw),
        "data_role": source["data_role"], "measurement": measurement,
        "stream_dimensions": report["stream_dimensions"],
        "reference_limits": {key: report["spc"][key] for key in ("center", "lcl", "ucl")},
        "history_coverage_verified_by_declaration": bool(coverage_ok),
        "timeline": [{**event, "period": "before_baseline" if at < times[0] else
                      "baseline" if at <= base_end else "monitoring" if at <= times[-1] else "scheduled"}
                     for at, event in matched],
        "excluded_other_stream_changes": excluded, "observations": observations, "queue": queue,
        "limitations": ["Declared batch review cutoff, not a historical performance backtest",
                        "History completeness and provenance are user declarations, not authenticated",
                        "Context clear does not prove stability, quality, causality or detection performance",
                        "No automatic rebaseline, release, equipment control or model update"],
    }
    if len((json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False)+"\n").encode()) > 5 * 1024 * 1024:
        raise ManufacturingReviewError("review package exceeds 5 MiB; use a smaller batch")
    return result


def record_context_review(events_raw: bytes, history_raw: bytes, package_raw: bytes,
                          decisions_raw: bytes, *, recorded_at: str) -> dict:
    package, envelope = _object(package_raw), _object(decisions_raw)
    if package.get("schema_version") != PACKAGE_SCHEMA:
        raise ManufacturingReviewError("context package schema mismatch")
    rebuilt = build_context_review(events_raw, history_raw, package.get("baseline_count"), as_of=package.get("as_of"))
    if _canonical_bytes(rebuilt) != _canonical_bytes(package):
        raise ManufacturingReviewError("context package differs from recomputed source evidence")
    _fields(envelope, {"schema_version", "context_package_sha256", "decisions"}, "decision envelope")
    if envelope["schema_version"] != DECISIONS_SCHEMA or envelope["context_package_sha256"] != _sha256(package_raw):
        raise ManufacturingReviewError("decisions are not bound to this exact context package")
    audit = record_review_decisions(_canonical_bytes(package["queue"]),
                                   _canonical_bytes({"schema_version": DECISION_SCHEMA, "decisions": envelope["decisions"]}),
                                   recorded_at=recorded_at)
    by_id = {row["review_id"]: row for row in package["observations"]}
    for decision in envelope["decisions"]:
        row = by_id[decision["review_id"]]
        if _aware_timestamp(decision["decided_at"], "decided_at") < _aware_timestamp(package["as_of"], "as_of"):
            raise ManufacturingReviewError("decision predates the reviewed knowledge snapshot")
        if row["context_state"] == "withheld" and (decision["outcome"] != "insufficient_evidence" or
                decision["action"] not in {"hold", "equipment_check", "reinspect"}):
            raise ManufacturingReviewError("withheld context cannot be released or resolved by this workflow")
    return {**audit, "schema_version": "fabguard-context-review-audit/v1",
            "context_package_sha256": _sha256(package_raw),
            "history_input_sha256": _sha256(history_raw), "source_input_sha256": _sha256(events_raw),
            "claim_boundary": "Local reviewer declaration only; no authenticated approval or equipment action"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "record"))
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline-count", type=int)
    parser.add_argument("--as-of")
    parser.add_argument("--package", type=Path)
    parser.add_argument("--decisions", type=Path)
    parser.add_argument("--recorded-at")
    args = parser.parse_args()
    try:
        inputs = [p.resolve() for p in (args.input, args.history, args.package, args.decisions) if p]
        if args.output.resolve() in inputs:
            raise ManufacturingReviewError("output must not overwrite an input")
        events, history = args.input.read_bytes(), args.history.read_bytes()
        if args.command == "build":
            result = build_context_review(events, history, args.baseline_count, as_of=args.as_of)
        else:
            if not args.package or not args.decisions or not args.recorded_at:
                raise ManufacturingReviewError("record requires package, decisions and recorded-at")
            result = record_context_review(events, history, args.package.read_bytes(),
                                           args.decisions.read_bytes(), recorded_at=args.recorded_at)
        _atomic_json(args.output, result)
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(2, f"maintenance review refused: {error}\n")


if __name__ == "__main__":
    main()
