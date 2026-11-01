# Technical handoff: bounded saved-evidence review

**Status:** offline portfolio evidence, not production approval or semiconductor qualification.
Reviewed baseline: `d534d6ef6f9dd819d8d993e51c0eb31402b328be` (2026-10-31).
This handoff was prepared locally on 2026-10-31; the historical baseline SHA does not include it.
Consult the associated PR for subsequent publication and merge status.

## Purpose and role orientation

The primary learning target is Central Product Integration (CPI): communicate test/yield evidence,
uncertainty and next questions across functions. Manufacturing Alignment Engineering (MAE) adds
standardization, Alpha Technology Engineering (ATE) adds transfer-readiness questions, and RDA/metrology
adds measurement and data-quality discipline. This is not evidence of having performed those jobs,
a Micron engagement, DRAM-specific validation, or a cross-site production transfer.

See [role alignment](ROLE_ALIGNMENT.md), [comparability](DATA_COMPARABILITY_CONTRACT.md) and
[handoff readiness](ANALYSIS_HANDOFF_READINESS.md). The existing equipment scenes and Silver/Dark
visual design are preserved. This documentation does not change controllers, models, gates or UI.

## Read-only verification from the pinned baseline

Use a separately obtained, trusted checkout of the baseline. Do not run training/reproduction commands
that write canonical results for this handoff. No raw dataset download is needed for the following audit.

```sh
git rev-parse HEAD
# expected: d534d6ef6f9dd819d8d993e51c0eb31402b328be
python3 --version
python3 verification/recompute_v1.py --results results/v1
```

Read the pinned verification/recompute_v1.py before running it.
The final command prints JSON to stdout and does not write input results. It uses Python standard
library only. For this documentation review, the identical pinned script and six result files were
materialized through the GitHub connector, their Git blob IDs verified, and executed with Python
3.12.14. That was a sparse file snapshot, not a full Git checkout; `git rev-parse` is the receiving
reviewer's checkout identity check and was not claimed executed successfully on that sparse snapshot.

Expected fields: `status="consistent"`, `sample_count=392`,
`evaluation_status="provisional_due_to_prior_engineering_smoke_test_exposure"`,
`model="random_forest_depth_none_leaf_8"`.
The 0.1 budget row is `inspection_count=40`, `captured_fail=5`, `total_fail=24`,
`false_inspections=35`; therefore 19 failures are outside the review budget.
AP is `0.09347718147533737`; at threshold 0.5, TP=0, FN=24, FP=0, TN=368.
This is arithmetic consistency of saved predictions, not inference, independent evaluation,
retraining or performance improvement. The displayed top50 is not the evaluated top40 budget.

Canonical priority CSV SHA-256:
`73a14b4a64a257f32ddef5924d79f3e6729ba9db6f0c402acdfe0c1708d6c563`.
Expected SHA-256 values below were calculated from the six pinned files after their Git blob IDs
were checked against the connector response. They identify this saved snapshot, not raw data authenticity.

| File in results/v1 | Expected SHA-256 |
|---|---|
| `manifest.json` | `d82685043bc160ce5dd07e9a5c43d77ba719f9e4c990d15877aee39bd64040e9` |
| `config.json` | `65246b5cc1437f7986a73690829326c41b9a7a6a6eae1c579cfae921474fef54` |
| `test_split.csv` | `dac1a8c2e4fbdd3479df60177ddbf7f5d0f987608043e2dd80cae657f3f685c2` |
| `priority_table.csv` | `73a14b4a64a257f32ddef5924d79f3e6729ba9db6f0c402acdfe0c1708d6c563` |
| `test_metrics.csv` | `a420aa3d3132d899daefdcb9c219f430f83588e829a559cc2c89a5a0ede25224` |
| `top_k_test.csv` | `d6dfabb5dbfeb0d4407164ef77b493375fbc6c9b2bc5a4dbc9abf6f6c9fb0baf` |

The audit prints all six input hashes but does not itself enforce pinned expected hashes.
Separately compare them against the trusted pinned snapshot before treating the cohort as identical. The web review snapshot separately identifies its analysis
source commit `78a8f61bf8319a5da01f4b2eb81fa6778cd7fde5`: this identifies the historical
analysis-source revision recorded in web/review/source.json, whereas d534d6e identifies the later
repository/deployment baseline reviewed here. Neither means these new documents were already deployed.
Do not overwrite the historical provenance field with the later baseline SHA.
If identity or hashes differ, stop the comparison and record the mismatch; do not silently repair results.

## Data provenance and rights

- SECOM: McCann, M. & Johnston, A. (2008), UCI Machine Learning Repository,
  [DOI 10.24432/C54305](https://doi.org/10.24432/C54305).
  The [official dataset page](https://archive.ics.uci.edu/dataset/179/secom), checked 2026-10-31,
  lists CC BY 4.0. Preserve creator attribution, license link and transformation notices when sharing
  derived material. The repository transforms original pass/fail coding into binary labels and creates
  temporal splits, scores and review ordering. Anonymous measurements are not physical cause labels.
- UR3 CobotOps: Tyrovolas, M., Aliev, K., Antonelli, D., & Stylios, C. (2024),
  [DOI 10.24432/C5J891](https://doi.org/10.24432/C5J891), CC BY 4.0 per the existing
  [source/transform record](UR3_RECORD_REPLAY.md). Follow that record's attribution and transformation
  details. It is historical sensor replay, not live robot control or reconstructed physical poses.
- [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).
  Public access and licensing do not establish fitness for factory use, label correctness, or endorsement.
  This handoff adds no raw dataset redistribution. IMAD/BOSCH and other sources keep their separate
  source-specific rights and contracts; do not assume SECOM's license covers them.

## Evidence boundaries and recovery

SECOM scores are not calibrated failure probabilities. Global importance is not per-case causality.
The holdout was exposed and remains provisional. IMAD's existing normal-development report has 1,043
windows and 9/0/3 exploratory alarms (Shewhart/EWMA/CUSUM), not a new failure-detection performance claim.
SMT, robot-arm movement, AGV and the separate OHT scene are synthetic explanations. Their synthetic motion is not derived from UR3 historical records or live measurements, and no cross-source joining or actual fab throughput is established.

The review JSON is an unauthenticated, self-declared offline memo. Exporting a memo is not a signed
engineering approval or persistent factory audit trail. Missing metadata means blocked comparison,
not inferred units, timezone, site or recipe. See existing [external-data gates](EXTERNAL_DATA_QUALIFICATION.md)
and [BOSCH contract](BOSCH_INPUT_CONTRACT.md). Do not fabricate site A/B, Cpk, yield improvement or downtime savings.

On mismatch, preserve both files and hashes, record the command/error, and ask the owner to identify
the intended version. No command here changes deployment; no rollback or hardware command is supplied.
Further tests, access, publication or site-specific acceptance require a separate decision.

## Reviewer questions and attribution

1. Are the scope, cohort and inspection budget unambiguous?
2. Which missing metadata blocks physical or cross-site interpretation?
3. Can another reader locate the same saved evidence without creating a new result?
4. Which claim would require real DRAM/test/process/measurement knowledge or qualified site evidence?

No reviewer answer, institutional approval, Claude/Jules review or human field sign-off is implied by
this document. The project owner's scope/decision role and AI-assisted implementation remain governed
by [contributions](governance/CONTRIBUTIONS.md) and [AI usage](governance/AI_USAGE.md).
For this addition, the owner selected the four-role direction and preservation constraints; Codex
prepared the local documents and saved-result checks. A separate Codex read-only document review has been performed. Claude reviewed the original four-document
snapshot as text only; it did not execute commands or independently recompute results. Its useful
clarifications were reviewed in a completed final-delta text review. This review-status sentence was
then updated administratively; those status-only bytes were not resubmitted. Jules review, field review and
public release were pending at preparation time. Consult the associated PR for subsequent publication;
Jules and field review were not performed for this document.
See the [Japanese summary](TECHNICAL_HANDOFF_JA.md).

## November 2026 review route

Updated 2026-11-01 KST. Documentation baseline: `0eb1df1507972f98f188c076e987bf425cd02e35`.
PR196 merged the four handoff documents plus two links; the earlier preparation notes above are historical.
The earlier d534d6e baseline and historical analysis-source SHA retain their distinct roles.
The live site can advance independently: pin a checkout for arithmetic review, not a moving URL.

Common spine: manufacturing-data validation → risk ordering → human review → reproducible handoff.
First career orientation: Hiroshima; the same evidence remains usable for Korea/U.S. semiconductor roles.
Company terminology and qualifications are not interchangeable. See [role mapping](ROLE_ALIGNMENT.md#2026-11-01-공통-기반과-기업별-설명).

| Minutes | Existing route | What is actually implemented |
|---|---|---|
| 0:00–0:40 | [README](../README.md) → [demo](https://fabguard-ai.vercel.app/) | Saved SECOM result: top40 captures 5/24, 35 normal records inspected, 19 failures outside budget; provisional |
| 0:40–1:30 | [queue](https://fabguard-ai.vercel.app/#risks) → [case](https://fabguard-ai.vercel.app/#detail/secom_1397) | Rank1 is retrospectively normal; score is not calibrated failure probability. Display top50 ≠ evaluation top40 |
| 1:30–2:40 | Case button → [review note](https://fabguard-ai.vercel.app/review/?sample=secom_1397) | Self-declared offline note, JSON export/import; no authenticated approval or permanent factory database |
| 2:40–3:30 | [readiness](ANALYSIS_HANDOFF_READINESS.md) → this handoff in a separate tab | Existing documents; review page has no direct handoff link or automatic packet assembly |
| 3:30–4:20 | [UR3](https://fabguard-ai.vercel.app/robot/ur3/) / [IMAD report](https://fabguard-ai.vercel.app/robot/) / [SMT](https://fabguard-ai.vercel.app/smt/) / [OHT](https://fabguard-ai.vercel.app/oht/) | Separate historical sensor replay, saved normal-development exploration, and synthetic scenes |
| 4:20–5:00 | Explain missing evidence | No real DRAM/HBM/foundry work, verified root cause, production qualification or field improvement is established |

Transition: “These are separate sources, not one connected factory. UR3 replays historical measurements;
IMAD shows saved normal-development exploratory alarms. SMT/AGV/OHT motion is synthetic and is not generated
from those sensor records. Sensor change, input-quality failure and recorded protective stop are different observations.”

### One small public-data review task

Question: Do the six pinned saved files support the reported top40 counts and AP without overstating them?
Use a trusted public checkout, Python standard library, and the six `results/v1` files listed above.
No raw dataset, model download, credentials, training, inference or threshold selection is required.

```sh
git checkout --detach 0eb1df1507972f98f188c076e987bf425cd02e35
git rev-parse HEAD
python3 verification/recompute_v1.py --results results/v1
```

First confirm the full SHA and compare all six printed hashes with the table above.
Expected: consistent, 392 records, AP 0.09347718147533737, top40=5 failures +35 normal,
24 total failures, 19 outside budget, provisional exposure status. The script checks arithmetic,
not the expected pinned hash list; the reviewer must compare hashes separately.
Return only: checked SHA, environment, hash match/mismatch, observed counts and one misleading/missing caveat.
Stop/withhold on mismatched identity, hashes, denominator or unavailable files. Do not tune values to match.
Success means saved-evidence consistency only, not independent performance or a hiring endorsement.

For this documentation update Codex executed this existing audit once on the baseline with Python 3.12.14:
consistent, 392, AP 0.09347718147533737, top40 5/24 and 35 normal. It was not a new experiment.

### Rights and access boundary

Public repository code/docs/saved-result audit and public web inspection can be reviewed now; preserve existing
code license, source attributions and AI/human contributions. SECOM/UR3 retain their source-specific rights;
public availability does not license every included or third-party asset for unrestricted reuse.
IMAD raw archives/features/models, private fab logs, training slides, identifiable review notes and new site data
are not part of this task. Check ownership, permitted purpose, redistribution and access separately before transfer.
Do not publish private records in issues or expand Drive sharing. Existing overseas-collaboration PDFs remain dated
snapshots; this Git handoff is the current navigation layer, not a duplicate folder or a new partnership claim.

### Remaining work; proposed only

Prioritize analysis evidence over new equipment models: (1) independent normal/abnormal sessions and onset labels
with fixed split/threshold/metrics; (2) SPC subgroup/normality/autocorrelation and control-limit vs specification-limit
understanding; (3) an approved DOE plan defining factors, response, blocking, randomization, replication and safety.
No DOE or field trial was run here. Device/process study must cover DRAM basics, process steps, electrical test,
metrology calibration/repeatability and packaging mechanisms using legitimate learning/measurement evidence.
Optional web change, not implemented: add a handoff link to the existing review page. Any UI/code work needs a
separate scope report; do not create a second review system. dot coordinates actual Claude/Jules review;
no duplicate requests, external outreach, coauthorship commitment or large experiment was made.

## Two audiences, one evidence spine

See the [two-route requirement/evidence/gap matrices and five-minute demos](ROLE_ALIGNMENT.md#2026-11-01-두-경로로-설명하기).
Route A explains process/yield review and technical handoff; Route B explains manufacturing-analysis software,
data contracts, UI, failure isolation and reproducibility. The owner's long-term target is not the same as the
skills most directly demonstrated by today's artifacts. AI-assisted implementation does not establish the owner's
unaided programming proficiency. Product Agent/RAG, enterprise databases, AMHS control and factory qualification
remain unimplemented or unvalidated. Domestic graduate job descriptions are not U.S. hiring requirements.
Public employer links support the mapping; privately supplied lecture pages and captures are not redistributed.
