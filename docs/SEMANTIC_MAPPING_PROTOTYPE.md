# Synthetic two-source mapping diagnostic

## Scope

`fabguard.semantic_mapping.diagnose_mapping` is an optional, read-only diagnostic
for one explicitly declared pair of synthetic sources. It does not establish
operational eligibility, approve a mapping, authenticate evidence, or control
hardware. Every result has `operational_status: WITHHELD`.

The function accepts exact UTF-8 JSON bytes for `left_raw`, `right_raw` and
`contract_raw`, plus explicit `as_of`, `caller_id` and `purpose` keyword arguments.
It reads no files or services and writes nothing. It adds no dependency or existing
caller integration. The tests provide synthetic examples, not a real authority.

## Input contract

Source schema `fabguard-mapping-source/v1` requires exactly:

- `schema_version`, `data_role` (only `synthetic`)
- `source_id`, `namespace`, `equipment_id`, `property_id`
- `physical_asset_id`, `semantic_id`, `unit`, `definition_version`
- `process_step`, `recipe_id`, `recipe_version`
- `observed_at`, `available_at`, `valid_from`, `valid_until`

Contract schema `fabguard-mapping-contract/v1` requires exactly:

- `schema_version`, `data_role` (only `synthetic`), `mapping_id`, `mapping_version`
- `authority_id`, `authority_evidence_ref`, `caller_id`, `purpose`
- `left` and `right` objects containing all endpoint identifiers and semantic fields
- `left_sha256`, `right_sha256`, hashing the exact source bytes
- `declared_at`, `valid_from`, `valid_until`

Identifiers must be nonempty trimmed strings and are compared exactly. Different
namespace/equipment/property IDs require explicit endpoint binding in the contract.
Physical asset, semantic ID, unit, definition, process and recipe fields must agree.
No alias inference, case folding, unit conversion or AAS conformance is provided.
Different source IDs do not establish source independence.

Timestamps reuse the existing strict timezone-aware parser. Source intervals are
half-open: `valid_from <= observed_at <= available_at <= as_of < valid_until`.
The two observations must represent the same instant; equivalent timezone offsets
are accepted. The contract interval contains both observations and the cutoff;
`declared_at` must not exceed the cutoff. Observation followed by contract declaration
is allowed: this is retrospective declared consistency, not authenticated historical
availability or proof that the contract was fixed before observation.

There is no maximum data-age policy. An old observation inside its declared validity
interval can match. The diagnostic does not certify freshness or prespecification.

## Outputs and failure handling

Missing or invalid fields, unsupported real data, endpoint/hash/caller/purpose
mismatches, semantic conflicts and invalid or out-of-interval times yield `HOLD`
with reasons. Malformed, duplicate-key or oversized JSON and JSON `NaN`/`Infinity`
constants raise the
existing `ManufacturingReviewError` before a matching result can be produced.

Completely consistent synthetic declarations yield `DECLARATIONS_MATCH`, never an
operational PASS. Every result retains `operational_status: WITHHELD`,
`authority_status: unverified_declaration`, and `source_independence: unverified`.
Authority strings and source hashes are not authentication. The result records
input hashes and evaluation context; invalid non-string context values become null
and retain HOLD reasons.

## Existing functionality and integration limits

Existing JSON/time/hash helpers are reused. No changes are made to decision basis,
record quality, maintenance review, their schemas, `change_refs`, pending rows or
existing holds. This API cannot replace original-evidence validation and MATCH must
not override a HOLD. There is no UI, CLI, controller or production caller wiring.

An earlier separate design/eligibility candidate was unavailable for byte-level
comparison; compatibility with it is not claimed. Actual authority, caller roles,
two-source contracts, physical linkage, permitted use and timestamp provenance must
be established separately before any real-data integration. No factory safety,
prediction, yield, interoperability or performance improvement is demonstrated.

## Reproducible synthetic tests

Run from the repository root:

```bash
PYTHONPATH=src python -B -m unittest discover -s tests -p test_semantic_mapping.py -v
PYTHONPATH=src python -O -B -m unittest discover -s tests -p test_semantic_mapping.py -v
```

Both commands exercise the same 25 test methods, not 50 unique tests. Fixtures are
deterministic and use no random seed, real manufacturing records or model fitting.
A full-checkout coexistence check against main
`9e44fe7fea4d46c48ff0687c538972821a6bdfea` passed those 25 plus 48 existing basis,
quality, maintenance and manufacturing tests, and 373 existing Node tests.
Independent review reproduced the same scoped checks. These are not full Python CI,
browser, actual AAS, operational integration or field-validation results.
