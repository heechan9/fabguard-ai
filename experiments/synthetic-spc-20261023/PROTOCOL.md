# Frozen proposal: synthetic Shewhart / EWMA / two-sided CUSUM

Status: PROPOSED, NOT EXECUTED. No results or performance claims.
Date: 2026-10-23. Base main: cd7bf490a1d7ad3e53c77ea198e323b9d95c7ff3.
This file must be committed before evaluation; branch creation is currently blocked.

## Scope and duplicate check
Fresh clone in the assigned task-3 workspace. Latest cloned main and all 14 open
PRs were checked on 2026-10-23. No matching EWMA/CUSUM comparison was found.
PRs #168 (robot abstention), #169/#170 (SECOM preprocessing), and #156
(equipment SPC replay) are separate. No existing dataset, final test set, robot
model/gate, canonical result, web file or lecture PDF is used or modified.

## Predeclared design
Use Python standard library only, an isolated module and synthetic unit tests.
One observation per integer time tick; individual observations (subgroup n=1).
Use independent random.Random streams, seeds 0..49 for final evaluation;
training seed 10000+s, calibration seed 20000+s, evaluation seed 30000+s.
For each seed, fit mean and sample standard deviation (ddof=1) on 2,000
independent N(0,1) stable reference observations. Reject fewer than two valid
observations, all missing, zero or nonfinite variance; report reference failure.
Missing/invalid reference values are counted explicitly and excluded from fitting.
No evaluation values or outcomes can alter center, scale, parameters or thresholds.

Fixed standardized statistics (z=(x-mean)/sd):
- Shewhart: abs(z).
- EWMA: e_t=.2*z_t+.8*e_previous, initialized at zero; statistic
  abs(e_t)/sqrt(.2/(2-.2)). Use steady-state limits, including startup;
  this conservative startup convention is disclosed, not finite-time limits.
- Two-sided tabular CUSUM: upper=max(0,upper+z-.5),
  lower=max(0,lower-z-.5); statistic max(upper,lower); initialize both zero.
All comparisons are strict > threshold. All detectors reset after every alarm.
Invalid tick: output invalid/unknown (never normal), count it, reset detector
memory, retain original tick index. No interpolation, deletion of time ticks,
forward-fill or concatenation across gaps. No extra alarm cooldown.

To compare with a common *empirical calibration constraint*, for each detector
and seed choose the smallest passing threshold from a fixed grid on a separate
stable calibration stream of 20,000 N(0,1) ticks. Grids: Shewhart 2.5..5.0 step
.1; EWMA 2.5..5.0 step .1; CUSUM 3.0..15.0 step .5. Passing means <=20 alarms
per 20,000 ticks, under the exact reset rule. If no grid value passes, mark the
configuration unavailable (do not expand grid or inspect evaluation to choose).
This does not guarantee equal future false-alarm rates or common ARL. Report
selected thresholds and observed calibration/evaluation alarm rates separately.
No optimization of lambda/k, seed selection or scenario-specific configuration.

Evaluation: same noise realization across methods and paired scenarios per seed;
600 ticks, onset index 200. Scenarios: normal; positive and negative abrupt
1-sigma shift from onset; positive and negative ramp increasing from 0 at onset
to +/-1 sigma at index 399 and staying there; normal with invalid inputs; positive
abrupt shift with invalid inputs. Invalid pattern: indices divisible by 17 become
None, by 53 NaN, by 97 infinity (last rule wins), and 190..209 all None. These
are source-level invalids; string/bool handling is covered by unit tests.

Metrics: alarms per valid normal/pre-onset observation and per original tick;
any-false-alarm proportion across seeds; alarm count; invalid count and valid
coverage; first post-onset detection delay in original ticks (0 means onset),
undetected fraction over all available seeds. Delay is conditional on detection;
report number detected and median/IQR, never replace missing detection with zero.
No-change scenarios have detection delay/miss rate not applicable, not zero.
Pre-onset alarms reset normally; no oracle reset at change onset.
Report all seeds, all scenarios and failed calibration/reference fits.
Save configuration, per-seed rows, aggregate results, Python/platform version,
base/code/protocol commit IDs and SHA-256 of canonical generated series/config.
Repeat frozen run and verify byte-identical scientific outputs (separate runtime
metadata if platform details differ). No later tuning from observed results.

## Verification and independent review required before Draft PR
Hand-calculated recurrences, sign symmetry, lambda=1 equivalence, strict boundary,
reset-after-alarm, missing-gap reset, preserved indices, all-missing/constant/
singleton reference rejection, malformed/nonfinite/bool input, no-detection
accounting, calibration-only selection, deterministic output, paired noise,
negative shifts, and no existing-data reads. Run isolated tests and appropriate
repository checks without accessing existing final test data. Independent
read-only review should inspect code and rerun synthetic tests. Keep Draft;
no merge, production connection, deployment or real-world improvement claim.

## Definitions and limits
NIST EWMA (accessed 2026-10-23):
https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm
NIST tabular CUSUM (accessed 2026-10-23):
https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc323.htm
The CUSUM equations above use sigma units, matching NIST's tabular form.
The existing main search found no EWMA/CUSUM implementation to reuse; equipment
SPC/replay is separate. Final implementation review must verify existing
Shewhart code semantics and cite its exact file/lines before claiming equivalence.
Lecture page 7 is user-described background; the PDF was not inspected/copied.
IID Gaussian synthetic assumptions exclude autocorrelation, equipment/lot groups,
non-Gaussian tails and physical failure labels. Empirical threshold calibration
is finite and noisy. Fifty seeds do not establish industrial false-alarm control.
Missing-gap resets lose accumulated evidence. These are algorithm-behavior
experiments, not robot/manufacturing performance or causal process validation.

## Pre-execution clarification (no outcomes observed)
Git metadata is read-only locally; freeze this protocol through a remote GitHub
commit before evaluation. Python 3.14.6 was found and ran successfully using the
actual installation, without changing permissions. Existing src/fabguard/spc.py
individuals_report uses mean moving range / 1.128, three-sigma limits, rejects
missing reference values and can require baseline review. This experiment uses
sample SD on IID synthetic reference data and does NOT reproduce that production
screening function or its baseline-review rule. No equivalence claim is made.
Canonical invalid values are encoded as explicit strings only when hashing JSON;
the monitoring function receives actual None/NaN/infinity and treats all unknown.
Quantiles use statistics.quantiles(..., method='inclusive'); one detection has
identical quartiles. Rates pooled over seeds use summed numerator/denominator.

