# Declared cohort and budget gate (prototype)

This optional, read-only CLI checks **declared** cohort and budget sidecars before calling the existing saved-priority comparator. It does not replace that comparator, infer eligibility, choose a budget policy, or perform model inference. No web or production integration is included.

## Why a separate check?

The existing comparator intentionally accepts a fixed integer K. Identical 380-row tables can MATCH at either K=38 or K=40. That does not establish whether the intended 10% denominator was 380 eligible rows or 392 original rows. The sidecar records the chosen rule explicitly; this gate checks consistency with that declaration, not whether the policy is appropriate.

## Contract

Both sidecars use `fabguard.declared-budget-contract.v1` and contain exactly:

- `schema`: exactly `fabguard.declared-budget-contract.v1`.
- `snapshot_sha256`: lowercase 64-character SHA-256 declaration. **The original snapshot file is not provided or independently hashed by this tool.**
- `original_ids`: unique nonempty ID list. This is a set, not the historical inspection order.
- `eligible_ids`: unique nonempty ID list.
- `held`: entries with `sample_id`, nonempty `reason`, `evidence_state`, and nonempty `evidence_reference`.
- `budget`: either `{ "mode": "fixed_count", "count": 38 }`, or `{ "mode": "fraction", "basis": "eligible", "numerator": 1, "denominator": 10, "rounding": "ceil" }`. Fraction basis is explicitly `original` or `eligible`.
- `declared_k`: positive integer equal to the declared budget calculation.

Evidence states are `original_record`, `operator_statement`, `reconstructed`, and `unknown`. These are supplied declarations, not authenticated facts. References are not opened. The original IDs must be the disjoint union of eligible and held IDs. A budget greater than eligible row count is blocked, never silently clamped. Integer fraction arithmetic avoids floating-point rounding drift. Boolean, zero and noninteger count values are rejected.

Both contracts must match after normalizing ID/held list order. Different rules remain different even if they happen to yield the same K. Changes to held reasons or evidence references also block comparison conservatively. Each table must contain exactly its declared eligible IDs. Missing/unknown labels still fail the existing comparator's binary-label contract; no implicit normal-label conversion occurs.

## Run

```sh
python verification/budget_contract_gate.py \
  --reference reference.csv --actual actual.csv \
  --reference-contract reference.json --actual-contract actual.json \
  --score-atol 0 > separate-result.json
```

Always redirect output to a **different** file. The shell truncates a `>` target before the program runs; redirecting onto an input can destroy it. The CLI itself offers no file-writing argument and emits JSON to stdout.

Exit codes: MATCH=0, DIFFERENT=1, BLOCKED=2.

- MATCH: declared contracts agree and saved outputs agree under the declared K and score tolerance.
- DIFFERENT: declarations agree but the saved outputs differ.
- BLOCKED: contract/input/access failure; not a performance result.

The report explicitly sets eligibility truth, evidence authenticity, prespecification timing and factory readiness verification to false. A self-authored sidecar cannot establish that policy was frozen before outcomes were observed. This is not a model-versus-historical-inspection-order evaluation, an authorization system, a new independent performance evaluation, or a pilot-start approval.

## Source pin and integrity

The gate uses the existing `verification/compare_priority_runs.py` from commit `066ec0b8f30a2e9512224e44e0fe72b0219b64f1`, SHA-256 `c8197c057663ba0ad5dad77e25531bd2d6f81115dd38ba4890ca0d06f2429d61`. It hashes and executes the same in-memory bytes, without reopening the path. An upstream comparator edit requires reviewing and deliberately updating the pin. Table hashes must remain identical between eligibility checking and saved-output comparison; a change blocks the result.

## Verification

```sh
PYTHONPATH=src:. python -m unittest discover -s tests -p 'test_budget_contract_gate.py' -v
PYTHONPATH=src:. python -O -m unittest discover -s tests -p 'test_budget_contract_gate.py' -v
```

The 29 synthetic tests include 392 original / 380 eligible / 12 held IDs, both denominator policies, wrong-K and same-K/different-rule cases, partition defects, declaration/data mismatches, strict JSON parsing, CLI status codes, and source/table changes between reads. They do not filter real SECOM rows or change the original evaluation definition.
