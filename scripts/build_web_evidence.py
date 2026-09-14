"""Build the shared browser evidence snapshot from canonical repository files.

No network, model execution or raw CSV redistribution. Source metadata fixes the
Git revision and byte identities; refresh that metadata when admitting new data.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "scripts" / "web_evidence_sources.json"
OUTPUT = ROOT / "web" / "data" / "evidence_snapshot.json"


def build():
    metadata = json.loads(META.read_text(encoding="utf-8"))
    files = {}
    for path, expected in metadata.pop("source_blob_shas").items():
        raw = (ROOT / path).read_bytes()
        actual = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        if actual != expected:
            raise ValueError(f"{path}: evidence changed; review and update source revision/blob metadata together")
        content = raw.decode("utf-8")
        files[path] = json.loads(content) if path.endswith(".json") else content
    return {**metadata, "files": files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = build()
    if args.check:
        if json.loads(OUTPUT.read_text(encoding="utf-8")) != expected:
            raise SystemExit("Shared evidence snapshot is stale: run python scripts/build_web_evidence.py")
        print("Shared evidence snapshot matches canonical source files.")
    else:
        OUTPUT.write_text(json.dumps(expected, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(OUTPUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
