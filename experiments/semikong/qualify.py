"""Offline ontology qualification; never runs an LLM or changes risk scores."""
from __future__ import annotations

import argparse
import copy
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import platform
import re
import subprocess
import time

import rdflib
from rdflib import Graph, URIRef
from rdflib.namespace import DC, OWL, RDF, RDFS

UPSTREAM = "https://github.com/aitomatic/semikong"
QUERIES = ["dry etch", "wet clean", "die attach", "solder paste inspection",
           "recipe version", "SECOM feature_001", "invented unicorn process"]


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()


def revision(root):
    return subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()


def normalize(text):
    return re.sub(r"[\s_-]+", " ", text.casefold()).strip()


def inspect(root):
    """Parse local canonical files only. owl:imports are deliberately not fetched."""
    sha = revision(root)
    records, manifest, errors = [], [], []
    merged = Graph()
    for path in sorted((root / "ontology/ontology").rglob("*.ttl")):
        raw = path.read_bytes()
        relative = path.relative_to(root).as_posix()
        manifest.append({"path": relative, "sha256": digest(raw)})
        graph = Graph()
        try:
            graph.parse(data=raw, format="turtle")
        except Exception as exc:
            errors.append({"path": relative, "error": type(exc).__name__, "detail": str(exc)[:240]})
            continue
        merged += graph
        module_sources = sorted({str(v) for v in graph.objects(None, DC.source)})
        for subject in sorted(set(graph.subjects(RDF.type, OWL.Class)), key=str):
            for label in sorted(set(graph.objects(subject, RDFS.label)), key=str):
                records.append({"uri": str(subject), "label": str(label),
                    "placeholder": "placeholder" in str(subject).casefold() or "placeholder" in str(label).casefold(),
                    "source_url": f"{UPSTREAM}/blob/{sha}/{relative}",
                    "source_sha256": digest(raw),
                    "module_sources": module_sources,
                    "class_sources": sorted(str(v) for v in graph.objects(subject, DC.source))})
    if not manifest:
        raise ValueError("No canonical Turtle modules found")
    classes = set(merged.subjects(RDF.type, OWL.Class))
    dangling = sorted({str(parent) for parent in merged.objects(None, RDFS.subClassOf)
                       if isinstance(parent, URIRef) and str(parent).startswith("https://semicont.org/")
                       and parent not in classes})
    index = {}
    for record in records:
        if not record["placeholder"]:
            index.setdefault(normalize(record["label"]), []).append(record)
    ambiguous = sorted(label for label, values in index.items() if len({v["uri"] for v in values}) > 1)
    return index, {"upstream_revision": sha, "files": manifest, "parse_errors": errors,
        "files_parsed": len(manifest) - len(errors), "triples": len(merged),
        "owl_classes": len(classes), "label_records": len(records),
        "placeholder_label_records": sum(r["placeholder"] for r in records),
        "label_records_with_class_dc_source": sum(bool(r["class_sources"]) for r in records),
        "ambiguous_labels": ambiguous, "unresolved_local_superclasses": dangling,
        "unresolved_note": "Relative to the local parsed graph, not proof of OWL inconsistency; imports not resolved."}


def lookup(index, query):
    key = normalize(query)
    if re.search(r"\bsecom\b|\bfeature\s*\d+\b", key):
        return {"query": query, "status": "abstain_anonymous", "matches": []}
    matches = index.get(key, [])
    count = len({item["uri"] for item in matches})
    status = "candidate_exact_label" if count == 1 else "abstain_ambiguous" if count > 1 else "abstain_no_exact_label"
    return {"query": query, "status": status, "matches": matches,
            "claim_boundary": "Vocabulary candidate only; not a validated process mapping, diagnosis or command."}


def sidecar(index, queue):
    return {"schema_version": "fabguard-semikong-sidecar-experiment/v1",
            "queue_sha256": digest(canonical(queue)),
            "items": [{"review_id": item["review_id"],
                       "process_context": lookup(index, item["trace"]["process_step"])}
                      for item in queue["items"]]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    start = time.perf_counter()
    index, audit = inspect(args.upstream.resolve())
    parse_seconds = time.perf_counter() - start
    # Exercise the actual FabGuard Fledge -> frozen SPC -> review queue path.
    from fabguard.manufacturing_review import build_review_package
    events = root / "examples/manufacturing/smt_synthetic_events.json"
    raw = events.read_bytes()
    _, queue = build_review_package(raw, baseline_count=10)
    original = copy.deepcopy(queue)
    attached = sidecar(index, queue)
    lookup_start = time.perf_counter()
    smoke = [lookup(index, query) for query in QUERIES]
    lookup_seconds = time.perf_counter() - lookup_start
    # Diagnostic normalization probes, explicitly not a held-out accuracy set.
    normalization = [lookup(index, q) for q in ("WET_CLEAN", "die-attach", "습식 세정")]
    result = {"schema_version": "fabguard-semikong-qualification/v1",
        "fabguard_base_revision": revision(root),
        "python": platform.python_version(), "rdflib": rdflib.__version__,
        "packages": {name: version(name) for name in ("rdflib", "pyparsing", "numpy", "pandas")},
        "seed": None, "determinism": "No randomized operations or learned model",
        "audit": audit, "smoke_queries": smoke, "normalization_probes": normalization,
        "source_input_sha256": digest(raw), "synthetic_review_items": len(queue["items"]),
        "queue_unchanged": queue == original, "sidecar": attached,
        "parse_seconds": parse_seconds, "smoke_lookup_seconds": lookup_seconds,
        "llm_inference_executed": False,
        "production_approved": False,
        "upstream_syntax_gate": "failed" if audit["parse_errors"] else "passed",
        "limitations": ["No manufacturing accuracy or yield evidence", "No Korean alias dictionary",
            "No SHACL validation or OWL reasoning", "No full-model inference or QA evaluation",
            "Source links identify repository provenance, not independent scientific validation"],
        "decision": "research_only_pending_domain_review"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"files": len(audit["files"]), "parsed": audit["files_parsed"],
        "errors": len(audit["parse_errors"]), "classes": audit["owl_classes"],
        "placeholders": audit["placeholder_label_records"],
        "unresolved_superclasses": len(audit["unresolved_local_superclasses"]),
        "ambiguous_labels": len(audit["ambiguous_labels"]),
        "smoke": [(r["query"], r["status"]) for r in smoke],
        "review_items": len(queue["items"]), "queue_unchanged": result["queue_unchanged"],
        "parse_seconds": parse_seconds}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
