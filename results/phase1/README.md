# Phase 1 advanced validation snapshot

This directory records the advanced-validation outputs reproduced on 2026-09-04 with the official UCI SECOM files and scikit-learn 1.9.0.

```bash
python -m fabguard.advanced_experiment \
  --data-dir data/raw \
  --output-dir results/phase1 \
  --bootstrap 2000 \
  --inspection-cost 1 \
  --missed-fail-cost 20
```

The experiment retained the existing `results/v1/manifest.json` split (`test_split_changed: false`). Calibration was fitted only on the last 20% of the training period. Cost units are scenario assumptions, not currency or measured factory savings.

## Reading the snapshot

- Sigmoid calibration reduced Brier score from 0.0654 to 0.0599 and ECE from 0.0922 to 0.0401.
- Under the illustrative 1:20 inspection-to-missed-fail cost ratio, reviewing the top 20% had the lowest tested scenario cost: 399 versus 480 for no review.
- The top-10% bootstrap fail-capture interval was wide (6.2%–36.8%), so the ranking signal remains provisional.
- Walk-forward average precision varied from 0.054 to 0.280 across four time windows.
- scikit-learn warned that one walk-forward fold had only four minority-class samples for five splits. The run completed, but the warning reinforces the uncertainty boundary.

## Exploratory paired model comparison

`model_pairwise_comparison.csv` compares the selected Random Forest with the best
logistic candidate using the same repeated-CV splits. The five folds within each
repeat are averaged first, then a two-sided exact sign-flip test is applied to the
five repeat-level differences. Random Forest won all five repeat averages, with a
mean Average Precision difference of about 0.0382, but the exact two-sided p-value
is 0.0625. This is exploratory evidence, not proof of statistical significance or
deployment superiority. Aggregating by repeat avoids treating all 25 overlapping
fold estimates as independent observations.

These outputs do not establish yield improvement, causal impact, or production readiness.
