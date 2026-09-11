# Related-work position and comparison rules

Status: **verified starting set; not a systematic review**
Reviewed: 2026-09-06

## Source discipline

Only an original dataset page or a paper inspected at its publisher/full-text record is listed.
Reported metrics are not compared numerically unless data version, split, preprocessing boundary,
positive label and metric definition are compatible. Accuracy, geometric mean, F1, ROC-AUC and AP
are not interchangeable.

## Verified starting set

1. McCann and Johnston, **SECOM**, UCI Machine Learning Repository (2008), DOI
   [10.24432/C54305](https://doi.org/10.24432/C54305). This is FabGuard's dataset source: 1,567
   examples, anonymous measurements, timestamps, missing values and Pass/Fail labels.
2. Park et al., **Study on Data Preprocessing for Machine Learning Based on Semiconductor
   Manufacturing Processes** (Sensors, 2024), full text at
   [PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC11398254/). The paper studies SECOM
   preprocessing combinations including missing-data handling, scaling, resampling and feature
   reduction. Its reported accuracy/GM and experimental split are not direct FabGuard AP or
   temporal-holdout comparators.
3. Salem et al., **An Experimental Evaluation of Fault Diagnosis from Imbalanced and Incomplete
   Data for Smart Semiconductor Manufacturing** (Big Data and Cognitive Computing, 2018),
   [publisher record](https://doi.org/10.3390/bdcc2040030). It evaluates fault diagnosis on SECOM
   under imbalance and incompleteness. Compatibility must be checked at the split, preprocessing
   and metric level before any numerical comparison.
4. Zhou et al., **Quantile Online Learning for Semiconductor Failure Analysis** (2023),
   [arXiv:2303.07062](https://arxiv.org/abs/2303.07062). It frames online/single-pass adaptation and
   includes SECOM among multiple datasets. It addresses a different online-learning question; it
   does not by itself validate FabGuard's offline frozen ranking protocol.

No `Patel 2026` study is cited: a sufficiently identified original paper and a compatible protocol
were not verified for this review.

## FabGuard's position

Much SECOM work asks which preprocessing or classifier improves classification metrics. FabGuard
instead foregrounds a constrained and auditable evaluation process: Train-fitted preprocessing,
an exposed-test record, time-ordered evaluation, AP plus budget-based Top-K ranking, uncertainty,
paired repeat-level inference, immutable artifacts, and a locked external-evaluation gate.

The contribution is therefore evaluation and decision-governance design, not a novel learning
algorithm, a state-of-the-art score, physical root-cause discovery, or measured factory impact.

## Comparison checklist for future citations

Before placing another study in a performance table, record:

- exact SECOM file/version and label encoding
- random, stratified, temporal or otherwise grouped split
- whether imputation, resampling and feature selection were fit inside training folds
- validation-unit independence and repeated-run aggregation
- positive-class prevalence in the evaluated set
- exact metric implementation and uncertainty interval
- whether a final holdout was used once or repeatedly exposed

If any item is unknown, describe the study qualitatively and mark direct comparison as unavailable.
