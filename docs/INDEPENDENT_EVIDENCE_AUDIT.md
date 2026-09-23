# Persisted evidence recomputation and source clarifications

## Scope and current result

This is an independently implemented calculation check, **not an independent reviewer, fresh
model inference, new holdout, or field validation**. It preserves the provisional V1 status and
the [prior test exposure boundary](TEST_EXPOSURE.md). No dependency, split, threshold, ranking,
or evaluation definition changes.

[`verification/recompute_v1.py`](../verification/recompute_v1.py) uses Python's standard library
only. It does not import FabGuard, sklearn, numpy, or pandas. It checks the selected Random Forest
predictions already in `results/v1/priority_table.csv`, their sample/label/timestamp alignment to
`test_split.csv`, and their agreement with `test_metrics.csv` and `top_k_test.csv`.

- Recompute the confusion matrix, recall, precision, F1, balanced accuracy, false-alarm rate,
  accuracy, and non-interpolated average precision (consume tied score groups together).
- Sort by descending score then ascending sample ID; use `ceil(n * fraction)` for the frozen
  5%, 10%, 20% inspection budgets. Recompute capture, precision, burden, and lift.
- Fail on missing/duplicate sample IDs, invalid labels/probabilities, non-finite numbers, wrong
  model, threshold prediction mismatch, malformed tables, changed budgets, or metric disagreement.
- Integers compare exactly; floating values use relative tolerance `1e-9`, absolute `1e-12` to
  accommodate CSV floating-point serialization. These tolerances are not statistical intervals.

The check agrees with canonical V1 evidence: AP `0.09347718147533737`, confusion counts
TN/FP/FN/TP = `368/0/24/0`, and Top-K captured fail counts `4/5/7` out of `24`.
See the [execution report](../results/verification/v1_recompute.json),
[original metrics](../results/v1/test_metrics.csv), and
[original Top-K table](../results/v1/top_k_test.csv).

The other model rows have no per-sample predictions in this input bundle and are **not**
independently recomputed here. Likewise this does not recompute bootstrap intervals, train CV,
statistical comparisons, raw feature preprocessing, or walk-forward runs. Internally consistent
fabricated files can pass; source hashes identify exact inputs but do not authenticate their origin.

## Reproduce

From the repository root, Python 3.11+; no third-party installation required for these commands:

```bash
python verification/recompute_v1.py
python verification/source_clarifications.py
python -m unittest discover -s tests -p test_evidence_recomputation.py -v
```

The commands read inputs and emit JSON to stdout. They never rewrite canonical results. The
committed report records input SHA-256, Python version, source commit, and execution command.
There is no RNG or new seed: calculations are deterministic; original training seed remains in
the hashed V1 config. CI reruns the checks rather than trusting the committed snapshot.

## Source meaning corrections

[`docs/data/source_clarifications.json`](data/source_clarifications.json) starts empty. No real
provider clarification or endorsement is asserted. This registry complements existing data
lineage: it records changes to interpretations (such as units, year, aggregation), not new
performance results. Original bytes, historical descriptions, and official results stay intact.

Each record requires `id`, `dataset_id`, `source_sha256` (64 lowercase hex characters), `field`,
`previous_interpretation`, `corrected_interpretation`, `reason`, `evidence_reference`, `reviewer`,
timezone-aware `recorded_at`, `status` (`proposed` or `confirmed`), and `supersedes` (null or an
earlier record ID). Evidence references must be safe to publish: use an approved public source or
a private evidence identifier, never paste private correspondence, tokens, or personal details.

Append a proposed record after obtaining actual evidence. Human review must confirm the meaning
and disclosure scope. To confirm or revise it, append a superseding record; retain the earlier
record. `supersedes` must stay within one dataset/hash/field and continue the interpretation chain.
Git review enforces preservation of previously committed entries; the structural checker alone
cannot prove that someone did not rewrite history. A reviewer name is not identity verification.

```bash
python verification/source_clarifications.py \
  --record REAL_CONFIRMED_RECORD_ID --source /local/path/to/original.csv
```

Registry-only checking reports `registry_structure_valid` and `source_bytes_verified=false`.
Only an existing, confirmed, unsuperseded record matching the actual file SHA-256 reports
`source_binding_verified`. Neither mode authenticates the provider, establishes physical truth,
changes source data, applies corrections, or validates model performance. Derived data after a
correction requires its own version, provenance, and separate experiment results.

Synthetic positive/mutation cases exist only in
[`tests/test_evidence_recomputation.py`](../tests/test_evidence_recomputation.py).

## Reuse rationale and contribution boundary

The design reuses two ideas, with a new FabGuard-specific implementation (no foreign experiment
results or domain code copied):

- [Adversarial AI clean recomputation](https://github.com/heechan9/AdversarialAI_Security/blob/491b973cd9f4840664044a83c0d62d1ee1bb98e8/verification/stage_a_clean_recompute.py): separate persisted-artifact arithmetic from model inference.
- [Bunkering provider clarification](https://github.com/heechan9/bunkering-ai/blob/66ae9dec2f8ea13a8f4e11b656bc0a011f238929/docs/technical/hanbada_provider_clarification.md): bind semantic corrections to exact source bytes and preserve interpretation history.

The existing [readiness gate](LOCKED_EVALUATION_CONTRACT.md) and
[scoring runner](LOCKED_SCORING_CONTRACT.md) remain the route for a future real independent
dataset. They are not replaced by this persisted-output check.
