# Same-sample inspection selection summary

`fabguard.inspection_selection.summarize_inspection_selection(baseline_raw, candidate_raw=None)`
reuses `compare_capture_transitions` without changing its schema, ranking, label rules,
input bounds, exact decimal ordering, or fixed-budget comparison contract.
No additional dependencies, training, threshold selection, equipment operations, or UI wiring.

## Why this exists

A manufacturing teaching scenario motivated a narrower distinction: reducing the number
of normal samples recommended for inspection does not alone show a better detector.
Missed Fail samples and unknown labels must remain visible. This implementation is an
inspection-budget summary, **not a battery X-ray classifier or a causal diagnosis**.
The source lecture and its illustrations are not redistributed here.

## Meaning of the fields

For baseline and candidate separately:
- `selected_counts` and `unselected_counts` preserve fail, normal, and unknown groups.
- `normal_selection_fraction` = selected known-normal / all known-normal samples.
- `fail_unselected_fraction` = unselected known-Fail / all known-Fail samples.
- Each fraction carries numerator, denominator, and value. Denominator zero returns
  `value: null`, never zero performance. Unknown labels enter neither denominator.

These are fractions within the **submitted population**, not population estimates and
not conventional classifier false-positive/false-negative rates. Top-K means a recommendation
for limited inspection, not an automatic defective-product verdict. The output therefore
sets `detector_error_rates.status` to `NOT_COMPUTED`. Detector error rates require separately
specified verdicts and a fixed decision rule, which this API does not accept or infer.

The original full transition report is retained under `evidence`: in particular, newly
captured Fail and newly unselected Fail IDs cannot cancel out in a net-improvement number.
Input SHA256 values, declared context, and limitations remain visible. No candidate gives
`NOT_RUN` and no numeric `selection_summary`. Every result remains `WITHHELD` and
`independent_evaluation: false`. Exceptions from the existing contract propagate; the wrapper
does not silently drop inconsistent samples or convert a failed comparison into zero rates.

## Verification and use boundaries

All new tests use fixed **synthetic** scores/labels/IDs. They contain no measurements from
battery inspection, no reported lecture performance, and no real holdout evaluation.
The regressions cover harmful changes despite reduced normal selection, offsetting Fail
transitions, zero denominators, unknown-only data, absent candidates, changed population/
labels/times/splits/budget, input reordering, and population/count conservation.

```
PYTHONPATH=src python -B -m unittest discover -s tests -p test_inspection_selection.py -v
PYTHONPATH=src python -O -B -m unittest discover -s tests -p test_inspection_selection.py -v
PYTHONPATH=src python -B -m unittest discover -s tests -p test_capture_transitions.py -v
```

This is a pure function and regression-tested summary, not a web-deployed feature. Running
synthetic regressions does not establish model improvement, authentic labels, clean holdout,
factory validation, reduced inspection costs, or safe equipment-control settings.
The underlying declarations remain unauthenticated; identical false declarations can pass.
Actual historic artifacts must not receive invented timezone/label-availability metadata
just to fit this contract. It does not connect or replace the held/eligible policy adapter.
