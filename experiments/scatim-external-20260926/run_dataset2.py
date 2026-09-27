"""Within-run, ordered SCATIM dataset 2 evaluation (requires h5py).

Run: python experiments/scatim-external-20260926/run_dataset2.py --data-dir /path/to/scatimdata
Each Versuch is evaluated independently because global chronology is not established.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import platform
import zipfile
from pathlib import Path

import h5py
import numpy as np
import pandas as pd
import sklearn

from run import make_model, metrics

TARGETS = ("weight", "GE-GE002*", "GERADEHEIT-L*", "PT-PT002L*")


def read_hdf_table(group: h5py.Group) -> pd.DataFrame:
    """Read the three typed blocks of a pandas fixed-format HDF5 table."""
    columns = {}
    for block in ("block0", "block1", "block2"):
        names = [item.decode() for item in group[block + "_items"][:]]
        values = group[block + "_values"][:]
        if values.shape != (len(group["axis1"]), len(names)):
            raise ValueError("unexpected HDF5 scalar block shape")
        columns.update({name: values[:, j] for j, name in enumerate(names)})
    result = pd.DataFrame(columns)
    expected = {item.decode() for item in group["axis0"][:]}
    if set(result) != expected:
        raise ValueError("incomplete HDF5 scalar table")
    return result


def read_dataset2(archive: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    with zipfile.ZipFile(archive) as z:
        with h5py.File(io.BytesIO(z.read("dataset2/dynamic_data_versuch_large.h5"))) as h:
            scalar = read_hdf_table(h["scalars"])
            counters = scalar.cycle_counter.to_numpy(dtype=int)
            if len(set(counters)) != len(counters):
                raise ValueError("duplicate cycle identifiers")
            features = {}
            for group_name, prefix, label in (
                ("Einspritzstrom", "einspritzstrom_ist_", "injectionflow"),
                ("Einspritzdruck", "einspritzdruck_ist_", "injectionpressure"),
            ):
                group = h[group_name]
                names = {name.decode(): j for j, name in enumerate(group["axis0"][:])}
                keys = [prefix + str(counter) for counter in counters]
                if not set(keys).issubset(names):
                    raise ValueError(f"missing curves in {group_name}")
                matrix = group["block0_values"][:][:, [names[key] for key in keys]]
                if not np.isfinite(matrix).all():
                    raise ValueError(f"non-finite curves in {group_name}")
                features[label + "_mean"] = matrix.mean(axis=0)
                features[label + "_max"] = matrix.max(axis=0)
                features[label + "_std"] = matrix.std(axis=0)
    return scalar, pd.DataFrame(features)


def run(data_dir: Path, output_dir: Path) -> None:
    archive = data_dir / "dataset2.zip"
    scalar, curve = read_dataset2(archive)
    # Metadata and every measured part property are excluded. Process scalars
    # include the in-cycle pressure integrals, available after the shot.
    excluded = {"Versuch", "cycle_counter", "Charge", *TARGETS}
    x_scalar = scalar.drop(columns=list(excluded))
    x_curve = pd.concat([x_scalar, curve], axis=1)
    rows, runs = [], []
    for run_id in scalar.Versuch.drop_duplicates():
        positions = np.flatnonzero(scalar.Versuch.to_numpy() == run_id)
        counters = scalar.cycle_counter.iloc[positions].to_numpy()
        if not np.all(np.diff(counters) > 0):
            raise ValueError(f"non-increasing counters within Versuch {run_id}")
        split = int(len(positions) * 0.7)
        train, holdout = positions[:split], positions[split:]
        run_audit = {"Versuch": int(run_id), "train_n": len(train), "holdout_n": len(holdout),
                     "train_counter": [int(counters[0]), int(counters[split - 1])],
                     "holdout_counter": [int(counters[split]), int(counters[-1])],
                     "dropped_all_missing_train_columns": {}}
        runs.append(run_audit)
        for target in TARGETS:
            y = scalar[target].to_numpy(dtype=float)
            if not np.isfinite(y[positions]).all():
                # PT-PT002L* has no measurements in Versuch 15.
                continue
            for feature_set, x in (("scalar", x_scalar), ("scalar_plus_curve_summary", x_curve)):
                # Availability is selected using this run's training slice only.
                usable = x.iloc[train].notna().any(axis=0)
                run_audit["dropped_all_missing_train_columns"][feature_set] = list(x.columns[~usable])
                x_usable = x.loc[:, usable]
                for model_name in ("train_mean", "ridge", "forest"):
                    model = make_model(model_name)
                    model.fit(x_usable.iloc[train], y[train])
                    pred = model.predict(x_usable.iloc[holdout])
                    rows.append({"Versuch": int(run_id), "target": target, "feature_set": feature_set,
                                 "model": model_name, "train_n": len(train), "holdout_n": len(holdout),
                                 "train_target_mean": float(y[train].mean()),
                                 "holdout_target_mean": float(y[holdout].mean()),
                                 **metrics(y[holdout], pred)})
    output_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(output_dir / "dataset2_within_run.csv", index=False, float_format="%.8g")
    (output_dir / "dataset2_audit.json").write_text(json.dumps({
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "n": len(scalar), "runs": runs, "targets": list(TARGETS),
        "scalar_features": list(x_scalar.columns), "curve_features": list(curve.columns),
        "split": "first 70 percent train within each Versuch, remaining 30 percent holdout; independent model per run",
        "seed": 20260926, "python": platform.python_version(),
        "numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__,
        "h5py": h5py.__version__, "prediction_time": "after injection cycle, before quality measurement",
    }, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path,
                        default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()
    run(args.data_dir, args.output_dir)
