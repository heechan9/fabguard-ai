# Locked independent-evaluation readiness contract

Status: **implemented integrity and approval gate; model scoring remains unimplemented**

This gate is the step after independent data schema/provenance validation. It prevents accidental
scoring, tuning, or result publication until a frozen model bundle and a pre-declared evaluation
approval are cryptographically bound to the exact external dataset and ordered feature contract.
The approval records a reviewer name but is not a digital signature or identity-authentication
system; repository review and access controls remain the human governance boundary.

## Required inputs

1. `validation_report.json` from `fabguard-independent-validate`, with
   `evaluation_mode=locked_model_candidate` and no prior scoring.
2. A `fabguard.locked-model.v1` manifest declaring a frozen artifact, artifact SHA-256, ordered
   feature-name SHA-256, training-data SHA-256, completed selection, and split-contract identifier.
3. A `fabguard.evaluation-approval.v1` approval created before scoring. It binds the dataset,
   validation report, model manifest, model artifact, and ordered feature names by SHA-256 and
   affirms that the external dataset was not used for training and that tuning stops after approval.

The artifact path must remain inside the model bundle directory. The gate hashes the file but never
deserializes it; this avoids executing an untrusted pickle or model payload during readiness checks.

## Command

```bash
fabguard-locked-evaluation-check \
  --dataset path/to/external.csv \
  --validation-report path/to/validation_report.json \
  --model-manifest path/to/model_bundle/model_manifest.json \
  --approval path/to/evaluation_approval.json \
  --output-dir results/independent-readiness
```

The gate reruns schema/provenance inspection against the supplied CSV and requires an exact match
with the approved validation report; a report cannot substitute for the original data. Successful
verification writes `evaluation_readiness.json` and `EVALUATION_READINESS.md`. The
status `ready_for_separate_locked_scoring` means only that integrity and approval gates passed. It
does not mean the model was loaded, run, or independently validated.

## Fail-closed conditions

- schema-only data or missing feature-contract evidence
- mutable or incomplete model manifest
- model artifact, manifest, validation report, dataset, or feature digest mismatch
- path traversal or an artifact outside the declared bundle
- absent, malformed, unnamed, or non-independent evaluation approval
- approval that permits further tuning

## Deliberately deferred

- model serialization format and trusted loading policy
- prediction interface and score output schema
- independent performance metrics and confidence intervals
- model card update based on actual external results
- production, yield, cost, uptime, or causal process claims

No example approval is committed because approval must identify a real reviewer and bind real,
final artifacts. Tests construct synthetic temporary bundles only.
