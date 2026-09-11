# External data qualification contract

Status: **pre-data checklist; qualification is not model validation**
Fixed: 2026-09-06

This checklist is completed from metadata and data-contract inspection before model scores are
opened. Criteria may be revised only for a future protocol version, never to admit a dataset already
seen under this version.

## Quantitative research-eligibility gate

| Criterion | Fixed rule | If the rule fails |
|---|---:|---|
| Rows | `n >= 500` | exploratory dataset only |
| Positive Fail examples | `n_positive >= 30` | precision/capture inference labelled underpowered |
| Fail prevalence | `0 < prevalence <= 10%` | not evidence for the severe-imbalance RQ |
| Measurement dimensionality | `p >= 50` and `p/n >= 0.10` before Train-fitted filtering | not evidence for the high-dimensional RQ |
| Time evidence | parseable event time for 100% of rows, at least 3 ordered time blocks, and at least 1 positive and 1 negative in every evaluated block | no temporal-generalization claim |
| Labels | complete binary labels with documented decision time and observation window | reject |
| Independence | no row, lot, wafer, time window or derived record used in FabGuard training or selection | reject |

These thresholds define relevance to the research question, not guaranteed statistical power.
Confidence intervals remain mandatory. Near-threshold results are reported exactly; thresholds are
not rounded or relaxed after inspection.
## Evidence categories

### A. Same-domain locked external confirmation

All quantitative rules pass, and all of the following are documented before scoring:

- exact ordered feature contract accepted by the frozen bundle
- compatible physical measurement meaning, units, collection stage and missing-value semantics
- compatible Pass/Fail definition and label-availability timing
- independent provenance and permission for the intended evaluation

Only Category A can test the frozen SECOM-compatible model. Anonymous column-name equality alone is
insufficient evidence of semantic compatibility.

### B. Cross-domain industrial transfer experiment

The quantitative rules may pass, but process semantics or the feature contract differ. Solar-farm,
maritime or other manufacturing data belong here. They require a separately versioned schema,
model and approval. Category B may demonstrate an industrial validation method; it must not be
called semiconductor-fab validation or external confirmation of the SECOM model.

### C. Exploratory or ineligible dataset

One or more mandatory research-eligibility rules fail, provenance is incomplete, or label timing is
ambiguous. The dataset may support pipeline debugging or hypothesis generation, but not a
confirmatory claim.

## Pre-score record

The signed-off qualification record must contain dataset hash, owner, collection site and period,
row/feature/positive counts, prevalence, time-block construction, label timing, semantic/unit map,
independence statement, permission boundary, assigned category and reviewer. Private fab metadata
must remain outside the public repository; the public record may contain a non-sensitive digest.

## Pre-registered result interpretation

For a Category A evaluation, report at minimum:

- AP with a confidence interval and the no-skill baseline equal to observed prevalence
- AP lift, defined as `AP / prevalence`
- Top-5%, Top-10% and Top-20% capture, precision and lift with confidence intervals
- calibration metrics and the fixed 0.5 classification point as secondary diagnostics

There is no universal absolute AP success threshold across different prevalences. Confirmation
requires a pre-evaluation analysis plan specific to the qualified dataset, including the minimum
effect of practical interest and interval-based decision rule. Failure, inconclusive evidence and
harmful ranking must all be publishable outcomes.
