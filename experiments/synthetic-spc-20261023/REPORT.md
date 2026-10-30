# Synthetic SPC comparison: executed development experiment

Fifty fixed seeds; 150 independently calibrated detector configurations; 1,050 scenario/method/seed rows. All reference fits and calibrations were available. No real process data, robot inputs, existing final test sets or lecture PDFs were read.

## Results

Normal evaluation false alarms per 1,000 valid observations: Shewhart 0.9333 (28/30,000), EWMA 1.1667 (35/30,000), CUSUM 0.8000 (24/30,000). Fractions of normal streams with at least one false alarm: 40%, 46%, 40%. A common calibration cap is not equal achieved false-alarm rate, ARL, or a formal statistical guarantee.

First detection delay is measured in original ticks from onset (index 200). Delay quantiles are conditional on detection; missed streams remain in the miss-rate denominator. Each changed scenario has 50 seeds.

| Scenario | Method | Detected | Median delay [Q1, Q3] | Miss rate | Valid coverage |
|---|---|---:|---|---:|---:|
| step_up | shewhart | 50/50 | 63.0 [12.0, 117.5] | 0% | 100.00% |
| step_up | ewma | 50/50 | 8.5 [5.0, 13.75] | 0% | 100.00% |
| step_up | cusum | 50/50 | 8.5 [5.0, 12.75] | 0% | 100.00% |
| step_down | shewhart | 50/50 | 77.0 [23.25, 147.5] | 0% | 100.00% |
| step_down | ewma | 50/50 | 11.0 [6.0, 14.75] | 0% | 100.00% |
| step_down | cusum | 50/50 | 9.5 [6.25, 14.0] | 0% | 100.00% |
| ramp_up | shewhart | 50/50 | 187.5 [132.0, 237.5] | 0% | 100.00% |
| ramp_up | ewma | 50/50 | 111.0 [84.25, 133.0] | 0% | 100.00% |
| ramp_up | cusum | 50/50 | 105.5 [78.0, 116.0] | 0% | 100.00% |
| ramp_down | shewhart | 47/50 | 195 [154.0, 235.5] | 6% | 100.00% |
| ramp_down | ewma | 50/50 | 104.5 [86.0, 125.5] | 0% | 100.00% |
| ramp_down | cusum | 50/50 | 99.0 [87.25, 125.5] | 0% | 100.00% |
| step_up_invalid | shewhart | 49/50 | 104 [45.0, 131.0] | 2% | 88.17% |
| step_up_invalid | ewma | 50/50 | 28.0 [19.0, 34.0] | 0% | 88.17% |
| step_up_invalid | cusum | 50/50 | 32.0 [26.0, 35.0] | 0% | 88.17% |

The tested +1 sigma step produced median delays of 63, 8.5 and 8.5 ticks for Shewhart, EWMA and CUSUM. The negative ramp was missed by Shewhart in 3/50 streams. Under the fixed invalid-input pattern, +1 sigma step medians rose to 104, 28 and 32 ticks; Shewhart missed 1/50. This illustrates loss of accumulated evidence and unavailable time across gaps; invalid ticks were never declared normal.

For normal-with-invalid streams (529 valid ticks out of 600 per seed), false alarms were 26/26,450, 21/26,450, and 7/26,450 valid observations. Decreased alarm counts after memory resets do not establish improved safety. Every scenario and seed is retained in results.json, including pre-onset false alarms and undetected cases.

Calibration used only separate 20,000-tick stable streams with <=20 alarms under the same reset rule, choosing the first passing member of a fixed grid. Selected threshold ranges: Shewhart 3.2-3.5, EWMA 3.0-3.4, CUSUM 5.5-7.0. No evaluation-guided parameter changes were made.

## Reproduction and provenance

From repository root (Python standard library only):

```text
python -m unittest discover -s experiments/synthetic-spc-20261023 -p test_study.py -v
python experiments/synthetic-spc-20261023/study.py
```

Python 3.14.6, Windows. See environment.json for source/protocol SHA-256. Input series are regenerated from recorded seeds; only their canonical digest and derived scientific results are published.

- Base main: cd7bf490a1d7ad3e53c77ea198e323b9d95c7ff3.
- Protocol committed before evaluation: f02ab17038389595b60d2279afb590d405d34c09.
- Initial tested implementation frozen before evaluation: 289e85d738adf677f276529cad5bc278641e3d48.
- Independent-review fix: 50ad599f254396030ab61127e2da16250f254217 adds explicit reference total/valid/invalid metadata and a regression. It does not change detectors, thresholds, inputs, or metrics. Corrected implementation was rerun. Early remote source commits normalize line endings; final publication retains the exact tested local source text.
- PROTOCOL.md retains its historical initial blocked/unexecuted heading. Later authorized GitHub API commits resolved remote publication; local Git metadata remained read-only. No permission changes or alternate checkout were used.
- Canonical generated-input SHA-256: 89d52b3808ecab12c75bc1abb26178672e04153e80442851565eef6ced3c335b.
- Configuration SHA-256: 8cfdcd9364e3d68839e0705ee597ed32bcba71ae6b830450ba05b72ab790de5a.

## Checks and independent review

17 synthetic experiment tests passed; 6 existing SPC tests passed. Independent read-only review reran the 17 experiment tests and manually exercised all-missing reference accounting. No remaining must-fix finding in its scope. The reviewer did not independently regenerate the full 50-seed experiment. Full repository tests were not run, to avoid unrelated existing-data evaluation; no production files changed. Tracked-file git diff --check passed; final added source text was separately checked for trailing whitespace.

## Boundaries

This is IID Gaussian, individual-observation synthetic algorithm behavior. It does not establish robot/manufacturing performance, product quality, causal fault detection, or deployment readiness. Fifty seeds and finite calibration yield noisy operating characteristics; no formal uncertainty interval or superiority test was predeclared. Multiple scenarios share paired noise and are not independent repetitions. Conditional delays can be biased by non-detection, so misses are always reported. First post-onset alarm is a timing metric, not proof that a particular alarm was caused by the injected shift.

Center and sample SD are learned only on stable reference prefixes. Reference invalids are explicitly counted and excluded; <2 finite values, zero/nonfinite variance are rejected. Evaluation None/NaN/infinity/malformed inputs yield unknown and reset memory without deleting a tick. EWMA uses fixed steady-state limits, making startup conservative.

Existing src/fabguard/spc.py:individuals_report uses mean moving range / 1.128, stricter reference missingness and baseline-review gating; this sample-SD experiment is a separate comparison and does not change or reproduce that production screening contract. No actual production function is imported. No new dependencies, model, input gate, canonical result, web change, merge or manual deployment.

NIST official definitions (reviewed before execution): [EWMA](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm), [two-sided tabular CUSUM](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc323.htm). Lecture page 7 was user-described motivation; the original PDF was not inspected or copied.

Codex prepared implementation, tests and report at the owner's request. Publication through the owner's account does not imply human code authorship. Keep Draft for review; no merge or operational promotion is requested.

## Deterministic rerun
The corrected frozen study was executed twice. Both results.json files were
byte-identical: SHA-256 84062a017e85e82c142af5a5406534f4baa86b668777811a216d4b4e2d896c27.
REPRODUCIBILITY.json records this check and test counts. Independent final review
recomputed all summary fields from 1,050 per-seed rows and checked all 15 report
table rows, calibration budgets, threshold ranges and hashes. It did not rerun
the full experiment. Seven public deliverables exclude local access logs,
local rerun copies, generated helper scripts, bytecode and personal paths.
