"""Recompute persisted V1 selected-model evidence using only Python's stdlib."""
import argparse
import csv
import hashlib
import io
import json
import math
import platform
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value):
    result = float(value)
    require(math.isfinite(result), "non-finite number")
    return result


def integer(value):
    result = number(value)
    require(result.is_integer(), "non-integer count or label")
    return int(result)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON key: " + key)
        result[key] = value
    return result


def read_json(raw):
    def invalid(value):
        raise ValueError("invalid JSON constant: " + value)
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid)


def read_csv(raw):
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
    headers = reader.fieldnames or []
    require(headers and len(headers) == len(set(headers)), "missing/duplicate CSV header")
    rows = list(reader)
    require(rows, "empty CSV")
    require(all(None not in row and all(v is not None for v in row.values())
                for row in rows), "malformed CSV row")
    return rows


def compare(actual, expected, context):
    for key, value in actual.items():
        require(key in expected, context + ": missing " + key)
        target = number(expected[key])
        matches = target == value if isinstance(value, int) else math.isclose(
            target, value, rel_tol=1e-9, abs_tol=1e-12)
        require(matches, context + ": mismatch " + key)


def average_precision(rows):
    """Non-interpolated AP, consuming all equal-score samples at each threshold."""
    positives = sum(row["label"] for row in rows)
    require(positives > 0, "AP requires positive labels")
    ordered = sorted(rows, key=lambda row: -row["score"])
    captured = seen = 0
    terms = []
    while seen < len(ordered):
        end = seen + 1
        while end < len(ordered) and ordered[end]["score"] == ordered[seen]["score"]:
            end += 1
        added = sum(row["label"] for row in ordered[seen:end])
        captured += added
        terms.append(added / positives * captured / end)
        seen = end
    return math.fsum(terms)


def recompute(directory):
    directory = Path(directory)
    names = ("manifest.json", "config.json", "test_split.csv", "priority_table.csv",
             "test_metrics.csv", "top_k_test.csv")
    raw = {name: (directory / name).read_bytes() for name in names}
    manifest, config = (read_json(raw[name]) for name in names[:2])
    require(manifest["config"] == config, "manifest/config disagreement")
    require(config["train_size"] == 1175 and config["test_size"] == 392,
            "unsupported V1 split")
    require(config["top_k_fractions"] == [0.05, 0.1, 0.2], "unsupported V1 budgets")
    require(manifest["threshold"] == 0.5, "unsupported V1 threshold")
    require(manifest["evaluation_status"] ==
            "provisional_due_to_prior_engineering_smoke_test_exposure",
            "V1 exposure boundary changed")
    model = manifest["selected_candidate_from_train_cv"]
    require(model == "random_forest_depth_none_leaf_8", "unsupported V1 selected model")
    split = read_csv(raw["test_split.csv"])
    require(len(split) == 392, "incomplete V1 split")
    by_id = {row["sample_id"]: row for row in split}
    require(len(by_id) == len(split), "duplicate split sample")
    require(all(integer(row["label"]) in (0, 1) for row in split), "non-binary split label")
    require(sum(integer(row["label"]) for row in split) == 24, "V1 positive count changed")
    evidence = read_csv(raw["priority_table.csv"])
    require(len(evidence) == len(split), "prediction count mismatch")
    rows, ids = [], set()
    for position, row in enumerate(evidence, 1):
        sample = row["sample_id"]
        require(sample in by_id and sample not in ids, "missing/duplicate/unknown prediction sample")
        ids.add(sample)
        label, prediction = integer(row["label"]), integer(row["prediction"])
        score = number(row["risk_score"])
        require(0 <= score <= 1 and label in (0, 1) and prediction in (0, 1),
                "invalid probability or binary value")
        require(integer(row["rank"]) == position, "rank mismatch")
        require(row["model"] == model, "model mismatch")
        require(label == integer(by_id[sample]["label"]) and
                row["timestamp"] == by_id[sample]["timestamp"], "split identity mismatch")
        require(prediction == int(score >= 0.5), "threshold/prediction mismatch")
        rows.append(dict(sample_id=sample, label=label, prediction=prediction, score=score))
    require(rows == sorted(rows, key=lambda row: (-row["score"], row["sample_id"])),
            "priority order mismatch")
    tn = sum(row["label"] == 0 and row["prediction"] == 0 for row in rows)
    fp = sum(row["label"] == 0 and row["prediction"] == 1 for row in rows)
    fn = sum(row["label"] == 1 and row["prediction"] == 0 for row in rows)
    tp = sum(row["label"] == 1 and row["prediction"] == 1 for row in rows)
    recall, precision = tp / (tp + fn), tp / (tp + fp) if tp + fp else 0.0
    metrics = dict(threshold=0.5, pr_auc_average_precision=average_precision(rows),
                   fail_recall=recall, precision=precision,
                   f1=2 * tp / (2 * tp + fp + fn),
                   balanced_accuracy=(recall + tn / (tn + fp)) / 2,
                   false_alarm_rate=fp / (fp + tn), accuracy=(tp + tn) / len(rows),
                   tn=tn, fp=fp, fn=fn, tp=tp)
    selected = [row for row in read_csv(raw["test_metrics.csv"]) if row["candidate"] == model]
    require(len(selected) == 1 and selected[0]["family"] == "random_forest",
            "missing/duplicate selected metric row")
    compare(metrics, selected[0], "classification")
    top_rows = read_csv(raw["top_k_test.csv"])
    require(len(top_rows) == 3 and sorted(number(row["k_fraction"]) for row in top_rows)
            == config["top_k_fractions"], "missing/duplicate/unexpected Top-K budgets")
    top_k = []
    for fraction in config["top_k_fractions"]:
        count = math.ceil(len(rows) * fraction)
        captured = sum(row["label"] for row in rows[:count])
        item = dict(k_fraction=fraction, inspection_count=count, captured_fail=captured,
                    total_fail=tp + fn, fail_capture_rate=captured / (tp + fn),
                    false_inspections=count - captured, precision=captured / count,
                    inspection_burden=count / len(rows),
                    lift=(captured / count) / ((tp + fn) / len(rows)))
        target = next(row for row in top_rows if number(row["k_fraction"]) == fraction)
        compare(item, target, "Top-K")
        top_k.append(item)
    return dict(schema="fabguard.persisted-evidence-audit.v1", status="consistent",
                scope="persisted selected-model predictions; no model inference or external validation",
                evaluation_status=manifest["evaluation_status"], model=model, sample_count=len(rows),
                python=platform.python_version(), metrics=metrics, top_k=top_k,
                input_sha256={name: hashlib.sha256(content).hexdigest() for name, content in raw.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path,
                        default=Path(__file__).resolve().parents[1] / "results/v1")
    args = parser.parse_args()
    try:
        report = recompute(args.results)
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(1, "Evidence audit failed: " + str(exc) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
