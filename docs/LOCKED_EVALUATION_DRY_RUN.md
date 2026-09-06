# Synthetic locked-evaluation dry run

Status: **contract-tested; no real external model result**
Verified: 2026-09-06

The dry run uses temporary synthetic CSV files and synthetic model bundles created inside the test
suite. It never reads a real external dataset, never writes under `results/v1/`, and creates no
performance claim.

## Command

```bash
PYTHONPATH=src python -m unittest \
  tests.test_locked_evaluation tests.test_locked_scoring -v
```

## Fail-closed matrix

| Scenario | Expected evidence |
|---|---|
| Valid bound inputs | readiness succeeds without loading or scoring |
| No explicit pickle trust | scoring is refused before deserialization |
| Dataset mutation | approved validation report cannot be reused |
| Artifact or manifest mutation | SHA-256 binding rejects the bundle |
| Artifact path traversal | bundle-relative path check rejects it |
| Approval binding mismatch | readiness rejects the approval |
| Environment version mismatch | scoring rejects deserialization environment |
| Duplicate execution | pre-existing output directory rejects a second run |
| Successful synthetic score | no `fit` call; evidence is atomically written |

Duplicate prevention is scoped to the declared immutable output directory. It does not provide a
global distributed transaction lock across different output paths. Operational execution must
therefore allocate one approved evaluation identifier and one canonical output path before scoring.

The test fixture's scores are implementation checks only. A real evaluation may run only after the
dataset passes [external qualification](EXTERNAL_DATA_QUALIFICATION.md), validation, model export,
approval and hash binding.
