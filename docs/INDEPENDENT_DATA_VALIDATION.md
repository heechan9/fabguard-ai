# Independent manufacturing data validation

Status: **implemented schema/provenance gate; no external model result yet**

This adapter validates a new manufacturing CSV before any FabGuard model claim is attempted. It is
separate from the fixed SECOM V1 experiment and never writes under `results/v1/`.

## Contract

The input must provide a unique identifier, a parseable timestamp, a complete binary label and at
least one numeric measurement column. The default column names are `sample_id`, `timestamp`,
`label`, and `feature_*`; CLI options can map other names.

The report records the source SHA-256, row and feature counts, label balance, time range and reversal
count, missing cells, and constant or all-missing features. Duplicate IDs, invalid timestamps,
non-numeric or infinite measurements, unit-ambiguous numeric epoch timestamps, incomplete labels and
non-binary labels fail closed. Numeric epoch input requires a future explicit unit contract rather
than guessing seconds, milliseconds or nanoseconds.

## Compatibility boundary

With the default contract, `locked_model_candidate` means only that the complete anonymous
feature-name contract matches `feature_000` through `feature_589`. It does **not** mean that sensor meaning, units, distributions,
process stage or label timing match SECOM. A separately versioned frozen model and an approved
external-evaluation protocol are still required before scoring.

Any other feature schema is reported as `schema_only`. FabGuard V1 must not be retrained, tuned or
presented as validated on that data through this adapter.

## Example

```bash
fabguard-independent-validate \
  --input examples/independent_validation/sample_manufacturing.csv \
  --output-dir results/independent-validation
```

The two generated files are `validation_report.json` and `VALIDATION_SUMMARY.md`. Under the default
590-feature contract, this small bundled example correctly reports `schema_only`. It is a synthetic
contract fixture, not semiconductor production evidence.

## Non-claims

- No model fitting, scoring or candidate selection is performed.
- No independent performance metric exists until an approved compatible dataset and frozen model are supplied.
- No sensor or process cause is inferred from anonymous variables.
- No yield, cost, uptime, lead-time or factory-integration outcome is claimed.
