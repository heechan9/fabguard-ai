# V2 missingness-indicator ablation protocol

Status: **pre-registered design; not yet executed**
Fixed: 2026-09-06

## Purpose

V2 asks one narrow mechanism question: does retaining indicators of missing measurements improve
risk ranking compared with median imputation alone? It is not a broad model search. No XGBoost,
LightGBM, anomaly ensemble, threshold search, or additional feature-selection sweep is authorized
by this protocol.

## Frozen data boundary

- Use only the original V1 Train interval: 1,175 rows and 80 Fail labels.
- Never inspect, score, tune on, or regenerate decisions from the exposed 392-row V1 holdout.
- Use exactly the stored `RepeatedStratifiedKFold(n_splits=5, n_repeats=5)` split identities and
  seed where available.
- Fit every data-dependent preprocessing step inside each training fold.

## Compared conditions

For each already-selected Logistic Regression and Random Forest specification, compare:

1. **Indicator condition:** `SimpleImputer(strategy="median", add_indicator=True)`.
2. **No-indicator condition:** the identical pipeline with `add_indicator=False`.

All other preprocessing, hyperparameters, class weighting, ordering, tie-breaking and seeds remain
fixed. This creates two paired ablations, not four new model candidates. V2 must not replace the V1
selected model or alter canonical V1 artifacts.

## Endpoints and multiplicity

- **Primary endpoint:** repeat-level paired AP difference, indicator minus no-indicator.
- **Primary family:** two comparisons, one per model family.
- **Multiplicity:** Holm correction across the two two-sided exact tests; family-wise
  `alpha=0.05`.
- **Secondary endpoints:** Top-10% capture and lift computed inside the same validation folds.
- **Sensitivity endpoints:** Top-5% and Top-20% capture/lift.

Raw and adjusted p-values, all five repeat-level differences, effect direction and dispersion must
be published. Secondary endpoints are descriptive and cannot rescue a failed primary endpoint.

## Success, failure and stopping

- **Supported for a model family:** Holm-adjusted `p<0.05` and positive mean paired AP difference.
- **Not supported:** any other outcome. This includes positive effects with insufficient evidence.
- **Harm signal:** negative mean paired AP difference, reported regardless of significance.
- Run the frozen analysis once. Implementation bugs may be corrected only with a documented cause,
  changed-file diff and invalidated run record; outcome-driven reruns are prohibited.

No post-hoc power claim will be inferred from the p-value. Before execution, report the smallest
effect detectable under an explicitly stated simulation or resampling model; because overlapping
CV estimates are dependent, the 25 fold scores must not be treated as 25 independent samples.

## Required outputs

- machine-readable config and environment versions
- stored split identifiers and per-fold scores
- five repeat-level paired differences per model family
- raw and Holm-adjusted test results
- Top-K secondary results with uncertainty
- manifest hashes and an explicit statement that `results/v1/` was unchanged
