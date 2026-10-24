# Robot sort cell and review preparation — 2026-10-24

Base main: 917f14ff50db9d3941a007620e3fa4f35cc1f43e. Draft implementation only; no merge or production deployment.

## Synthetic 3D scope

Add a separate R-01 concept robot beside the final-inspection NG buffer. Existing mounter heads, 11 station indices, timings, seed, thresholds and exported snapshot schema are preserved. Robot pose is derived from each board's stage/progress; it has no independent clock. Pick → transport → placement follows the existing playback/pause/reset. Existing synthetic AOI routes NG to the red tray, OK to the normal tray, and missing measurement with OK to a review tray. This does not decide actual quality. Labels and an accessible Enter-selectable button explain the role and link to the separate vibration/SPC page. No school equipment, sensor detector, robot controller, physics or inverse-kinematics validation is claimed. Intro still uses its own synthetic run.

Reduced-motion preference pauses initial autoplay and reset and pauses when enabled during use. Explicit Play remains available. The robot does not animate independently while the simulation is paused.

The isolated CI test driver Playwright 1.62.1 and Noto CJK fonts are test-environment-only, not product dependencies. Reason: verify actual WebGL rendering, updated geometry, keyboard controls and narrow layouts with an already installed Chrome. Software rendering uses SwiftShader in the test runner. Server binds only 127.0.0.1; page external requests are blocked. No browser download or public access link is required. CI browser execution and visual review are pending until a concrete run is inspected.

## PR cleanup recommendations (no action taken)

- #159: sole changed tests/test_results_contract.py blob 5c6e9ec2acd8d7a707b07438375bb4eeb0e9ed1f equals latest main. Recommend close as already incorporated, subject to owner approval.
- #156 (310a7bbc) vs #160 (3d5305d7): all 6 changed path/blob pairs equal. Recommend #156 as canonical feature proposal; #160 is duplicate code, not an independent audit. Exact-head CI runs 39889151732 and 39891556302 both succeeded historically. #156's Claude request ended in error at run 39889577332. #160 has Jules greeting/duplicate PR body but no substantive audit findings; owner comment 6356121551 explicitly asks for read-only findings and says the duplicate will not be merged. Neither green CI nor the audit title establishes independent review. Browser file-selection E2E and latest-main equipment integration remain pending. Preserve comments before any future approved closure.
- #164 → #168 is a design relationship, not a Git stack: #168 is independently based on main. Design proposes raw-sensor checks and eventual offline ranking; #168 implements only label-free 42-feature input/manifest/condition gates, always abstains with null score/rank, and uses synthetic manifests. Do not report the whole #164 plan complete. Reconcile vocabulary/precedence, real artifact/training-membership binding, raw quality and synchronization, and stale #162/#163 status text before any integration.
- #165 → #167 is a real stack: #167 base SHA equals #165 head 4eda7765. Review international plan first, then locked-evaluation contract; preserve common README/docs index/collaboration edits. Both contain historical pre-comparison statements superseded by #171 and the later actual SPC run; keep these as history and update current conclusions. #167 remains an unapproved contract with required owner/custodian/sample-size/endpoint fields unset.
- #169–#172 remain separate research/audit records, not closure candidates merely because main now has web summaries. #169 uses 4fold/14 failures and #170 uses 3 datefold/61 failures; do not combine results. #171 is file-comparison evidence, #172 synthetic SPC, neither proves field detection. Their original executors/reports are not included just by publishing a summary page.

## SPC preparation and checks

Executed without new measurements: Node web tests (including 3 new robot trajectory/routing/pause tests) 115/115; Python robot window/config/fail-closed/range-receipt tests 68/68. These check input, math and state contracts, not real anomaly performance. No old test-set tuning, new model, threshold search or new real-source SPC run was performed.

Current real-source development result remains normal 2 evaluation recording groups/7 files/1,043 windows/52.15 seconds: Shewhart 9, EWMA 0, CUSUM 3. This is exploratory alarm activity, not false-alarm rate or method superiority. Delay, recall, miss rate and false-alarm rate remain null. Whole-archive hash, physical phone and screen-reader behaviour remain unverified.

Before independent SPC evaluation, obtain new physically independent normal continuous sessions and fault episodes with pre-event normal exposure, operating conditions and independently adjudicated onset/end intervals. Use session/run/setup/fault-episode groups, never randomly split windows. Keep existing exposed IMAD tests excluded from independent confirmation. Decide before test access whether to evaluate the exact frozen reference/3-3-4 thresholds or a separately declared recalibrated method. Reference fitting and calibration may use only their assigned new normal groups; final normal/anomaly groups and labels are held out. Freeze source hashes, code/environment, units/cadence/window/gap policy, lambda/k, state-reset/episode rules, threshold selection, event matching, acceptable delay D and endpoints before results.

Primary endpoint proposal: fraction of eligible independent labeled events detected within predeclared D; also report misses, undetected events, onset uncertainty, delay distribution and stable-normal alarm episodes per valid hour, with full input/withheld accounting and group-level uncertainty. D, useful effect, acceptable alarm burden and final sample size need domain/custodian decisions; do not fill them from current results. New recordings/independent onset labels are required. Existing synthetic faults and 3D scenes cannot substitute. Existing Drive report contains the detailed A/B protocol and data needs; no outreach or data collection is authorised by this document alone.

## Next three actions

1. Review this Draft's actual 3D screenshots and input/state checks, separate from detector performance.
2. Approve PR cleanup list before closing/merging anything; canonical replay candidate #156 still needs independent functional verification.
3. Agree data custodian, independent normal/anomaly availability and a frozen SPC contract before any final test access.
