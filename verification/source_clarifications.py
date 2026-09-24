"""Validate clarification records; verify a selected record against exact source bytes."""
import argparse
import datetime
import hashlib
import json
import re
from pathlib import Path

try:
    from .recompute_v1 import read_json, require
except ImportError:  # Direct CLI execution, independent of the FabGuard package.
    from recompute_v1 import read_json, require


def validate_registry(registry):
    require(isinstance(registry, dict), "registry must be an object")
    require(set(registry) == {"schema", "records"}, "unexpected registry fields")
    require(registry["schema"] == "fabguard.source-clarifications.v1", "unsupported schema")
    records = registry["records"]
    require(isinstance(records, list), "records must be a list")
    seen = {}
    required = {"id", "dataset_id", "source_sha256", "field", "previous_interpretation",
                "corrected_interpretation", "reason", "evidence_reference", "reviewer",
                "recorded_at", "status", "supersedes"}
    for record in records:
        require(isinstance(record, dict) and set(record) == required, "invalid record fields")
        require(all(isinstance(record[key], str) and record[key].strip()
                    for key in required - {"supersedes"}), "empty/non-text record field")
        require(re.fullmatch(r"[a-z0-9][a-z0-9._-]*", record["id"]), "invalid record ID")
        require(record["id"] not in seen, "duplicate record ID")
        require(re.fullmatch(r"[0-9a-f]{64}", record["source_sha256"]), "invalid SHA-256")
        require(record["status"] in {"proposed", "confirmed"}, "invalid review status")
        require(record["previous_interpretation"] != record["corrected_interpretation"],
                "clarification must describe a change")
        stamp = datetime.datetime.fromisoformat(record["recorded_at"].replace("Z", "+00:00"))
        require(stamp.tzinfo is not None, "recorded_at needs a timezone")
        parent_id = record["supersedes"]
        require(parent_id is None or isinstance(parent_id, str), "invalid supersedes")
        if parent_id is not None:
            require(parent_id in seen, "supersedes must identify an earlier record")
            parent = seen[parent_id]
            require(all(parent[key] == record[key] for key in
                        ("dataset_id", "source_sha256", "field")), "supersedes scope mismatch")
            confirms_proposal = (parent["status"] == "proposed" and record["status"] == "confirmed"
                                 and all(record[key] == parent[key] for key in
                                         ("previous_interpretation", "corrected_interpretation")))
            require(confirms_proposal or
                    record["previous_interpretation"] == parent["corrected_interpretation"],
                    "interpretation chain mismatch")
            previous_time = datetime.datetime.fromisoformat(parent["recorded_at"].replace("Z", "+00:00"))
            require(stamp >= previous_time, "superseding record predates parent")
            require(not any(old["supersedes"] == parent_id for old in seen.values()),
                    "forked clarification chain")
        else:
            require(not any(all(old[key] == record[key] for key in
                                ("dataset_id", "source_sha256", "field"))
                            for old in seen.values()), "duplicate clarification root")
        seen[record["id"]] = record
    return dict(status="registry_structure_valid", record_count=len(records),
                source_bytes_verified=False, provider_identity_verified=False)


def verify_source(registry, record_id, source):
    validate_registry(registry)
    matches = [record for record in registry["records"] if record["id"] == record_id]
    require(len(matches) == 1, "unknown clarification record")
    record = matches[0]
    require(record["status"] == "confirmed", "clarification is not confirmed")
    require(not any(row["supersedes"] == record_id for row in registry["records"]),
            "clarification is superseded")
    digest = hashlib.sha256(Path(source).read_bytes()).hexdigest()
    require(digest == record["source_sha256"], "source SHA-256 mismatch")
    return dict(status="source_binding_verified", record_id=record_id,
                dataset_id=record["dataset_id"], source_sha256=digest,
                source_bytes_verified=True, provider_identity_verified=False,
                data_modified=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=Path(__file__).resolve().parents[1]
                        / "docs/data/source_clarifications.json")
    parser.add_argument("--record")
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    try:
        require(bool(args.record) == bool(args.source), "--record and --source must be supplied together")
        registry = read_json(args.registry.read_bytes())
        report = verify_source(registry, args.record, args.source) if args.record else validate_registry(registry)
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(1, "Clarification check failed: " + str(exc) + "\n")
    print(json.dumps(report, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
