"""Offline IMAD-DS robotic-arm condition-screening benchmark.

This is a separate experiment from the SECOM manufacturing-failure model.
It ranks recorded segments; it does not control a robot or predict fab yield.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import platform
import zlib
from pathlib import Path, PurePosixPath

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

SENSORS = {
    "imp23absu_mic": ("MIC [Waveform]",),
    "ism330dhcx_acc": ("A_x [g]", "A_y [g]", "A_z [g]"),
    "ism330dhcx_gyro": ("G_x [mdps]", "G_y [mdps]", "G_z [mdps]"),
}
SPLITS = {
    "normal_source_train": (1812, 0),
    "normal_target_train": (27, 0),
    "normal_source_test": (116, 0),
    "anomaly_source_test": (116, 1),
    "normal_target_test": (116, 0),
    "anomaly_target_test": (116, 1),
}
EXPECTED_MD5 = "a64498b7dcc297946a7fb8366e38ba33"
SEED = 42


def digest(path: Path, algorithm: str = "sha256") -> str:
    h = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def recording_group(segment_id: str) -> str:
    if "_dataLog_" not in segment_id:
        raise ValueError(f"unknown segment ID format: {segment_id}")
    return segment_id.rsplit("_dataLog_", 1)[0]


def verify_archive_members(root: Path, archive: Path) -> dict[str, object]:
    """Bind each extracted input byte to a member of the pinned 7z archive."""
    import py7zr

    if root.is_symlink() or root.name != "RoboticArm" or not root.is_dir():
        raise ValueError("data directory must be a real extracted RoboticArm folder")
    expected: dict[Path, object] = {}
    with py7zr.SevenZipFile(archive, "r") as source:
        for member in source.list():
            path = PurePosixPath(member.filename)
            if (path.is_absolute() or ".." in path.parts or "." in path.parts
                    or not path.parts or path.parts[0] != root.name):
                raise ValueError(f"unsafe archive member: {member.filename}")
            if member.is_directory:
                continue
            if len(path.parts) != 3 or path.parts[1] not in {"train", "test"}:
                raise ValueError(f"unexpected archive member: {member.filename}")
            relative = Path(*path.parts[1:])
            if relative in expected or member.crc32 is None or member.uncompressed is None:
                raise ValueError(f"duplicate or unverifiable archive member: {member.filename}")
            expected[relative] = member
    actual = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"symlink in extracted data: {path}")
        if path.is_file():
            actual.add(path.relative_to(root))
    if actual != set(expected):
        raise ValueError(f"archive/extracted file list differs: missing={len(set(expected) - actual)}, extra={len(actual - set(expected))}")
    manifest = hashlib.sha256()
    for relative, member in sorted(expected.items()):
        path = root / relative
        crc = 0
        sha = hashlib.sha256()
        size = 0
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
                size += len(block)
                crc = zlib.crc32(block, crc)
                sha.update(block)
        if size != member.uncompressed or crc != member.crc32:
            raise ValueError(f"archive/extracted member differs: {relative}")
        manifest.update(f"{relative.as_posix()}\t{size}\t{sha.hexdigest()}\n".encode())
    return {"members_verified": len(expected), "member_manifest_sha256": manifest.hexdigest()}


def load_mapping(root: Path) -> pd.DataFrame:
    rows = []
    for name, (count, label) in SPLITS.items():
        folder = "train" if name.endswith("_train") else "test"
        path = root / folder / f"attributes_{name}.csv"
        frame = pd.read_csv(path)
        required = {"segment_id", "split_label", "anomaly_label", "domain_shift_op",
                    "domain_shift_env", *SENSORS}
        if set(frame) != required or len(frame) != count or frame.isna().any().any():
            raise ValueError(f"unexpected mapping schema/count/missing values: {path}")
        if set(frame["anomaly_label"]) != ({"normal"} if label == 0 else {"loosescrewsA"}):
            raise ValueError(f"unexpected labels: {path}")
        if set(frame["split_label"]) != {"_".join(word.capitalize() for word in name.split("_"))}:
            raise ValueError(f"unexpected split labels: {path}")
        frame["split"] = name
        frame["label"] = label
        frame["recording_group"] = frame["segment_id"].map(recording_group)
        for sensor in SENSORS:
            if frame[sensor].duplicated().any():
                raise ValueError(f"reused sensor file in {path}: {sensor}")
            for segment_id, value in zip(frame["segment_id"], frame[sensor]):
                if (Path(value).name != value or value != f"{sensor}_{segment_id}.parquet"
                        or not (root / folder / value).is_file()):
                    raise ValueError(f"unsafe or missing sensor file: {value}")
        rows.append(frame)
    result = pd.concat(rows, ignore_index=True)
    if result["segment_id"].duplicated().any():
        raise ValueError("segment ID appears in multiple splits")
    for sensor in SENSORS:
        if result[sensor].duplicated().any():
            raise ValueError(f"sensor file appears in multiple splits: {sensor}")
    return result


def channel_features(values: np.ndarray, prefix: str) -> dict[str, float]:
    values = np.asarray(values, dtype=np.float64)
    valid = values[np.isfinite(values)]
    if not len(valid):
        result = {f"{prefix}_{name}": float("nan") for name in
                  ("mean", "std", "rms", "abs_p95", "diff_rms")}
        result[f"{prefix}_valid_fraction"] = 0.0
        return result
    delta = np.diff(values)
    delta = delta[np.isfinite(delta)]
    return {
        f"{prefix}_mean": float(np.mean(valid)),
        f"{prefix}_std": float(np.std(valid)),
        f"{prefix}_rms": float(np.sqrt(np.mean(valid ** 2))),
        f"{prefix}_abs_p95": float(np.quantile(np.abs(valid), .95)),
        f"{prefix}_diff_rms": float(np.sqrt(np.mean(delta ** 2))) if len(delta) else float("nan"),
        f"{prefix}_valid_fraction": float(len(valid) / len(values)),
    }


def sensor_features(path: Path, sensor: str) -> dict[str, float]:
    frame = pd.read_parquet(path)
    expected = {"Time", *SENSORS[sensor]}
    if set(frame) != expected or len(frame) < 2:
        raise ValueError(f"unexpected sensor schema/length: {path}")
    times = frame["Time"].to_numpy(dtype=float)
    if not np.isfinite(times).all() or not (np.diff(times) > 0).all():
        raise ValueError(f"invalid relative timestamps: {path}")
    features: dict[str, float] = {}
    for col in SENSORS[sensor]:
        suffix = col.split(" ")[0].replace("[", "").replace("]", "").replace("_", "")
        features.update(channel_features(frame[col].to_numpy(dtype=float), f"{sensor}_{suffix}"))
    return features


def extract_features(root: Path, mapping: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for i, row in enumerate(mapping.itertuples(index=False), 1):
        folder = "train" if row.split.endswith("_train") else "test"
        features: dict[str, object] = {
            "segment_id": row.segment_id,
            "split": row.split,
            "label": row.label,
            "recording_group": row.recording_group,
            "domain_shift_op": row.domain_shift_op,
            "domain_shift_env": row.domain_shift_env,
        }
        for sensor in SENSORS:
            features.update(sensor_features(root / folder / getattr(row, sensor), sensor))
        rows.append(features)
        if i % 200 == 0:
            print(f"features {i}/{len(mapping)}", flush=True)
    return pd.DataFrame(rows)


def top_budget(y: np.ndarray, score: np.ndarray, ids: np.ndarray, fraction: float = .10) -> dict[str, int | float]:
    k = math.ceil(len(y) * fraction)
    order = np.lexsort((ids.astype(str), -score))
    captured = int(np.sum(y[order[:k]]))
    return {"inspected": k, "captured": captured, "total_anomalies": int(y.sum()),
            "recall": captured / int(y.sum()), "false_alarms": k - captured}


def evaluate(frame: pd.DataFrame, score: np.ndarray, protocol: str, domain: str) -> dict[str, object]:
    y = frame["label"].to_numpy(dtype=int)
    if set(y) != {0, 1} or not np.isfinite(score).all():
        raise ValueError("evaluation needs two labels and finite scores")
    return {"protocol": protocol, "domain": domain, "segments": len(y),
            "anomalies": int(y.sum()), "auroc": float(roc_auc_score(y, score)),
            "average_precision": float(average_precision_score(y, score)),
            "top_10_percent": top_budget(y, score, frame["segment_id"].to_numpy())}


def fit_model(features: pd.DataFrame, train_ids: set[str], numeric: list[str]):
    train = features[features["segment_id"].isin(train_ids)]
    if len(train) != len(train_ids) or set(train["label"]) != {0}:
        raise ValueError("model must fit distinct, normal-only training IDs")
    pipeline = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                             IsolationForest(n_estimators=200, max_samples=min(256, len(train)),
                                             random_state=SEED, n_jobs=4))
    pipeline.fit(train[numeric])
    return pipeline


def training_protocols(source: pd.DataFrame, test: pd.DataFrame) -> dict[str, set[str]]:
    if set(source["segment_id"]) & set(test["segment_id"]):
        raise ValueError("identical segments in training and test")
    test_groups = set(test["recording_group"])
    strict = source[~source["recording_group"].isin(test_groups)]
    if not len(strict) or set(strict["recording_group"]) & test_groups:
        raise ValueError("no disjoint training sessions")
    return {"published_split": set(source["segment_id"]),
            "disjoint_recording_groups": set(strict["segment_id"])}


def run(root: Path, archive: Path, output: Path) -> dict[str, object]:
    try:
        parquet_version = importlib.metadata.version("pyarrow")
    except importlib.metadata.PackageNotFoundError as error:
        raise RuntimeError("install fabguard-ai[robot] to read sensor Parquet") from error
    archive_md5 = digest(archive, "md5")
    if archive_md5 != EXPECTED_MD5:
        raise ValueError(f"wrong IMAD-DS archive MD5: {archive_md5}")
    archive_members = verify_archive_members(root, archive)
    output.mkdir(parents=True, exist_ok=True)
    mapping = load_mapping(root)
    features = extract_features(root, mapping)
    numeric = [col for col in features if col not in
               {"segment_id", "split", "label", "recording_group", "domain_shift_op", "domain_shift_env"}]
    if not numeric or features[numeric].isna().all(axis=0).any():
        raise ValueError("no usable sensor features")
    features.to_csv(output / "segment_features.csv", index=False)

    source = features[features["split"] == "normal_source_train"]
    test = features[features["split"].str.endswith("_test")].copy()
    test["domain"] = test["split"].str.split("_").str[1]
    # The published split overlaps recording sessions. The second protocol
    # removes *every* test recording session from the fit set, at the cost of
    # reducing normal-source training from 1,812 to 214 segments.
    protocols = training_protocols(source, test)

    results = []
    predictions = []
    model_hashes = {}
    for protocol, train_ids in protocols.items():
        model = fit_model(features, train_ids, numeric)
        joblib.dump({"pipeline": model, "features": numeric,
                     "protocol": protocol, "source_archive_md5": archive_md5},
                    output / f"{protocol}.joblib")
        model_hashes[protocol] = digest(output / f"{protocol}.joblib")
        for domain in ("source", "target", "combined"):
            subset = test if domain == "combined" else test[test["domain"] == domain]
            scores = -model.decision_function(subset[numeric])
            results.append(evaluate(subset, scores, protocol, domain))
            if domain != "combined":
                for row, score in zip(subset.itertuples(index=False), scores):
                    predictions.append({"protocol": protocol, "segment_id": row.segment_id,
                                        "split": row.split, "domain": domain, "label": row.label,
                                        "recording_group": row.recording_group,
                                        "anomaly_score": float(score)})
    pd.DataFrame(predictions).to_csv(output / "test_predictions.csv", index=False)
    with (output / "metrics.json").open("w") as stream:
        json.dump(results, stream, indent=2)
        stream.write("\n")
    overlaps = {}
    for protocol, ids in protocols.items():
        train_groups = set(source.loc[source["segment_id"].isin(ids), "recording_group"])
        overlaps[protocol] = {
            split: int(group["recording_group"].isin(train_groups).sum())
            for split, group in test.groupby("split")
        }
    report = {
        "status": "offline_benchmark_only",
        "dataset": "IMAD-DS v2 RoboticArm",
        "archive_md5": archive_md5, "archive_sha256": digest(archive),
        "archive_member_verification": archive_members,
        "mapping_segment_counts": mapping.groupby("split").size().to_dict(),
        "train_segments": {name: len(ids) for name, ids in protocols.items()},
        "train_recording_groups": {name: int(source.loc[source["segment_id"].isin(ids),
                                                      "recording_group"].nunique())
                                   for name, ids in protocols.items()},
        "test_group_overlap_counts": overlaps,
        "feature_columns": numeric,
        "feature_csv_sha256": digest(output / "segment_features.csv"),
        "model_sha256": model_hashes,
        "metrics": results,
        "environment": {"python": platform.python_version(), "numpy": np.__version__,
                        "pandas": pd.__version__, "scikit_learn": sklearn.__version__,
                        "pyarrow": parquet_version, "joblib": joblib.__version__},
        "claim_boundary": "Bench-scale, intentionally induced screw-loosening anomaly; no real fab, wafer damage, yield, lead-time or online deployment claim.",
    }
    with (output / "report.json").open("w") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True, help="extracted RoboticArm directory")
    parser.add_argument("--archive", type=Path, required=True, help="original RoboticArm.7z for hash check")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    report = run(args.data_dir, args.archive, args.output_dir)
    print(json.dumps(report["metrics"], indent=2))


if __name__ == "__main__":
    main()
