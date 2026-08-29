# FabGuard AI V1 Results Summary

Status: **Provisional** - see `docs/TEST_EXPOSURE.md`.

## Decision result

Train-only 5×5 repeated CV selected `random_forest_depth_none_leaf_8` by mean Average Precision. Its CV AP was `0.2155 ± 0.0650`. On the later temporal holdout, AP fell to `0.0935`.

At the untuned 0.5 threshold the selected model produced TP=0, FP=0, FN=24, TN=368. The classifier therefore does not support an operational Fail/no-Fail claim.

## Constrained inspection result

With a Top-10% inspection budget, the model ranked 40 of 392 production instances for review and captured 5 of 24 Fail instances (20.8%). Precision was 12.5% and lift over the holdout prevalence was 2.04×.

## Interpretation

The experiment found temporal degradation and weak but non-zero ranking signal. FabGuard V1 is best presented as a reproducible risk-prioritization study that exposes the limits of deploying a model trained on an earlier manufacturing period, not as a proven yield-improvement or root-cause system.

## Non-claims

- Anonymous variables are not interpreted as physical sensors or causal factors.
- No actual yield, cost, downtime, FDC, APC, or SPC improvement was demonstrated.
- The holdout is not pristine after the documented engineering smoke exposure.
