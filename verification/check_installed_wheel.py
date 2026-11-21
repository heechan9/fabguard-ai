"""Candidate wheel contract: check and run one packaged CLI outside its checkout."""
import argparse
import configparser
from hashlib import sha256
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

MISSING_CONTROL_FILE = "fabguard/spc.py"
OWNED = (
    "fabguard/__init__.py", "fabguard/manufacturing_review.py", MISSING_CONTROL_FILE,
    "fabguard/integrations/__init__.py", "fabguard/integrations/fledge_contract.py",
)
ENTRY = "fabguard-manufacturing-review"


class ContractError(ValueError):
    pass


def check_members(wheel):
    with zipfile.ZipFile(wheel) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ContractError("repeated wheel member")
        missing = sorted(set(OWNED).difference(names))
        if missing:
            raise ContractError("owned wheel file missing: " + ", ".join(missing))
        entries = [path for path in names if path.endswith(".dist-info/entry_points.txt")]
        if len(entries) != 1:
            raise ContractError("expected exactly one entry-point manifest")
        cfg = configparser.ConfigParser(interpolation=None)
        cfg.read_string(archive.read(entries[0]).decode("utf-8"))
        if cfg.get("console_scripts", ENTRY, fallback="") != "fabguard.manufacturing_review:main":
            raise ContractError("manufacturing entry point missing or incorrect")


def check_missing_control(original, damaged):
    with zipfile.ZipFile(original) as source, zipfile.ZipFile(damaged, "w", zipfile.ZIP_DEFLATED) as target:
        for entry in source.infolist():
            if entry.filename == MISSING_CONTROL_FILE:
                continue
            target.writestr(entry.filename, source.read(entry))
    try:
        check_members(damaged)
    except ContractError as exc:
        if str(exc) == "owned wheel file missing: " + MISSING_CONTROL_FILE:
            return
        raise
    raise ContractError("negative control passed unexpectedly")


def example_bytes():
    key = "volume_pct"
    return json.dumps({
        "schema_version": "fabguard-manufacturing-events/v1",
        "source_id": "wheel-gate-fictional",
        "data_role": "synthetic", "measurement": {"name": key, "unit": "percent"},
        "readings": [{
            "asset_code": "SYN-SPI",
            "user_ts": f"2026-01-01T00:{i:02d}:00Z",
            "reading": {key: value},
            "manufacturing": {
                "lot_id": "SYN-LOT", "unit_id": f"SYN-{i:02d}", "equipment_id": "SYN-SPI",
                "process_step": "synthetic_measurement", "run_id": "SYN-RUN",
                "recipe_id": "SYN-RECIPE", "recipe_version": "v1", "spec_version": "v1",
                "units": {key: "percent"},
            },
        } for i, value in enumerate([92, 94] * 5 + [95, 110, None], 1)],
    }, allow_nan=False, sort_keys=True, separators=(",", ":")).encode()


def check(wheel, *, system_deps=False):
    wheel = Path(wheel).resolve(strict=True)
    digest = sha256(wheel.read_bytes()).hexdigest()
    check_members(wheel)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("PYTHON", "PIP_"))}
    env["PIP_CONFIG_FILE"] = os.devnull
    with tempfile.TemporaryDirectory(prefix="fabguard-wheel-gate-") as td:
        root = Path(td)
        outside = root / "outside-checkout"
        outside.mkdir()
        venv = root / "venv"
        negative = root / "negative-control.whl"
        check_missing_control(wheel, negative)
        flags = ["--system-site-packages"] if system_deps else []
        subprocess.run([sys.executable, "-I", "-m", "venv", *flags, venv],
                       cwd=outside, env=env, check=True, timeout=90)
        bin_dir = venv / ("Scripts" if os.name == "nt" else "bin")
        ext = ".exe" if os.name == "nt" else ""
        py, cli = bin_dir / ("python" + ext), bin_dir / (ENTRY + ext)
        pip_flags = ["--no-index", "--no-deps"] if system_deps else []
        subprocess.run([py, "-I", "-m", "pip", "--disable-pip-version-check", "install",
                        "--force-reinstall", *pip_flags, wheel], cwd=outside, env=env, check=True, timeout=240)
        probe = """import importlib, json, platform, sys, sysconfig
from importlib.metadata import version
modules = ('fabguard', 'fabguard.manufacturing_review', 'fabguard.spc', 'fabguard.integrations', 'fabguard.integrations.fledge_contract')
print(json.dumps(dict(purelib=sysconfig.get_path('purelib'), prefix=sys.prefix,
    python=platform.python_version(), sources=[importlib.import_module(m).__file__ for m in modules],
    versions={name:version(name) for name in ['fabguard-ai','numpy','pandas','scikit-learn','matplotlib','joblib']})))
"""
        provenance = json.loads(subprocess.check_output(
            [py, "-I", "-c", probe], cwd=outside, env=env, timeout=60
        ))
        purelib = Path(provenance["purelib"]).resolve()
        if (Path(provenance["prefix"]).resolve() != venv.resolve() or not purelib.is_relative_to(venv.resolve())
                or [Path(file).resolve().relative_to(purelib).as_posix() for file in provenance["sources"]] != list(OWNED)):
            raise ContractError("tested modules did not originate in the installed wheel environment")
        raw = example_bytes()
        fixture = outside / "fixture.json"
        fixture.write_bytes(raw)
        subprocess.run([cli, "build", "--input", fixture.name, "--baseline-count", "10", "--output-dir", "out"],
                       cwd=outside, env=env, check=True, timeout=45)
        report = json.loads((outside / "out/manufacturing_report.json").read_bytes())
        queue = json.loads((outside / "out/review_queue.json").read_bytes())
        observed = [(item["screening_status"], item["trace"]["unit_id"]) for item in queue["items"]]
        source_digest = sha256(raw).hexdigest()
        if (report["status"] != "review_queue_built"
                or report["fledge_contract"]["normalized_readings"] != 13
                or queue["source_input_sha256"] != source_digest
                or observed != [("above_limit", "SYN-12"), ("unknown", "SYN-13")]
                or fixture.read_bytes() != raw):
            raise ContractError("installed CLI did not reproduce the frozen synthetic result")
    if sha256(wheel.read_bytes()).hexdigest() != digest:
        raise ContractError("wheel bytes changed during verification")
    return {
        "status": "SCOPED_LOCAL_SYSTEM_DEPENDENCIES" if system_deps else "PACKAGE_CANDIDATE_VERIFIED",
        "file": wheel.name, "artifact_sha256": digest, "fixture_sha256": source_digest,
        "sample_count": 13, "observed": observed, "missing_owned_file_rejected": MISSING_CONTROL_FILE,
        "python": provenance["python"], "runtime_versions": provenance["versions"],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wheel", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--local-system-deps", action="store_true",
                        help="local fallback only; never grants CI package validation")
    args = parser.parse_args()
    if args.local_system_deps and os.environ.get("GITHUB_ACTIONS"):
        parser.error("CI requires a clean dependency installation")
    result = check(args.wheel, system_deps=args.local_system_deps)
    with args.output.open("x", encoding="utf-8") as out:
        json.dump(result, out, indent=2)
        out.write("\n")
