# Graduate research question and claim boundary

Status: **pre-registered framing; V1 remains frozen**
Fixed: 2026-09-06

## Research question

> Under small-sample semiconductor manufacturing data with severe class imbalance and temporal
> variation, does a Random Forest provide a stable improvement over regularized Logistic
> Regression in pre-declared risk-ranking performance?

The question concerns a comparison under the FabGuard protocol. It does not ask whether either
model is production-ready or whether one model is universally superior.

## Hypotheses and estimand

- **Primary estimand:** the repeat-level paired difference in Average Precision (AP), Random
  Forest minus Logistic Regression, using the same Train-only repeated-CV splits.
- **Null hypothesis:** the repeat-level paired AP difference is centred at zero.
- **Directional research hypothesis:** Random Forest has a positive repeat-level paired AP
  difference.
- **Primary inference:** a two-sided exact sign-flip test at `alpha=0.05`, reported with the five
  repeat-level differences and their mean. The two-sided rule is retained to avoid converting the
  observed direction into a post-hoc one-sided test.

AP is the primary statistical endpoint. Top-10% fail capture and lift are operational secondary
endpoints; they must not be substituted for AP when interpreting the existing `p=0.0625` result.
Top-5% and Top-20% remain sensitivity descriptions.

## Existing answer from V1/Phase 1

Random Forest won all five repeat-level AP comparisons and the mean paired difference was
`+0.0381646`, but the two-sided exact p-value was `0.0625`. Therefore, the observed AP advantage
was **not statistically established at alpha 0.05** under this protocol.

This result does not prove equivalence, no effect, or Logistic Regression superiority. With only
five repeat-level units and few Fail examples per fold, low power and wide uncertainty remain
plausible. The exposed V1 temporal holdout is descriptive evidence only and must not be reused for
model selection, hypothesis refinement, or a fresh confirmatory test.

## Contribution

FabGuard's intended contribution is a reviewable decision-support evaluation: leakage-aware
preprocessing, a frozen temporal boundary, paired Train-only comparisons, budget-based ranking,
immutable evidence, and explicit non-claims. Model novelty and high predictive performance are not
claimed.

## Falsification and decision rules

- The directional research hypothesis is unsupported if the pre-declared paired test does not
  reject at `alpha=0.05`, even when the observed mean difference is positive.
- A statistically significant AP result would still not establish operational usefulness;
  Top-K uncertainty and an independent compatible dataset would remain necessary.
- A non-significant result must be reported as inconclusive, not as proof of equality.
- No result may establish factory deployment, yield improvement, cost reduction, or causal process
  impact without a separate field design.
