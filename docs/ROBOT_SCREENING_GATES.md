# Robot label-free feature gate (first implementation slice)

## Status and scope

This implements only the extracted-feature contract and condition-coverage portion of [design PR #164](https://github.com/heechan9/fabguard-ai/pull/164). It is not the full raw-sensor loader/scoring proposal. PRs #162 and #163 have merged; #164 remains a separate design draft as of 2026-10-23. This change does not edit that author's branch.

`src/fabguard/robot_screening.py` is a standalone, dependency-free Python API. It does not load a model or files, fit, impute, score, rank, evaluate labels, download data, control equipment, or change the existing benchmark. There is no CLI or web integration. All tests and example artifacts are synthetic. **No verified real-model condition manifest is shipped or claimed.** The unresolved derived-feature CSV byte identity and absent verified training-membership evidence still block real artifact integration.

## Label-free input contract

Call `assess_features(row, manifest, model_sha256=..., feature_csv_sha256=..., protocol=...)`, or `assess_batch(rows, manifest, **binding)` for a nonempty list. Each row is an ordered mapping containing only:

- `segment_id`: nonblank string, unique within the inspected batch. Historical `_dataLog_` naming is not required.
- `domain_shift_op`, `domain_shift_env`: condition metadata. Missing/unknown metadata is reported separately from numeric input quality.
- The 42 numeric columns in `FEATURE_COLUMNS`, in that exact order. Metadata order is irrelevant. The seven channels and six statistics match the existing benchmark extractor and are regression-tested against it.

Labels, split labels, scores and all other extra columns are rejected, not silently dropped. The benchmark loader continues to enforce its own labeled fixed-count contract unchanged. This API accepts Python real numbers, not numeric strings or booleans. Missing, malformed and nonfinite values are invalid. All statistics except means must be nonnegative; valid fractions must lie in `[0,1]`. These are mathematical bounds, not empirically chosen anomaly thresholds. No physical upper bounds have been established for the other statistics.

Every valid fraction must equal one. Any partial or entirely missing channel is conservatively withheld without imputation. This is a fixed input-policy choice, not a tuned threshold or evidence that complete input is physically reliable. All independently observable problems are retained rather than stopping at the first failure. Duplicate IDs withhold every occurrence in a batch. Callers needing uniqueness must use the batch API, not repeated single-row calls.

## Manifest and condition contract

A manifest is a JSON-compatible mapping with exactly these keys:

- `schema_version`: integer `1` (not Boolean).
- `model_sha256`, `feature_csv_sha256`: lowercase 64-character hex digests that match the separately supplied expected bindings.
- `protocol`: exactly `published_split` or `disjoint_recording_groups`, matching the expected protocol.
- `feature_columns`: the exact ordered list of all 42 feature names.
- `training_membership`: nonempty list of records with exactly `segment_id`, `recording_group`, `domain_shift_op`, `domain_shift_env`. IDs must be distinct; IDs and groups must be nonblank. This list must eventually come from the actual fit membership for that exact artifact and protocol, not the entire source dataset or a manually expanded condition list.
- `manifest_sha256`: SHA-256 of UTF-8 JSON of all other fields, with sorted object keys, compact separators, ASCII escaping, and no NaN/Infinity. Array order is retained. `manifest_digest` implements this definition.

Membership records retain per-segment/group evidence, so condition segment counts and unique-group counts can be derived without trusting a separate count table. A caller must independently verify the source CSV, artifact bytes, exact training selection and trustworthy provenance before supplying real bindings. **Self-consistent hashes establish neither authenticity nor truthful training membership.** The status deliberately says `binding_consistent_not_authenticated`; it does not say verified. No manifest generator or real-artifact ingestion is provided in this slice.

Condition vocabulary is exact and case-sensitive: `weight00`, `weight10`, `weight15`, `weight20`, `weight25`, `weight30`, `weight35`; and `BckgA` through `BckgG`. Values are not trimmed or case-normalized. Blank strings/None/absent keys are missing; nonblank unrecognized values are unknown. Known pairs absent from the validated membership are `known_untrained`, including recognized values with no training observations. A pair present in membership is `seen_in_training`, **not normal**. This never adds held-out or target conditions to training coverage.

Missing and unknown condition reasons can coexist. Coverage against training is `not_evaluated` when the manifest is missing/malformed/mismatched, but independently observable unknown metadata is still reported. A structurally unavailable row has no evaluated condition.

## Output and abstention

Every result has separate `input_status/input_reasons`, `manifest_status/manifest_reasons`, and `condition_status/condition_reasons`, plus their combined `overall_reasons`. `gate_status=passed` only means that the finite feature contract, supplied binding consistency and seen-condition checks passed. All other cases are `withheld`.

**Every result, including a gate pass, has `overall_status=abstain`, `score=null`, `batch_rank=null`, and `scoring_not_implemented`.** There is no normal/safe/alarm verdict or quality-to-fault conversion. `raw_sensor_quality=not_evaluated` and `time_sync=not_verifiable` explicitly prevent summary-level checks from becoming claims about raw channel presence, sampling, calibration or synchronization. Reported valid fractions are the supplied summaries, not independently recomputed measurements.

The seven valid-fraction features already influence the unchanged benchmark model, so missingness could change its scores independently of robot condition. This module does not remove those features or relabel that effect as sensor/robot diagnosis. Future scores/ranks, if separately authorized and artifact-verified, must remain within-batch and artifact-specific. The adverse target-domain evidence in [the persisted benchmark report](../results/robot-imad-2026/README.md) remains unchanged; this gate does not improve or re-evaluate it.

## Verification and remaining work

Synthetic tests cover exact extractor schema, unknown vs known-untrained conditions, multi-reason failures, malformed/nonfinite/out-of-range input, every channel's partial missingness, label rejection, ordering, manifest digest/model/data/protocol mismatch, malformed membership, duplicates, immutability, and output allowlisting/no scoring.

```sh
PYTHONPATH=src python -m unittest discover -s tests -p 'test_robot*.py' -v
PYTHONPATH=src python -m unittest discover -s tests -v
```

Raw sensor path/schema/timestamp validation, synchronization evidence, trusted artifact/membership construction, model execution and independent new-recording performance validation remain separate work. The existing 464 exposed test segments are not used for tuning or new evaluation here. No original data, model binaries or replacement result artifacts are included.
