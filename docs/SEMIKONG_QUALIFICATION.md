# SemiKong qualification experiment

This is an isolated, offline feasibility experiment, not a production integration.
Evaluate a pinned upstream ontology as a source-linked vocabulary sidecar for
FabGuard manufacturing review records. Do not change SECOM variables, scores,
data splits, human decisions, or the deployed website.

## Dependency decision (before execution)

Use `rdflib==7.1.4` only in the experiment environment to parse real Turtle syntax.
Regex extraction is not sufficient evidence of RDF validity. No change to the
application's default dependencies is required. Do not resolve remote imports.
Use deterministic exact normalized labels; abstain on unknown or ambiguous terms.
Do not silently map anonymous SECOM variables to named processes.

## Evaluation scope

- Parse every canonical upstream Turtle module, recording failures and hashes.
- Inspect placeholders, label ambiguity, dangling local superclass references,
  and provenance quality separately from syntax validity.
- Predeclare smoke queries: dry etch, wet clean, die attach, solder paste
  inspection, recipe version, anonymous SECOM variable, and an invented process.
  These are a small diagnostic set, not an independent accuracy benchmark.
- Run the existing synthetic manufacturing review function and attach a separate
  semantic sidecar; confirm that the original queue remains unchanged.
- Record Python/dependency versions, both Git revisions, timing and input hashes.
- Full LLM quality, Korean QA, SHACL conformance, OWL consistency, domain expert
  review and actual manufacturing benefits remain untested.

The upstream model setup requests CUDA and at least 16 GB VRAM for its 8B chat
configuration. This session has no detected NVIDIA GPU; do not report ontology
execution as model inference. Model weights and data have separate terms.

Sources: https://github.com/aitomatic/semikong and its `ontology/LICENSE`,
`model/INSTALL.md`, `model/README.md`; retrieved locally for this experiment.

## Executed results

FabGuard baseline: `3ade67d81ce425f12f1db9811c122bb578d89bfd`.
SemiKong input: `3228caf0a2963c4b912aa6b85fe6be4fa20e4961`.
The complete per-file SHA-256 inventory, errors and source-linked query outputs
are in `results/semikong-qualification/report.json`.

| Check | Observed result | Interpretation |
|---|---|---|
| Canonical Turtle modules | 446 total; 439 parsed; 7 failed | Whole-tree syntax gate fails |
| Parsed OWL classes / label records | 705 / 705 | Counts describe only successfully parsed modules |
| Placeholder label records | 58 | Excluded from vocabulary lookup |
| Ambiguous normalized labels | 28 | Multiple class URIs; adapter abstains |
| Local superclass URIs without class declaration | 95 | Local closure gaps; imports not fetched, not proof of inconsistency |
| Label records with direct class-level `dc:source` | 208 / 705 | Metadata presence only; not verified scientific support |
| dry etch / wet clean / die attach | Exact-label candidates found | Vocabulary feasibility only |
| solder paste inspection / recipe version | No exact-label match | Existing SMT process cannot be directly enriched by this matcher |
| Anonymous SECOM feature / invented process | Abstained | No invented sensor meanings or process mappings |
| Korean `습식 세정` | No exact-label match | A reviewed translation layer would be additional work |
| Existing synthetic manufacturing fixture | 2 review items; queue unchanged | Actual Fledge-contract/SPC queue path executed; sidecar abstains for SPI |
| Upstream textual ontology audit | Passed | Does not establish Turtle syntax validity; parser found 7 failures |

Six isolated adapter contract tests and eight existing manufacturing review tests
passed (14 total, no skips). This smoke set is developer-selected and is not an accuracy,
recall, relevance, or independent domain-quality benchmark. Parse timing is one
local run, not a service latency benchmark.

### Decision

**Do not enable whole-ontology or LLM integration in the deployed product yet.**
Keep this opt-in experiment for source-linked vocabulary review. It demonstrates
local execution with no model/API cost, but not sufficient benefit to add a new
production dependency. For a next candidate, curate only modules needed by an
actual FabGuard task, verify their primary references, resolve parsing and
ambiguity issues, and evaluate engineer-authored questions against the existing
documentation-only baseline. Never use this ontology to rename SECOM features.

SemiKong model inference, Korean answer correctness, hallucination rates and GPU
latency remain **not executed**. Upstream's 8B hardware guidance is a vendor
requirement statement, not a measured VRAM result from this experiment.

HMSDK and HSE remain infrastructure candidates, not tested integrations here:
neither solves the missing process-context vocabulary directly. VisA remains a
separate image-inspection experiment; no images were trained on in this slice.

## Reproduce

```bash
git clone https://github.com/aitomatic/semikong.git ../semikong-upstream
git -C ../semikong-upstream checkout 3228caf0a2963c4b912aa6b85fe6be4fa20e4961
python -m pip install -r experiments/semikong/requirements.txt
PYTHONPATH=src python experiments/semikong/qualify.py --upstream ../semikong-upstream --output results/semikong-qualification/report.json
PYTHONPATH=src python -m unittest discover -s experiments/semikong -p 'test_*.py' -v
PYTHONPATH=src python -m unittest discover -s tests -p 'test_manufacturing_review.py' -v
```

Use FabGuard's existing Python dependencies as well. Input checkout must remain
unmodified. Module content is read locally; remote OWL imports are not fetched.
No service, model weights or paid endpoint is required. Timing/environment fields
will vary. The report identifies the FabGuard checkout HEAD used for each run.

No website deployment, SECOM evaluation or human decision changes are included.
