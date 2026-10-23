# SECOM preprocessing comparison: training-only results

## Bottom line

**The new raw-row missing-count feature did not increase captured failures for any tested model.** The fixed RF lost two captures, L1 and boosting were unchanged. No candidate is selected, promoted, refit on all training data or run on the later 392 rows. This is development evidence, not independent test improvement.

Existing filtering and missing indicators have model-dependent effects. The largest mean AP is not consistently best at the fixed review budget, and fold results are unstable. Do not remove existing quality filtering or replace the operational/demo model based on this study.

## Frozen design and provenance

- [Protocol](PROTOCOL.md) and executable code were committed locally as `f2ede71be43c93e51addb93c1a80b7f4394b8d11` before the real run. No candidate settings or folds were changed after results.
- Main base: `cd7bf490a1d7ad3e53c77ea198e323b9d95c7ff3`. Open Draft #137 remains separate and unchanged; its L2/top40 selection experiments are not repeated.
- [Official UCI SECOM](https://archive.ics.uci.edu/dataset/179/secom), downloaded from the [official ZIP](https://archive.ics.uci.edu/static/public/179/secom.zip) on 2026-10-23, CC BY 4.0. All three raw hashes match the existing repository contract. No raw data is committed.
- Full raw bytes were read for integrity hashing only. Model input/label parsing is restricted to the original first 1,175 training rows using `nrows=1175`, then compared with the pinned training manifest. The later 392 feature/label rows were not parsed by the experiment.
- 1,175 training rows / 80 failures; original chronological train/test membership is unchanged. The current V1 uses shuffled repeated CV within training; this separate comparison instead uses three expanding whole-date folds. Neither is a new independent evaluation.
- 39 fixed fits, seed 20261023. No hyperparameter search, feature importance selection, outlier deletion/clipping, other-factory data or new package dependency.
- Python 3.12.14, NumPy 2.3.5, pandas 2.2.3, scikit-learn 1.8.0. Numerical differences can occur across library versions.
- Executed module SHA-256: `e0b90a08b468ce71a77620e5b430191739622ec994a0866c38c66224b251d19b`.

## Fold support and budgets

| Fold | Fit rows / failures | Validation rows / failures | Validation dates | Top10% slots |
|---|---:|---:|---|---:|
| 1 | 147 / 19 | 302 / 39 | 2008-08-07 to 2008-08-24 | 31 |
| 2 | 449 / 58 | 371 / 11 | 2008-08-25 to 2008-09-12 | 38 |
| 3 | 820 / 69 | 355 / 11 | 2008-09-13 to 2008-09-29 | 36 |

Every calendar day belongs entirely to one side of a fold. Unique dates were split into four consecutive blocks; the first 147 rows (19 failures) provide initial fitting and are not scored. The remaining 1,028 rows (61 failures) are scored once each under separate fold budgets, totaling 105 inspections. Later folds have only 11 failures: one changed capture moves their recall by 9.09 percentage points. Unknown production-lot/machine identifiers prevent a claim of group-independent validation.

## All predeclared candidates

AP is average precision. ± is the sample standard deviation across the three dependent folds, not a confidence interval. Capture below pools the three separate budgets, not one global top10% ranking.

| Model | Features | Mean AP ± SD | Captured / 61 | Pooled capture |
|---|---|---:|---:|---:|
| l1_logistic | impute_only | 0.098966 ± 0.058525 | 5 / 61 | 8.20% |
| l1_logistic | filter_only | 0.098965 ± 0.058506 | 6 / 61 | 9.84% |
| l1_logistic | current | 0.117174 ± 0.081352 | 5 / 61 | 8.20% |
| l1_logistic | current_plus_row_missing | 0.117208 ± 0.081372 | 5 / 61 | 8.20% |
| random_forest | impute_only | 0.119371 ± 0.075059 | 13 / 61 | 21.31% |
| random_forest | filter_only | 0.088624 ± 0.051284 | 7 / 61 | 11.48% |
| random_forest | current | 0.088042 ± 0.063932 | 9 / 61 | 14.75% |
| random_forest | current_plus_row_missing | 0.083425 ± 0.049118 | 7 / 61 | 11.48% |
| hist_gradient_boosting | impute_only | 0.163585 ± 0.133947 | 11 / 61 | 18.03% |
| hist_gradient_boosting | filter_only | 0.155006 ± 0.121428 | 10 / 61 | 16.39% |
| hist_gradient_boosting | current | 0.155006 ± 0.121428 | 10 / 61 | 16.39% |
| hist_gradient_boosting | current_plus_row_missing | 0.155006 ± 0.121428 | 10 / 61 | 16.39% |
| dummy | current | 0.063258 ± 0.057058 | 7 / 61 | 11.48% |

## What the contrasts actually show

- Filtering (`filter_only` vs `impute_only`): L1 AP nearly unchanged and captures 5→6; RF AP .119371→.088624 and captures 13→7; boosting AP .163585→.155006 and captures 11→10. Removing exact-duplicate and other filtered columns also changes a random forest’s random-feature sampling; these interactions do not justify a universal “sensor cleanup improves performance” claim.
- Indicators (`current` vs `filter_only`): L1 AP .098965→.117174 but captures 6→5; RF AP .088624→.088042 but captures 7→9; boosting unchanged. Better AP and better fixed-budget capture are not interchangeable.
- Row missing count (`current_plus_row_missing` vs `current`): L1 AP changes only .000034, captures remain 5; RF AP falls .004617, captures 9→7; boosting unchanged. No supported improvement from this addition.
- Cross-model on `current`: boosting has the highest mean AP (.155006), but validation AP spans .030618–.273240 and one fold captures 0/11 failures. RF captures 9/61 versus boosting 10/61, only one case difference. These small, unstable differences are not a basis for a model replacement.
- Dummy AP equals each fold’s prevalence. Its stable-ID arbitrary ordering captures 7/61; random boundary-tie breaking would expect approximately 6.245 captures, not 7 guaranteed. It is not an optimized classifier.

## Tie policy, uncertainty and preservation

Each fold receives exactly `ceil(0.10 × n)` inspections. Scores descend; sample IDs ascend to break equal scores without labels. All fitted-model cutoffs in this run have one boundary row (no crossing tie); Dummy ties all rows. Full tie counts, bounds and expected captures are in [fold metrics](results/fold_metrics.csv). Column diagnostics `removed_high_missing` and `removed_uninformative` are overlapping reason flags and must not be added; uniquely removed columns equal 590 minus `retained_raw_columns`. Duplicate flags apply after the other filters. Capture denominators include every validation failure. Missing labels and abstention are not present in this official dataset.

Fold mean/std/min/max and pooled capture are in [summary](results/summary.csv). The [manifest](results/manifest.json) records raw hashes, frozen training hash, exact fit/validation membership, all model settings, environment, and limitations. No significance test or independent confidence claim is made: folds have overlapping training sets, strong prevalence drift and scarce failures. Historical training data has already been reused in earlier work.

V1/Phase1 artifacts, original modeling/preprocessing code, web data and pending PR branches remain unchanged. Standard CI’s persisted-evidence recomputation only checks previously saved V1 outputs; it does not generate new holdout scores or influence this experiment. No merger, manual deployment, institution contact or field-performance claim is part of this work.

## Reproduce

Run from the repository root with the hash-matching official raw files in the supplied directory. The output directory must not exist; earlier experiment outputs are never silently overwritten.

```sh
PYTHONPATH=src python -m fabguard.secom_comparison \
  --data-dir /path/to/official-SECOM \
  --output-dir /path/to/new-output-directory
PYTHONPATH=src python -m unittest discover -s tests -p "test_secom_comparison.py" -v
```

The committed results are from the frozen real run. Synthetic tests are behavior/regression tests, not SECOM performance evidence. No model binary or individual prediction output is needed to reproduce the aggregate comparison.

## Verification

- A second execution with identical frozen settings reproduced all three output files byte for byte. It was a reproducibility rerun, not another candidate search.
- 15 new regression tests passed, including train-limit parsing, fit-only feature behavior, complete-day boundaries, ties, fixed-model smoke tests, saved arithmetic and exact fold membership.
- Full Python suite: 218 tests run, OK with 3 pre-existing skips (unavailable official source fixture and two optional Frictionless checks).
- Web suite: 65/65 passed. JavaScript syntax, persisted V1 evidence arithmetic, source-clarification registry structure and shared web evidence checks passed. The empty source-clarification registry does not establish provider identity.
- V1/Phase1 output files, original preprocessing/modeling modules and web assets have zero diff from main; `git diff --check` passed.
- Independent read-only review found no remaining must-fix issues after clarifying overlapping filter-reason counts and the exact-duplicate wording. It reran the initial 14 synthetic tests and audited aggregate arithmetic/report claims; it did not independently regenerate real model scores.
- GitHub Actions status is reported on the Draft PR for its exact remote head, separately from these local results.
