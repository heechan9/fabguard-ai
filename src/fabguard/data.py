"""SECOM loading, integrity validation, audit, and time holdout splitting."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

from .config import ExperimentConfig, OFFICIAL_HASHES


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_raw_files(data_dir: Path, verify_hashes: bool = True) -> dict[str, str]:
    actual: dict[str, str] = {}
    for name, expected in OFFICIAL_HASHES.items():
        path = data_dir / name
        if not path.exists():
            raise FileNotFoundError(f"Missing official SECOM file: {path}")
        actual[name] = sha256_file(path)
        if verify_hashes and actual[name] != expected:
            raise ValueError(f"SHA-256 mismatch for {name}: {actual[name]} != {expected}")
    return actual


def load_secom(data_dir: Path, verify_hashes: bool = True) -> pd.DataFrame:
    hashes = validate_raw_files(data_dir, verify_hashes=verify_hashes)
    features = pd.read_csv(data_dir / "secom.data", sep=r"\s+", header=None, na_values="NaN")
    features.columns = [f"feature_{index:03d}" for index in range(features.shape[1])]
    labels = pd.read_csv(
        data_dir / "secom_labels.data",
        sep=r"\s+",
        header=None,
        names=["raw_label", "timestamp_text"],
    )
    timestamps = pd.to_datetime(labels["timestamp_text"], format="%d/%m/%Y %H:%M:%S", errors="raise")

    if features.shape != (1567, 590):
        raise ValueError(f"Unexpected feature matrix shape: {features.shape}")
    if len(labels) != len(features):
        raise ValueError("Feature and label row counts do not match")
    if set(labels["raw_label"].unique()) != {-1, 1}:
        raise ValueError("Unexpected label values")

    frame = features.copy()
    frame.insert(0, "sample_id", [f"secom_{index:04d}" for index in range(len(frame))])
    frame["timestamp"] = timestamps
    frame["label"] = (labels["raw_label"] == 1).astype(int)
    frame.attrs["hashes"] = hashes
    return frame


def audit_frame(frame: pd.DataFrame) -> dict[str, object]:
    feature_columns = [column for column in frame if column.startswith("feature_")]
    features = frame[feature_columns]
    missing_rates = features.isna().mean()
    non_missing_unique = features.nunique(dropna=True)
    duplicate_mask = features.T.duplicated(keep="first")
    return {
        "samples": int(len(frame)),
        "measurement_features": int(len(feature_columns)),
        "pass_count": int((frame["label"] == 0).sum()),
        "fail_count": int((frame["label"] == 1).sum()),
        "fail_rate": float(frame["label"].mean()),
        "timestamp_parse_failures": int(frame["timestamp"].isna().sum()),
        "timestamp_min": frame["timestamp"].min().isoformat(),
        "timestamp_max": frame["timestamp"].max().isoformat(),
        "unique_timestamps": int(frame["timestamp"].nunique()),
        "duplicate_timestamp_rows_after_first": int(frame["timestamp"].duplicated().sum()),
        "time_reversal_transitions": int((frame["timestamp"].diff().dropna() < pd.Timedelta(0)).sum()),
        "duplicate_measurement_rows": int(features.duplicated().sum()),
        "total_cells": int(features.size),
        "missing_cells": int(features.isna().sum().sum()),
        "missing_rate": float(features.isna().to_numpy().mean()),
        "features_with_missing": int((missing_rates > 0).sum()),
        "features_missing_gt_50pct": int((missing_rates > 0.50).sum()),
        "uninformative_features": int((non_missing_unique <= 1).sum()),
        "all_missing_features": int((non_missing_unique == 0).sum()),
        "duplicate_features_after_first": int(duplicate_mask.sum()),
        "hashes": dict(frame.attrs.get("hashes", {})),
    }


def time_holdout(frame: pd.DataFrame, train_size: int = 1175) -> tuple[pd.DataFrame, pd.DataFrame]:
    ordered = frame.sort_values(["timestamp", "sample_id"], kind="stable").reset_index(drop=True)
    if len(ordered) != 1567:
        raise ValueError(f"Official V1 split expects 1567 rows, got {len(ordered)}")
    boundary = ordered.loc[train_size, "timestamp"]
    while train_size > 0 and ordered.loc[train_size - 1, "timestamp"] == boundary:
        train_size -= 1
    train = ordered.iloc[:train_size].copy()
    test = ordered.iloc[train_size:].copy()
    if set(train["sample_id"]) & set(test["sample_id"]):
        raise AssertionError("Train/test sample overlap")
    return train, test


def write_audit(config: ExperimentConfig) -> dict[str, object]:
    frame = load_secom(config.data_dir)
    audit = audit_frame(frame)
    train, test = time_holdout(frame, config.train_size)
    audit["split"] = {
        "train_samples": len(train),
        "train_fail": int(train["label"].sum()),
        "test_samples": len(test),
        "test_fail": int(test["label"].sum()),
        "train_end": train["timestamp"].max().isoformat(),
        "test_start": test["timestamp"].min().isoformat(),
    }
    config.output_dir.mkdir(parents=True, exist_ok=True)
    (config.output_dir / "data_audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    (config.output_dir / "config.json").write_text(json.dumps(asdict(config), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return audit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("results/v1"))
    args = parser.parse_args()
    config = ExperimentConfig(data_dir=args.data_dir, output_dir=args.output_dir)
    audit = write_audit(config)
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
