# Robot sort cell and review preparation — 2026-10-24

Base main: 917f14ff50db9d3941a007620e3fa4f35cc1f43e. Draft implementation only; no merge or production deployment.

## Synthetic 3D scope

Add a separate R-01 concept robot beside the final-inspection NG buffer. Existing mounter heads, 11 station indices, timings, seed, thresholds and exported snapshot schema are preserved. Robot pose is derived from each board's stage/progress; it has no independent clock. Pick → transport → placement follows the existing playback/pause/reset. Existing synthetic AOI routes NG to the red tray, OK to the normal tray, and missing measurement with OK to a review tray. This does not decide actual quality. Labels and an accessible Enter-selectable button explain the role and link to the separate vibration/SPC page. No school equipment, sensor detector, robot controller, physics or inverse-kinematics validation is claimed. Intro still uses its own synthetic run.

Reduced-motion preference pauses initial autoplay and reset and pauses when enabled during use. Explicit Play remains available. The robot does not animate independently while the simulation is paused.

The isolated CI test driver Playwright 1.62.1 and Noto CJK fonts are test-environment-only, not product dependencies. Reason: verify actual WebGL rendering, updated geometry, keyboard controls and narrow layouts with an already installed Chrome. Software rendering uses SwiftShader in the test runner. Server binds only 127.0.0.1; page external requests are blocked. No browser download or public access link is required. Actual browser execution and visual review are complete for the exact UI commit recorded below.

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

## Data and environment boundary

| Work | Available now | Needed before confirmation |
|---|---|---|
| Input validity, units, finite values, cadence/gap/duplicate checks, RMS/window/SPC math, state and range guards | 68 Python tests executed; no new measurements | These cannot estimate field detection performance |
| Synthetic routing, trajectory, playback/reset and export compatibility | 115 Node tests executed; actual WebGL checks recorded separately | Synthetic rules cannot supply anomaly labels |
| Stable-normal alarm burden | Current exposed development run is exploratory only | Independent normal continuous sessions, condition/transition labels and measured valid exposure |
| Event recall, misses and delay | All performance metrics remain null | Independent fault episodes, pre-event normal data, onset/end interval labels and adjudication, grouped blind test |
| Full archive integrity | Previously selected member CRC/size/hash receipts only | Entire archive bytes and expected archive digest; no new fault collection necessarily required |
| Physical accessibility and hardware | Browser viewport/media emulation only | Real phones, screen readers and hardware/physics testing |

Minimum new recording manifest: source/session/run/setup IDs; acquisition time; equipment/sensor identity and mounting/orientation; units, cadence and raw timestamp policy; operating speed/load/recipe and transitions; anomaly type/severity; independently adjudicated onset/end intervals and uncertainty; missing/dropout/reset flags; checksums and provenance; split role and leakage group. Anomaly windows from one physical episode must not cross partitions.

Freeze the selected evaluation variant, manifest/split hashes and code/environment before opening blind labels. For the frozen-transfer variant keep the existing reference and 3/3/4 thresholds; any new-normal recalibration is a separate declared method with reference/calibration groups excluded from the final test. Freeze delay D, episode merging/state reset, event matching and valid exposure denominators before results. Primary proposed endpoint is event recall within D; secondary endpoints are missed events, delay with undetected events retained, and alarm episodes per stable-normal valid hour, with group-level uncertainty. Owner/custodian, practical acceptance limits, D and sample size remain decisions to resolve before testing, not values to infer from exposed data.

## Executed browser verification

Tested UI/harness commit: `175326a078066765d7036e287fe31711f7f376e5`. Browser workflow [40102027379](https://github.com/heechan9/fabguard-ai/actions/runs/40102027379): all 3 jobs successful. General CI at this head [40102031864](https://github.com/heechan9/fabguard-ai/actions/runs/40102031864) successful. Later evidence-only commits do not change this UI or driver.

| Browser viewport | Actual WebGL | Behaviour, keyboard, reduced motion | Document overflow |
|---|---|---|---|
| 1366 × 900 | pass | pass | none |
| 390 × 900 | pass | pass | none |
| 360 × 900 | pass | pass | none |

Chrome 155.0.8059.39, preinstalled GitHub ubuntu-24.04 runner, SwiftShader; isolated Playwright 1.62.1. Controls were activated with Enter, and robot selection → analysis link was traversed with Tab. Assertions cover initial/reset reduced-motion pause, explicit play, robot selection/name/explanation/link, pick/transfer/normal placement/NG placement, paused pose, all 12 boards completed and export enabled, reset, camera, intro dialog and separate inspection controls. Changing from no-preference to reduce during playback is also asserted after its media-query event. This is viewport emulation, not a physical-phone or screen-reader test. Intro/inspection availability is a smoke check, not full codec or every separate scenario verification.

The test controls browser timestamps, not product state: each small clock advance still enters the existing requestAnimationFrame loop and Simulation.advance; screenshots resume browser rendering with the simulation paused. No test-only state API or product threshold change was added. Capture uses ordinary scroll below the fixed header; it does not hide UI elements.

Manual visual review: PC initial/pick/transfer/place/description, 390 initial, 360 description/NG. New in-scene name was shortened after the original long English suffix exceeded the label canvas. Actual 360/390 overflow failure at `50fb2b68` was fixed by scoping the experience map away from inherited global horizontal-nav rules; the exact same no-overflow assertion passes after `d0a28e22`. Earlier attempts also had harness timing failures: long software-rendered runFor execution, NG observation before a throttled label refresh, clock pause deadline latency and reading a media-query change before the event. Their failed/partial runs are historical, not final passes; assertions were retained, and event/frame scheduling was corrected.

Reproduction commands and all 18 PNG hashes, the 3 original artifact ZIP digests, result payloads and scope are in ROBOT_SORT_CELL_UI_20261024.json. The locally executed final-product tree at `d0a28e22` again passed Node 115/115 and Python 68/68 (1.927 seconds; no skips). Only the verification driver and evidence changed afterward.

Evidence bundle SHA-256: `584ac40960700d1d49418a03a3dd648980d9dd1925df86d399c048b643f0f105`.

- [All captures, results and manifest](https://drive.google.com/file/d/18kLjXaR2h6y1EVTtZjPhMY9Xp2_qo0Ce/view?usp=drivesdk)
- [PC placement capture](https://drive.google.com/file/d/1W4LmhYOSSSShT6dHCgYAMmmfyjmRYsgz/view?usp=drivesdk)
- [360-width explanation capture](https://drive.google.com/file/d/19OIjIxTEDdn99Vj3T9eom2VCxtSjA6w7/view?usp=drivesdk)

3D demonstration: implemented and verified within this scope, still Draft. Actual-data anomaly detection: unverified; normal-development 9/0/3 remains exploratory and performance metrics remain null. No existing PR was closed/merged; main and production deployment were not changed.
