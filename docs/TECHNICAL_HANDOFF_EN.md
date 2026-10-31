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
