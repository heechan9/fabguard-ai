# Locked V1 Model Export

Status: **implemented export contract; the official bundle must still be generated locally from the verified UCI files.**

`fabguard-model-export` recreates the canonical temporal split, verifies the raw-file hashes, fixed
configuration, selected Train-CV candidate, and `train_split.csv`, then fits that candidate on Train only.
It writes an immutable directory containing `model.joblib` and `model_manifest.json`.

```bash
fabguard-model-export \
  --data-dir data/raw \
  --canonical-result-dir results/v1 \
  --output-dir results/locked-model-v1
```

The output directory must not already exist. The exporter builds the complete bundle in a sibling temporary
directory and publishes it with one rename, so a failed run cannot masquerade as a complete bundle. It does
not modify `results/v1`, inspect external evaluation labels, repeat candidate selection, calibrate on the
holdout, or recompute canonical metrics.

## Security and evidence boundary

`model.joblib` uses Python pickle semantics. **Load it only when both its manifest and SHA-256 have been
verified and its source is trusted.** Hashing detects alteration; it does not make an untrusted pickle safe.
The bundle records the ordered feature-name digest, Train split digest, raw-file hashes, selected candidate,
seed, and library versions. Export success proves reproducible packaging—not independent performance,
Fledge compatibility, field deployment, yield improvement, cost reduction, or causal process impact.

The next separately reviewed step is a scorer that consumes an approved readiness bundle without fitting or
tuning anything.

`training.data_sha256` is the SHA-256 of a canonical JSON identity containing the three official raw-file
hashes, Train split hash, Train row count, and Train Fail count. It is an evidence binding, not the hash of a
new combined dataset file. Byte-identical joblib output is expected only within a matching recorded software
environment; the manifest makes environment differences visible.
