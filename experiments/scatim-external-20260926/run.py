"""Exploratory ordered evaluation of the public SCATIM injection molding data.

Usage: python experiments/scatim-external-20260926/run.py --data-dir /path/to/scatimdata
The source archives stay outside this repository. No quality measurements enter X.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import platform
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def read_dataset(archive: Path, number: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    with zipfile.ZipFile(archive) as z:
        prefix = f"dataset{number}/ds{number}_"
        scalar = pd.read_csv(io.BytesIO(z.read(prefix + "scalar_and_quality.csv")), decimal=",")
        if not scalar.cycle_counter.is_monotonic_increasing or not scalar.cycle_counter.is_unique:
            raise ValueError("cycle_counter must uniquely increase in file order")
        selected = [str(v) for v in scalar.cycle_counter]
        curve_features: dict[str, np.ndarray] = {}
        for kind in ("injectionflow", "injectionpressure"):
            curve = pd.read_csv(io.BytesIO(z.read(prefix + f"timeseries_{kind}.csv")), decimal=",")
            if not set(selected).issubset(curve.columns):
                raise ValueError(f"missing {kind} curves for measured parts")
            arr = curve.loc[:, selected].to_numpy(dtype=float)
            if not np.isfinite(arr).all():
                raise ValueError(f"non-finite {kind} curves")
            curve_features[kind + "_mean"] = arr.mean(axis=0)
            curve_features[kind + "_max"] = arr.max(axis=0)
            curve_features[kind + "_std"] = arr.std(axis=0)
        features = pd.DataFrame(curve_features)
    return scalar, features


def make_model(name: str):
    if name == "train_mean":
        return DummyRegressor(strategy="mean")
    if name == "ridge":
        return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(alpha=10.0))
    if name == "forest":
        return make_pipeline(
            SimpleImputer(strategy="median"),
            RandomForestRegressor(n_estimators=200, min_samples_leaf=5, max_features=0.8,
                                  random_state=20260926, n_jobs=1),
        )
    raise ValueError(name)


def metrics(y: np.ndarray, prediction: np.ndarray) -> dict[str, float]:
    return {"mae": float(mean_absolute_error(y, prediction)),
            "rmse": float(np.sqrt(mean_squared_error(y, prediction)))}


def run(data_dir: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    audit: list[dict] = []
    for number in (1, 3):
        archive = data_dir / f"dataset{number}.zip"
        scalar, curve = read_dataset(archive, number)
        target_cols = ["weight", "distanceA" if number == 1 else "distanceB"]
        # The counter is an ordering key; the measured product properties are outcomes.
        x_scalar = scalar.drop(columns=["cycle_counter", *target_cols])
        x_curve = pd.concat([x_scalar.reset_index(drop=True), curve], axis=1)
        split = int(len(scalar) * 0.7)
        if split <= 0 or split >= len(scalar):
            raise ValueError("empty train or holdout")
        audit.append({"dataset": number, "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                      "n": len(scalar), "train_n": split, "holdout_n": len(scalar) - split,
                      "train_counter": [int(scalar.cycle_counter.iloc[0]), int(scalar.cycle_counter.iloc[split - 1])],
                      "holdout_counter": [int(scalar.cycle_counter.iloc[split]), int(scalar.cycle_counter.iloc[-1])],
                      "scalar_features": list(x_scalar.columns), "curve_features": list(curve.columns)})
        for target in target_cols:
            y = scalar[target].to_numpy(dtype=float)
            if not np.isfinite(y).all():
                raise ValueError(f"non-finite target {target}")
            for feature_set, x in (("scalar", x_scalar), ("scalar_plus_curve_summary", x_curve)):
                for model_name in ("train_mean", "ridge", "forest"):
                    model = make_model(model_name)
                    model.fit(x.iloc[:split], y[:split])
                    pred = model.predict(x.iloc[split:])
                    scores = metrics(y[split:], pred)
                    rows.append({"dataset": number, "target": target, "feature_set": feature_set,
                                 "model": model_name, "train_n": split, "holdout_n": len(y) - split,
                                 "train_target_mean": float(y[:split].mean()),
                                 "holdout_target_mean": float(y[split:].mean()),
                                 "train_target_sd": float(y[:split].std()), **scores})
    pd.DataFrame(rows).to_csv(output_dir / "ordered_holdout.csv", index=False, float_format="%.8g")
    (output_dir / "audit.json").write_text(json.dumps({"data": audit, "python": platform.python_version(),
        "numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__,
        "seed": 20260926, "split": "first 70 percent train; last 30 percent untouched holdout",
        "prediction_time": "after injection cycle, before quality measurement"}, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path,
                        default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()
    run(args.data_dir, args.output_dir)
