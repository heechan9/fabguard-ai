# Manufacturing event → review audit slice

Status: **synthetic Fledge-envelope replay implemented; no physical equipment or MES/FDC validation**

This vertical slice connects three capabilities that previously existed separately:

1. a Fledge-compatible numeric reading envelope;
2. manufacturing trace fields for LOT, unit, equipment, process, Run, Recipe and specification version;
3. frozen-baseline offline SPC screening followed by an explicit human-review audit.

It creates a review queue. It does not diagnose a defect, infer a physical root cause, update a
recipe, control equipment, or demonstrate yield improvement.

## Event contract

The input schema is `fabguard-manufacturing-events/v1`. Every reading keeps the normal Fledge
`asset_code`, `user_ts`/`ts` and numeric `reading` object, plus a local `manufacturing` object:

- `lot_id` and `unit_id` identify the production group and individual board/wafer-like unit;
- `equipment_id` must equal the Fledge `asset_code`;
- `process_step` declares the operation without mapping anonymous SECOM variables to a process;
- `run_id`, `recipe_id` and `recipe_version` preserve execution lineage;
- `spec_version` identifies the declared review context, not a product specification verdict;
- `units` must declare exactly the screened measurement and its unit.

One invocation accepts one process stream. Equipment, process, recipe/version and specification
version must remain constant so the frozen baseline is not silently mixed across unlike contexts.

## Build the queue

```bash
PYTHONPATH=src python -m fabguard.manufacturing_review build \
  --input examples/manufacturing/smt_synthetic_events.json \
  --baseline-count 10 \
  --output-dir results/manufacturing-review-synthetic
```

The command writes:

- `manufacturing_report.json`: input hash, normalized-reading count, stream dimensions and complete
  SPC evidence;
- `review_queue.json`: stable review IDs, event hashes, trace fields and priority classes.

The example freezes ten varying synthetic SPI readings. Of the three later readings, one remains
within the frozen limits, one is above the limit, and one is missing. Only the latter two enter the
queue. `P1_LIMIT_SIGNAL` and `P2_EVIDENCE_GAP` are screening priorities, not defect probabilities.
If the baseline itself requires review, monitoring judgments are withheld as `BLOCKED_BASELINE`.

## Record human review

```bash
PYTHONPATH=src python -m fabguard.manufacturing_review record \
  --queue results/manufacturing-review-synthetic/review_queue.json \
  --decisions examples/manufacturing/smt_review_decisions.json \
  --recorded-at 2026-09-01T01:05:00Z \
  --output results/manufacturing-review-synthetic/review_audit.json
```

Each decision must reference an existing review ID and declare a timezone-aware decision time,
reviewer role, outcome, action and rationale. Unknown or duplicate IDs, invalid outcomes/actions,
and decisions later than the recording time fail closed. Unreviewed queue items remain explicit
`pending` entries. Decisions are evidence records and never trigger automatic model retraining.

## Current evidence boundary

Implemented and regression-tested:

- completed SMT web runs can export the declared synthetic manufacturing-event contract;
- Fledge-envelope normalization and finite numeric/null measurement rules;
- strict manufacturing lineage and unit consistency;
- frozen-baseline SPC limits that later values cannot refit;
- deterministic review IDs, event evidence hashes and queue ordering;
- fail-closed decision binding with decided/pending counts;
- atomic JSON output.

Not implemented or demonstrated:

- a live Fledge South service feeding this CLI;
- physical SPI, reflow, AOI, MES, FDC, APC or SECS/GEM connectivity;
- product-specification judgment, defect prediction or causal diagnosis;
- authenticated reviewer identities, access control or a multi-user database;
- field performance, yield, cost, downtime or safety improvement.

The next evidence upgrade is to replace the synthetic fixture with an authorized, de-identified
equipment or inspection export while preserving the same contract and predeclared review boundary.

The SMT page's `검토용 이벤트 저장` button becomes available after all 12 synthetic boards finish.
It uses a fixed synthetic UTC sequence and explicitly synthetic equipment, Run, Recipe and
specification identifiers. The resulting JSON is compatible with the `build` command above; it is
not a record from the university equipment shown in the reference cards.
