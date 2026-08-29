# Test Holdout Exposure Log

## 2026-08-29 - Engineering smoke run

The official 392-row temporal holdout was evaluated during a one-repeat, five-fold engineering smoke run before the planned 5×5 repeated-CV execution.

- Purpose: verify that the end-to-end implementation generated every contracted artifact.
- Deviation: the experiment contract specified 5×5 repeated stratified CV before the final test opening; the smoke run used 5×1.
- Observed after the run: model-level test metrics and Top-K results.
- Changes after exposure: timestamp parser correction had already been completed; only scikit-learn L1 API compatibility and documentation were changed. Candidate grids, split, ranking metric, preprocessing rules, Top-K fractions, and model-selection rule were not changed in response to test performance.
- Consequence: the locked 5×5 rerun is useful and reproducible but its temporal holdout must be labeled **provisional**, not a pristine confirmatory result.
- Clean confirmation path: evaluate the frozen pipeline on a genuinely independent manufacturing dataset or a separately designed future-period dataset. Re-splitting SECOM after seeing labels would not restore independence.

This log must remain with all V1 result bundles and reports.
