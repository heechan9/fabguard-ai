"""Compare four private robot CSVs without fitting or loading any model.

Only aggregate evidence is written; input paths, row IDs and sensor values are
not copied into the report. This does not establish model-tree equivalence.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score

EXPECTED_SHA256 = {
    "reference_features": "6d810ca6c3dcb9fabdc0487fc567eb31698aeeaec512c7d6a886f34d0edaa9d9",
    "reproduced_features": "cf5f49d2394aa31be57b65b889739560716498025b50d3d3fccbd7cf7ed520ad",
    "reference_predictions": "2aae5498cf6ef262d54e3517caebba15fa95e5daa7140b2ffa459bcc8425b37b",
    "reproduced_predictions": "e0ecdace9f63f90d47242224fd6681fc1d83f14a206f2f9446572495ec769fc1",
}
FEATURE_METADATA = (
    "segment_id", "split", "label", "recording_group",
    "domain_shift_op", "domain_shift_env",
)
PREDICTION_METADATA = (
    "protocol", "segment_id", "split", "domain", "label", "recording_group",
)


def load_csv(path: Path, role: str):
    raw = path.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != EXPECTED_SHA256[role]:
        raise ValueError(f"unexpected SHA-256 for {role}: {actual}")
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        columns, rows = reader.fieldnames, list(reader)
    if not columns or len(set(columns)) != len(columns):
        raise ValueError(f"missing or duplicate columns for {role}")
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"malformed CSV rows for {role}")
    return columns, rows, {
        "sha256": actual, "bytes": len(raw), "crlf_count": raw.count(b"\r\n"),
        "lf_normalized_sha256": hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest(),
    }


def align(reference, reproduced, keys, metadata):
    columns_a, rows_a, _ = reference
    columns_b, rows_b, _ = reproduced
    key = lambda row: tuple(row[name] for name in keys)
    ids_a, ids_b = [key(row) for row in rows_a], [key(row) for row in rows_b]
    if len(set(ids_a)) != len(ids_a) or len(set(ids_b)) != len(ids_b):
        raise ValueError("duplicate row keys")
    if set(columns_a) != set(columns_b) or set(ids_a) != set(ids_b):
        raise ValueError("column sets or row-key sets differ")
    lookup = {key(row): row for row in rows_b}
    aligned_b = [lookup[value] for value in ids_a]
    checks = {
        "reference_shape": [len(rows_a), len(columns_a)],
        "reproduced_shape": [len(rows_b), len(columns_b)],
        "column_order_equal": columns_a == columns_b,
        "row_key_order_equal": ids_a == ids_b,
        "missing_keys": 0, "extra_keys": 0, "duplicate_keys": 0,
        "metadata_differences": {
            name: sum(a[name] != b[name] for a, b in zip(rows_a, aligned_b))
            for name in metadata
        },
    }
    return rows_a, aligned_b, checks


def numeric_errors(reference, reproduced):
    a, b = np.asarray(reference, dtype=float), np.asarray(reproduced, dtype=float)
    if not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError("nonfinite numeric values")
    delta = np.abs(b - a)
    relative = np.divide(delta, np.abs(a), out=np.zeros_like(delta), where=a != 0)
    return {
        "values": int(a.size), "exact_numeric_differences": int(np.count_nonzero(a != b)),
        "max_absolute_error": float(delta.max(initial=0)),
        "max_relative_error_nonzero_reference": float(relative.max(initial=0)),
        "reference_zero_reproduced_nonzero": int(np.count_nonzero((a == 0) & (b != 0))),
        "allclose_atol_1e-14_rtol_1e-14": bool(np.allclose(a, b, atol=1e-14, rtol=1e-14)),
    }


def evaluate(rows):
    ids = np.array([row["segment_id"] for row in rows], dtype=str)
    scores = np.array([float(row["anomaly_score"]) for row in rows])
    labels = np.array([int(row["label"]) for row in rows])
    if set(labels) != {0, 1} or not np.isfinite(scores).all():
        raise ValueError("evaluation requires finite scores and both labels")
    order = np.lexsort((ids, -scores))
    k = math.ceil(len(rows) * .1)
    ranking = ids[order].tolist()
    selected = set(ranking[:k])
    captured = set(ids[order[:k]][labels[order[:k]] == 1])
    kth, next_score = float(scores[order[k - 1]]), float(scores[order[k]])
    cutoff = {
        "k": k, "kth_score": kth, "next_score": next_score, "gap": kth - next_score,
        "tie_across_boundary": kth == next_score,
        "boundary_score_multiplicity": int(np.count_nonzero(scores == kth)),
        "exact_tie_groups_total": sum(n > 1 for n in collections.Counter(scores.tolist()).values()),
    }
    metrics = {
        "segments": len(rows), "anomalies": int(labels.sum()),
        "auroc": float(roc_auc_score(labels, scores)),
        "average_precision": float(average_precision_score(labels, scores)),
        "top_10_percent": {
            "inspected": k, "captured": len(captured), "total_anomalies": int(labels.sum()),
            "recall": len(captured) / int(labels.sum()), "false_alarms": k - len(captured),
        },
    }
    return metrics, ranking, selected, captured, cutoff


def compare(paths: dict[str, Path]):
    loaded = {name: load_csv(path, name) for name, path in paths.items()}
    result = {"schema_version": 1, "mode": "saved_files_only_no_training",
              "inputs": {name: value[2] for name, value in loaded.items()}}
    fa, fb, feature_checks = align(
        loaded["reference_features"], loaded["reproduced_features"],
        ("segment_id",), FEATURE_METADATA,
    )
    numeric = [name for name in loaded["reference_features"][0] if name not in FEATURE_METADATA]
    if len(fa) != 2303 or len(numeric) != 42:
        raise ValueError("unexpected feature dimensions")
    feature_checks["numeric"] = numeric_errors(
        [[float(row[name]) for name in numeric] for row in fa],
        [[float(row[name]) for name in numeric] for row in fb],
    )
    result["features"] = feature_checks
    pa, pb, prediction_checks = align(
        loaded["reference_predictions"], loaded["reproduced_predictions"],
        ("protocol", "segment_id"), PREDICTION_METADATA,
    )
    counts = dict(collections.Counter(row["protocol"] for row in pa))
    if counts != {"published_split": 464, "disjoint_recording_groups": 464}:
        raise ValueError("unexpected protocol counts")
    prediction_checks["rows_per_protocol"] = counts
    prediction_checks["scores"] = numeric_errors(
        [float(row["anomaly_score"]) for row in pa],
        [float(row["anomaly_score"]) for row in pb],
    )
    result["predictions"] = prediction_checks
    evaluations = []
    for protocol in sorted(counts):
        for domain in ("source", "target", "combined"):
            subsets = [[row for row in rows if row["protocol"] == protocol
                        and (domain == "combined" or row["domain"] == domain)] for rows in (pa, pb)]
            a, b = [evaluate(rows) for rows in subsets]
            positions_a, positions_b = [{value: i for i, value in enumerate(item[1])} for item in (a, b)]
            movements = [abs(positions_a[value] - positions_b[value]) for value in a[1]]
            evaluations.append({
                "protocol": protocol, "domain": domain,
                "reference_metrics": a[0], "reproduced_metrics": b[0],
                "metric_deltas": {name: b[0][name] - a[0][name] for name in ("auroc", "average_precision")},
                "budget_metrics_equal": a[0]["top_10_percent"] == b[0]["top_10_percent"],
                "rank_sequence_equal": a[1] == b[1],
                "moved_rank_ids": sum(value != 0 for value in movements),
                "max_rank_movement": max(movements),
                "selected_set_equal": a[2] == b[2], "captured_anomaly_set_equal": a[3] == b[3],
                "reference_cutoff": a[4], "reproduced_cutoff": b[4],
            })
    result["six_evaluations"] = evaluations
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in EXPECTED_SHA256:
        parser.add_argument("--" + name.replace("_", "-"), type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = compare({name: getattr(args, name) for name in EXPECTED_SHA256})
    with args.output.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
        stream.write("\n")


if __name__ == "__main__":
    main()
