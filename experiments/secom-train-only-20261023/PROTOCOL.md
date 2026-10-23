# SECOM training-only preprocessing comparison

Frozen before results on 2026-10-23, based on main `cd7bf490a1d7ad3e53c77ea198e323b9d95c7ff3`.
This is an exploratory development experiment, not a new independent test.

## Why this slice

Main already uses >50% missing, constant and duplicate-column filtering plus median imputation **with missing indicators**. This study must not describe those as new features. Open Draft [#137](https://github.com/heechan9/fabguard-ai/pull/137) already explores L2 and RF top40 selection; that branch remains untouched. We do not repeat its hypotheses, inspect its predictions, or use any exposed test metric for selection.

## Data and separation

- Official UCI SECOM raw files must match the three hashes already in `fabguard.config.OFFICIAL_HASHES`.
- Freeze existing chronological Train 1,175 / later Test 392 membership. The training CSV SHA-256 is `d47b5254102519050844e21f0076537644d45dfe7262d596ad5c7887e6e81aec`.
- The manifest identifies exactly raw rows 0..1174. Hash raw files in full for integrity, but parse only the first 1,175 feature/label rows using `nrows`; verify training timestamps/labels against that manifest. No later feature/label rows are parsed, transformed, predicted or scored. No test-split file is needed.
- Split unique dates inside training into four consecutive blocks with `numpy.array_split`; use the first as initial fit, then three expanding fit/next-block validation folds. All rows sharing a date stay together. No random/shuffled CV, no future rows in fit. Actual machine/lot groups are unknown, so date grouping is not claimed to replace them.
- Fail closed if a fit or validation fold lacks either class. No outlier-row deletion, clipping, resampling or external-factory data.

## Fixed budget and isolated contrasts

Four feature modes, each crossed with the three fixed models below:

1. `impute_only`: all 590 columns, fit-fold median imputation, no indicators/filter. An all-empty fit column is filled with zero using `keep_empty_features=True` to keep a stable schema.
2. `filter_only`: current train-fit >50% missing, <=1 observed unique value, exact duplicate-column filtering; median imputation without indicators.
3. `current`: same filtering and median imputation with indicators for columns missing in fit. This is the current **preprocessing** baseline, not a replay of V1 model selection.
4. `current_plus_row_missing`: current plus a count of missing values across all 590 raw columns before filtering, computed separately for each row. No label fitting.

Models, seed `20261023`, no search or tuning:

- L1 Logistic: C=0.1, liblinear, balanced classes, max_iter=3000; train-fit StandardScaler. Fail the run on a convergence warning.
- RF: 120 trees, depth=8, min leaf=4, sqrt features, balanced_subsample, one worker.
- HistGradientBoosting (already in scikit-learn): 100 iterations, learning rate=.05, max leaves=7, depth=3, min leaf=20, L2=1, balanced classes, early stopping disabled. No new dependency.
- One prior Dummy using `current` per fold.

Total: 13 candidates × 3 folds = 39 fits. All column decisions, medians, indicators and scaling fit anew inside each fold. No ranking/selection of a winning model, no full-training final fit, no holdout run. Model and preprocessing interactions are preserved, not summarized as a universal improvement.

## Metrics and interpretation

- AP means scikit-learn average precision, not trapezoidal area.
- Top10%: exactly `ceil(0.10 × fold validation size)` inspection slots. Rank score descending, then stable sample ID ascending. Capture denominator is every failed row in that validation block.
- Report boundary tie size, failure count, slots, minimum/maximum possible captures and random-tie expected captures. Dummy ordering is arbitrary and must be interpreted with these diagnostics.
- Report each fold and mean, sample standard deviation, min/max. These dependent expanding folds are not independent replicates and their dispersion is not a confidence interval.
- Pooled capture adds successes and failures across the disjoint validation blocks under separate fold budgets, not one global Top10% budget. Initial fitting block is not evaluated.
- Primary contrasts within each fixed model: filter_only minus impute_only; current minus filter_only; row-count variant minus current. Cross-model comparison uses the same feature mode and folds. Any apparent gains remain development evidence.

## Outputs and preservation

Write only aggregate metrics, fold membership/audit and reproducibility metadata to a new output directory. No model binaries, raw data or individual predictions in Git. Keep V1, Phase1, web evidence, existing pipeline and all pending PRs unchanged. Draft PR only; no merge, manual deployment or model replacement.
