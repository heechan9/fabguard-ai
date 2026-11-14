# SCATIM external injection molding experiment (2026-09-26)

## Question and source

Can a FabGuard-style, leakage-aware evaluation distinguish useful quality predictions from a trivial baseline on **another** real injection molding data source? The author-published [SCATIM repository](https://github.com/sc4t1m/scatimdata) supplies three archives (CC BY 4.0). Its [paper](https://www.mdpi.com/2073-4360/15/4/978) describes measured part weight and dimension linked to each machine cycle. The process and outcomes differ from KAMP S14 CN7/RG3: these results do **not** measure transport of the KAMP classifier, later-period KAMP performance, defect detection, or live operation.

## Prespecified evaluation in this slice

- Use datasets 1 and 3, whose CSVs give scalar process measurements, a cycle counter, two continuous measured quality outcomes, and injection flow/pressure curves. The counter strictly increases and identifies one measured part per row. It supplies order, **not a calendar timestamp**.
- Train on the first 70% of each dataset; evaluate once on the remaining 30%, separately for each quality outcome. Do not shuffle. Counter ranges and input SHA-256 values are in `results/audit.json`.
- Never feed `weight`, `distanceA`, `distanceB`, or `cycle_counter` as predictors. Use process scalars, then compare with six per-cycle flow/pressure summary features (mean, maximum, standard deviation). All imputation and scaling are learned only from the training portion. A prediction is defined after the injection cycle and before the quality measurement; an earlier-in-cycle claim would require another feature audit.
- Compare a training-mean predictor, Ridge (fixed alpha 10), and random forest (fixed 200 trees, leaf size 5, feature fraction 0.8). No holdout-based tuning. Report MAE and RMSE in each outcome's original units. Both feature sets share the same rows, split, and labels; the mean predictor is repeated for clarity.
- Dataset 2 has its own **within-run** protocol below: its HDF5 scalar table concatenates `Versuch` runs in file order 20, 23, 15 and `cycle_counter` falls at the run boundary. Its run order cannot be treated as a verified date order. Do not apply a global file-order split.

## Observed holdout results

| Data / outcome | Holdout n | Mean baseline MAE | Scalar Ridge MAE | Scalar forest MAE | Scalar + curve Ridge MAE | Scalar + curve forest MAE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / weight | 351 | **0.0457** | 0.0473 | 0.0461 | 0.0475 | 0.0450 |
| 1 / distanceA | 351 | 25.71 | 27.80 | 24.89 | 30.12 | **24.65** |
| 3 / weight | 400 | 0.4748 | 0.1910 | 0.3204 | **0.1765** | 0.3481 |
| 3 / distanceB | 400 | 105.13 | 72.80 | 38.59 | 81.80 | **31.16** |

These are **descriptive comparisons on one ordered holdout**, not a selected winner's unbiased future performance. Dataset 1 weight offers almost no gain over the training-mean baseline; the curve summaries improve forest MAE only by 0.0007 in its recorded weight units. Dataset 3 improves the baseline on both outcomes with at least one fixed model, but the best algorithm differs by outcome. Adding curve summaries can worsen performance, e.g. dataset 3 weight with the forest (0.3204 → 0.3481). The full metric table, including RMSE and target means, is in `results/ordered_holdout.csv`.

## Dataset 2: separate within-run evaluation

The HDF5 file has 829 measured parts in runs 20 (223), 23 (303), and 15 (303). Within **each** run, `cycle_counter` strictly increases. We trained a separate model on the first 70% of each run and tested on the remaining 30%, with the same fixed models and six curve summaries used above. All four measured properties (`weight`, `GE-GE002*`, `GERADEHEIT-L*`, `PT-PT002L*`), run ID, cycle counter, and the `Charge` metadata were excluded from predictors. The latter property has no values for run 15, so no run-15 score exists for it. Columns entirely missing from a run's **training** rows were removed from that run only. This rule drops `Twkz` in runs 15 and 20, and moisture in run 23. The inputs include after-cycle process integrals, so the prediction point remains after the shot.

| Run / outcome | Test n | Training-mean MAE | Scalar Ridge | Scalar forest | Scalar + curves Ridge | Scalar + curves forest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 / weight | 67 | 0.396 | 0.271 | 0.071 | 0.298 | 0.054 |
| 23 / weight | 91 | 0.205 | 0.070 | 0.121 | 0.080 | 0.109 |
| 15 / weight | 91 | 0.888 | 0.101 | 0.149 | 0.100 | 0.156 |
| 20 / GE-GE002* | 67 | **41.82** | 44.96 | 50.30 | 46.32 | 51.30 |
| 23 / GE-GE002* | 91 | 111.68 | 17.10 | 27.43 | 17.11 | 24.88 |
| 15 / GE-GE002* | 91 | 74.45 | 46.31 | 31.76 | 32.20 | 30.01 |

The five other run/outcome combinations and all RMSEs are in `results/dataset2_within_run.csv`. In run 20, the GE-GE002* outcome **fails** to beat the mean baseline with either fixed model or feature set. The curve summaries are not a uniformly useful upgrade. The large improvement for some weight outcomes may partly reflect deliberately induced process changes in this research dataset; none of these results estimates natural factory operation. Across-run transfer and calendar-period generalization remain untested. Selecting the lowest entry in any row after viewing the test outcomes would overstate the evidence.

## Reproduce

```bash
git clone https://github.com/sc4t1m/scatimdata.git /tmp/scatimdata
python experiments/scatim-external-20260926/run.py --data-dir /tmp/scatimdata
python -m pip install h5py  # only needed for dataset 2
python experiments/scatim-external-20260926/run_dataset2.py --data-dir /tmp/scatimdata
```

Use archive hashes in both `results/audit.json` and `results/dataset2_audit.json` to establish that the source files match this run. Requires pandas, NumPy, and scikit-learn; dataset 2 additionally requires h5py. Versions are recorded in the audits. Raw third-party data are kept outside FabGuard.

## Interpretation and next evidence

The data source demonstrates that ordered external manufacturing evaluations can produce mixed outcomes, including failed targets. It has no per-part binary defect label equivalent to KAMP `PassOrFail`, no verified post-2020 KAMP observations, and no independent live deployment test. The source paper describes intentionally changed process conditions; split drift could therefore reflect experiment design as well as natural production change. Before a deployable claim, obtain a later period from the same KAMP line with independently verified defects or collect prospective on-site observations under a frozen model and inspection rule.
