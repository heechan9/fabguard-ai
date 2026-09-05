# FabGuard AI — International Review and Collaboration Brief

FabGuard AI is a leakage-aware decision-support prototype for prioritising semiconductor production records for human review. It uses the public UCI SECOM dataset and is designed to answer a constrained question: when inspection capacity is limited, which records should an engineer review first?

This is an offline portfolio and research prototype. It has not been deployed in a semiconductor fab, does not identify physical root causes from anonymous variables, and does not demonstrate yield, cost or defect-reduction impact.

## What is implemented

- reproducible ingestion and validation for 1,567 production records and 590 anonymous measurements;
- leakage-aware preprocessing fitted within training folds;
- Dummy, L1 Logistic Regression and Random Forest comparisons;
- repeated cross-validation, a later temporal holdout and Top-K review metrics;
- bootstrap uncertainty, calibration and walk-forward checks;
- contract-based export and independent scoring paths for a frozen Train-only model;
- a static web demonstration that keeps the engineer in control of inspection decisions.

## Current evidence

The temporal holdout contains 392 records and 24 failures. Reviewing the highest-risk 10% means inspecting 40 records, in which 5 of the 24 failures were captured. The holdout PR-AUC is 0.0935, while four walk-forward periods range from 0.054 to 0.280.

Random Forest exceeded Logistic Regression in all five repeat-level paired comparisons, with a mean average-precision difference of +0.0382. The exact two-sided sign-flip result is p=0.0625, so the repository does not claim statistical significance at the 5% level or deployment superiority.

All figures above are provisional public-data results. Canonical artifacts and their interpretation boundaries are documented in [`results/v1/RESULTS_SUMMARY.md`](../results/v1/RESULTS_SUMMARY.md), [`PHASE1_ADVANCED_VALIDATION.md`](PHASE1_ADVANCED_VALIDATION.md) and the [experiment contract](../EXPERIMENT_CONTRACT.md).

## Reproduce the review surface

```bash
git clone https://github.com/heechan9/fabguard-ai.git
cd fabguard-ai

PYTHONPATH=src python -m unittest discover -s tests -v
python -m http.server 8000 -d web
```

Then open `http://localhost:8000`. Re-running the complete experiment also requires the official UCI SECOM files; see the [reproducibility guide](../REPRODUCIBILITY.md).

## Focused review requests

Feedback is most useful when it addresses one bounded question and cites a file, test or operational assumption. In particular, the project welcomes review of:

1. **Manufacturing workflow fit** — Are the proposed queue hand-off, identifiers, reason codes and stop conditions realistic for an engineer-led shadow-mode pilot?
2. **Evaluation design** — Are the temporal, imbalance and paired-comparison boundaries clear and defensible without overstating five repeat-level observations?
3. **Data contracts** — Which schema, freshness, traceability or access-control checks would be essential before connecting a non-anonymous manufacturing dataset?
4. **Human factors** — What information would help an engineer accept, reject or escalate a ranked review recommendation without creating automation bias?
5. **Reproducibility** — Can an independent reviewer run the tests, inspect the canonical artifacts and identify any claim that lacks a traceable source?

Please open a [focused GitHub issue](https://github.com/heechan9/fabguard-ai/issues) with the relevant file or evidence boundary. No private production data should be attached or pasted into a public issue.

## Small collaboration entry points

- review one operational document and identify an unrealistic assumption;
- add a synthetic contract or mutation test without changing canonical results;
- propose a public manufacturing dataset suitable for an independent locked evaluation;
- review the two-week, one-line shadow-mode pilot before any site-specific values are filled in;
- reproduce the evidence chain and report a mismatch as a narrowly scoped issue.

The owner, Heechan Choi, led the problem framing, requirements, evaluation choices, result review and repository operation. Detailed human and AI contribution boundaries are recorded in [`CONTRIBUTIONS.md`](../CONTRIBUTIONS.md) and [`AI_USAGE.md`](../AI_USAGE.md).

## Melbourne-oriented objective

The near-term goal is to make this repository useful for conversations with industrial AI, smart-manufacturing and engineering communities in Melbourne before any claim of factory readiness. A successful review should produce concrete technical feedback, a reproducible issue or a small collaboration—not an implied endorsement, partnership or deployment result.

Potential site-specific pilot inputs such as line ownership, engineering roles, service levels, inspection capacity, cost values, data retention and access controls remain intentionally unset until a qualified organisation supplies and approves them.
