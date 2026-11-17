# Industrial AI validation map: data, context, baseline and failures

This is a mapping to existing contracts, not a new model, approval engine, AAS implementation or field-performance claim. Use the existing [persisted evidence verifier](../verification/recompute_v1.py), [locked evaluation contract](LOCKED_EVALUATION_CONTRACT.md), [locked scoring contract](LOCKED_SCORING_CONTRACT.md), [field evaluation plan](FIELD_RESPONSE_EVALUATION.md) and [test exposure log](TEST_EXPOSURE.md). Do not introduce a second verifier for the same V1 artifacts.

| Research lens | Existing evidence / question | Boundary |
|---|---|---|
| Broken/Bad Data | `results/v1/data_audit.json`, provenance and missingness | Saved audit is not a fresh raw-data inspection |
| Background | What process, time, units and changes does a record describe? | Anonymous SECOM variables do not establish physical sensor meaning or causality |
| Baseline | Same IDs, labels, split, model/policy version and inspection budget | Freeze choices before independent evaluation; do not tune on exposed holdout |
| Domain | Does Fail capture match the intended inspection task? | SECOM Fail is not equipment failure; Top-K is review budget, not a probability threshold |
| Data | Provenance, rights, labels and knowledge available at decision time | Later evidence is not prediction-time evidence |
| Discipline | Recompute results; report failures and uncertainty alongside gains | Integrity checks are not independent field validation |

## Existing baseline, including failures

Stored V1 evidence has AP 0.09347718147533737. At threshold 0.5: TP0, FP0, FN24, TN368. At Top40: 5 of 24 Fail instances captured, **19 missed**, with 35 non-Fail instances selected. Budget-based misses and threshold-based false negatives are different definitions. These are persisted-score calculations, not fresh inference. The result remains **provisional** because of documented test exposure.

The existing verifier checks IDs/labels/timestamps across saved files, finite probabilities, score-descending/ID-ascending ordering, threshold consistency, classification metrics, and all three Top-K rows and their derived fields. It uses explicit errors and works under optimized Python. Source hashes describe input bytes, not authenticity. It cannot detect mutually consistent falsification or prove raw timestamps, sensor meaning, approval identity or production benefit.

Run:

```bash
python verification/recompute_v1.py
python -m unittest discover -s tests -p test_v1_artifact_contract.py -v
```

The regression tests mutate isolated copies only: label, duplicate/swapped rank, score order, timestamp, prediction, nonfinite score, Top-K budget/fraction/missing/duplicate row/precision, and manifest threshold. Each is checked in ordinary and optimized Python. This PR does not change stored V1 results or the verifier.

## Future paired comparison: NOT_RUN

Before comparing a new candidate, freeze the same sample IDs, label rules, cutoff, split/grouping, K, tie policy, baseline/candidate versions and acceptance criteria under the existing locked contracts. Report **newly captured Fail, newly missed Fail, jointly captured/missed Fail, and normal instances newly selected/removed** separately. Do not hide harmful transitions behind a positive net average. Preserve row-level evidence references and each numerator/denominator. Missing labels remain unknown, not normal. Human-review workload, yield, downtime and cost require separate field evidence; all remain NOT_RUN here. There is no new candidate or paired evaluation in this change.

## Research references and scope

- Jay Lee's [2026-10-21 post](https://lnkd.in/p/giTt4mya) uses Three Bs (Broken/Bad Data, Background, Baseline) and Three Ds (Domain, Data, Discipline). This is the author's framing, not a claim about all US industry or a certification standard.
- Lin et al., [AgenticInspect](https://doi.org/10.3390/electronics15204767), Electronics 2026, 15(20), 4767: motivates tracking degraded cases and retaining a fallback. Its 238-image internal validation was preceded by exploration of that dataset; no untouched external test was supplied. It attributes the observed automatic risk-control benefit to learned veto rules, not an independently demonstrated LLM benefit. Its proprietary FIT images and segmentation gains are not transferred to SECOM. Experiment replication: NOT_RUN.
- Li et al., [Data issues in industrial AI systems](https://doi.org/10.1016/j.compind.2025.104361), Computers in Industry 173 (2025), 104361: a data-lifecycle meta-review, not evidence of a FabGuard accuracy improvement.
