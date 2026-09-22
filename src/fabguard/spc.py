"""Offline individual-value screening; no process control or defect prediction."""
import argparse
import csv
from datetime import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import platform
from statistics import mean


def individuals_report(values, baseline_count):
    """Freeze limits on the prefix. Missing monitoring values remain unknown."""
    values = list(values)
    if type(baseline_count) is not int or not 10 <= baseline_count < len(values):
        raise ValueError("Need at least 10 baseline values and one later observation")
    for value in values:
        if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
            raise ValueError("Values must be finite numbers or None")
    baseline = values[:baseline_count]
    if any(value is None for value in baseline):
        raise ValueError("Baseline cannot contain missing values")
    center = mean(baseline)
    mr = mean(abs(b - a) for a, b in zip(baseline, baseline[1:]))
    lower, upper = center - 3 * mr / 1.128, center + 3 * mr / 1.128
    if not all(math.isfinite(v) for v in (center, mr, lower, upper)) or mr <= 0:
        raise ValueError("Baseline variation must be positive and finite")
    if not lower < center < upper:
        raise ValueError("Numerical precision cannot resolve control limits")
    baseline_flags = [i + 1 for i, value in enumerate(baseline) if value < lower or value > upper]
    rows = []
    for index, value in enumerate(values[baseline_count:], baseline_count + 1):
        status = ("unknown" if value is None else
                  "baseline_review_required" if baseline_flags else
                  "below_limit" if value < lower else
                  "above_limit" if value > upper else "within_limits")
        rows.append({"row": index, "value": value, "status": status})
    return {
        "method": "individuals_mean_moving_range_3sigma",
        "baseline_count": baseline_count,
        "center": center, "mean_moving_range": mr, "lcl": lower, "ucl": upper,
        "baseline_flagged_rows": baseline_flags,
        "baseline_status": "review_required" if baseline_flags else "not_independently_validated",
        "counts": {status: sum(row["status"] == status for row in rows) for status in
                   ("unknown", "baseline_review_required", "below_limit", "above_limit", "within_limits")},
        "observations": rows,
    }


def csv_report(raw, baseline_count, data_role):
    if data_role not in ("observed", "synthetic"):
        raise ValueError("Declare observed or synthetic input")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    if reader.fieldnames != ["timestamp", "value"]:
        raise ValueError("Expected exactly timestamp,value columns")
    values, timestamps = [], []
    previous = None
    for row in reader:
        if None in row or any(value is None for value in row.values()):
            raise ValueError("Malformed CSV row")
        stamp = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
        if stamp.utcoffset() is None or (previous is not None and stamp <= previous):
            raise ValueError("Timestamps must be timezone-aware, unique and increasing")
        previous = stamp
        timestamps.append(row["timestamp"])
        values.append(float(row["value"]) if row["value"].strip() else None)
    result = individuals_report(values, baseline_count)
    for row, stamp in zip(result["observations"], timestamps[baseline_count:]):
        row["timestamp"] = stamp
    result.update({
        "schema_version": 1, "data_role": data_role,
        "provenance": "user_declared_not_verified",
        "input_sha256": hashlib.sha256(raw).hexdigest(),
        "python_version": platform.python_version(),
        "baseline_end": timestamps[baseline_count - 1],
        "limitations": ["Offline screening only; no field validation",
                        "Control limits are not product specification limits",
                        "Within limits does not prove stability or product quality",
                        "No causal attribution, capability index or equipment control",
                        "Sampling consistency, independence and baseline suitability require review"],
    })
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--baseline-count", type=int, required=True)
    parser.add_argument("--data-role", choices=("observed", "synthetic"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Output must not overwrite input")
    try:
        result = csv_report(args.input.read_bytes(), args.baseline_count, args.data_role)
        result["reproduce"] = {"baseline_count": args.baseline_count, "data_role": args.data_role}
        payload = json.dumps(result, indent=2, allow_nan=False) + "\n"
    except (ValueError, OverflowError, OSError) as error:
        parser.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(payload, encoding="utf-8")


if __name__ == "__main__":
    main()
