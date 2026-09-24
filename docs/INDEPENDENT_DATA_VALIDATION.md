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

## Available-data review (base 6275429, 2026-09-25)

| Available repository data | Independent SECOM evaluation eligibility |
|---|---|
| Official SECOM V1 and Phase1, including re-download | No: same already-exposed historical population |
| DKASC / PV_Live / PVGIS / RTE / Enedis / Météo-France | No: generation/weather contracts, different inputs and targets |
| `examples/independent_validation/sample_manufacturing.csv` | No: synthetic schema fixture |
| `examples/spc_synthetic.csv`, SMT template/synthetic example and simulation | No: synthetic measurements/rules, no independently observed production labels |

No compatible independent manufacturing evaluation set was found among these
available repository assets. This is an inventory finding, not a claim that no
such data exists elsewhere. No other KAMP process dataset has been admitted here.

## Acquisition and release gates

1. Obtain an authorized, de-identified production export and written rights to
   analyze and publish derived metrics. Record provider, process/site, collection
   dates, version, raw SHA-256 and provenance; keep restricted raw data outside git.
2. Supply a data dictionary: each input's measurement meaning, unit, sampling and
   process stage, instrument/calibration changes, missing-value codes, lot/wafer
   grouping, event timestamps/timezone, and feature availability at prediction time.
3. Supply independently observed pass/fail labels with definition, measurement
   method, delay and adjudication. Prevent post-inspection features leaking labels;
   identify repeated lots and duplicates across development/evaluation partitions.
4. For the frozen SECOM model, establish a defensible one-to-one mapping to every
   required measurement, ordering, units and timing. Matching 590 anonymous names
   is insufficient. Public SECOM anonymity may make this mapping impossible:
   reject model transfer if semantics cannot be established.
5. For another KAMP process, build a separate dataset/version and model experiment
   with a process-specific target and budget. Freeze chronological/group-aware
   development splits, preprocessing, candidate selection and thresholds before
   sealing a later/site-independent evaluation set. Do not combine its metrics
   with SECOM or use PV/SMT success as external semiconductor performance.
6. Before evaluation, record frozen model/code/environment hashes, AP and fixed
   inspection budgets, required number of failures and uncertainty precision,
   false-alarm constraints, minimum acceptable gain and a one-time release rule.
   Determine sample size from the intended precision and prevalence; no universal
   minimum is assumed. Keep evaluation labels inaccessible during selection.
7. Run the schema/provenance gate, review semantic compatibility, then score once
   without tuning. Publish denominators, uncertainty, temporal/site slices and
   negative findings. If used for tuning, obtain another untouched evaluation set.

Until these gates pass, keep the operational demonstration model unchanged and
label all follow-up SECOM measurements exploratory.
