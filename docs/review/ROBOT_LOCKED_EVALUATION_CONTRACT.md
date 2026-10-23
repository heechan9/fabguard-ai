# Robot locked evaluation contract (proposal)

**Status, 23 October 2026: protocol template, not an approved or executed study.** This document adds review requirements to the [international validation plan](INTERNATIONAL_VALIDATION_PLAN.md). No new recordings, institutional agreement, model improvement, sensor synchronization, or operational robot readiness are established. Replaying the existing IMAD archive is reproducibility work, not a new independent evaluation.

The present [robot benchmark](../ROBOT_IMAD_BENCHMARK.md) remains a separate laboratory experiment with poor target performance. Its [coverage audit](../ROBOT_VALIDATION_READINESS.md) identifies exposed test groups and target-group overlap. This proposal does not change the benchmark's canonical splits, model, results or evaluation definition. Its purpose is to prevent those exposed data from being presented as independent confirmation of a future method.

## Protocol requirements

This is a proposed contract, not a completed study or approved data request. An owner and cooperating data custodian must fill and approve the missing values before execution.

1. **Question and claim scope.** Evaluate whether a frozen offline review queue, with explicit input/condition abstention, offers useful inspection allocation at an agreed human-review budget on newly recorded data. It does not diagnose root causes, certify normal/safe operation, control a robot, or validate semiconductor-fab performance. Select one primary endpoint and minimum useful effect with the domain reviewer before test access; do not invent a success threshold from existing outcomes.

2. **Permission and provenance.** Record provider, responsible custodian, collection purpose, research-use permission, allowed recipients, retention/deletion terms, and separately permitted publication of raw data, derived data, results, and institutional name. Obtain required site/ethics/safety approvals through the responsible institution. Collect only necessary non-personal telemetry; do not upload private site data to a public issue. No new fault induction or equipment operation is authorized by this proposal.

3. **Sampling unit and physical grouping.** Record site, robot/unit, sensor installation/configuration, acquisition date, continuous recording session, operating condition and independently established label provenance. Assign all windows from one recording to one split. Related recordings from the same run/setup or fault episode must share a higher-level group when dependence persists. Filename-derived groups alone do not establish physical independence. For cross-site claims, hold out whole sites; a one-site study cannot substantiate site generalization.

4. **Collection manifest and labels.** Before segmentation, inventory independent groups by condition and label category, actual durations, exclusions and missing combinations. The label custodian may create the stratified allocation without exposing final-test labels to developers. Distinguish observed faults, controlled laboratory faults, uncertain labels and sensor-health failures. Record who established each label and whether that assessment was blinded to model output. More windows do not create more independent recordings.

5. **Train/development/test lock.** Keep every existing IMAD test group explicitly exposed. Do not use the 27 target-normal training segments as clean adaptation against their overlapping target test groups. Allocate genuinely new groups into train/development/final test without overlap, with chronology/site separation matching the intended claim. Fit preprocessing and condition manifests on training only. Choose model, gate thresholds, score orientation, tie-breaks, budget, baseline and endpoints using only authorized development data. Freeze their hashes plus split manifest, environment, code and analysis plan before final-test scoring or label release. A separate custodian holds final labels; log access and exposure. No fixed split percentage or group count is justified until recording feasibility and precision requirements are reviewed.

6. **Prospective input and gates.** Preserve the strict labeled IMAD benchmark parser. New screening input must use a separate schema that does not require a fault label. Bind required channels, units and actual training-condition combinations to the model/protocol version. Structural errors return invalid input; missing required quality evidence and unknown conditions withhold the score with reason codes. An input/coverage pass is not proof of accuracy. Record partial missingness and synchronization as unknown/not verifiable when evidence is absent; do not invent quality thresholds or infer synchronization from relative-time similarity. Predeclare whether missing evidence blocks a specific analysis; prohibit unsupported sensor-fusion timing claims.

7. **Baselines and fair budget.** Predeclare the frozen reference model and at least a simple non-learned allocation baseline, such as random selection at the same review budget. Use identical eligible populations and tie rules for ranking comparisons, plus full-cohort accounting. If gates alter eligibility, separately compare the gate policy and its review workload; withhold rather than score unsupported conditions. No retuning on the old 464 test segments or newly released final results.

8. **Metrics and uncertainty.** Report total groups and segments, prevalence, durations, condition coverage, invalid/withheld/accepted counts, and reasons. At a fixed budget report captured anomalies, total anomalies, selected normal cases, precision and recall with explicit denominators. Report accepted-subset AP/AUROC only where both labels exist, alongside the proportion of all anomalies and records accepted. Count abstained cases and subsequent human-review outcomes, including review time and unresolved cases. Do not convert balanced laboratory precision into natural-prevalence performance or selected normal segments into alerts/hour. Use group-aware paired uncertainty estimates, not a bootstrap treating windows as independent. Report unavailable metrics and unstable intervals honestly when independent groups/events are too few.

9. **Release and stopping rule.** Run the frozen final evaluation once, preserving positive, negative and inconclusive outcomes. Corrections require a versioned incident record; methodological changes after exposure require a new independent test set for confirmation. Publish only approved aggregate evidence and non-sensitive manifests. Stop at a reproducible technical review/evaluation result; operational deployment, online alarms, pilot agreements and control remain separate approvals and validation tasks.

## Required lock record

The following values remain **unset**. Their presence in this template is not approval or a completed data agreement. Before final evaluation, the owner and independent data custodian must review the completed record; material changes require a new version.

| Field | Required decision or evidence |
|---|---|
| Study ID, version, responsible owner and custodian | Names/roles and approved private contact channel; no private contact details in public Git |
| Intended population and claim | Robot/site/configuration, acquisition period, target conditions, fault-label scope and limits |
| Data-use authorization | Provider approval reference, permitted users/purposes, retention, publication and attribution boundaries |
| Physical group manifest | Site/device/setup/session/episode grouping, split membership, provenance and immutable input hashes |
| Planned sample size | Independent groups and events per condition, feasibility/precision rationale, missing conditions and stop criteria |
| Train/development/final-test access | Custodian, label access log, exclusions and chronological/site separation rationale |
| Frozen implementation | Code commit, environment, feature schema, training-only preprocessing, model/protocol and condition manifest hashes |
| Frozen evaluation | Primary endpoint and meaningful effect, baseline, budget, tie rules, gate thresholds, denominators, missing-label rules, uncertainty method and seed |
| Freeze approval and test release | Dated approval, manifest hashes and custodian release record before test results are opened |
| Outcome record | Full-cohort accounting, condition-level group counts, metrics/uncertainty, failed/unavailable analyses and deviations |

## Accounting that must not be omitted

For the prespecified cohort, report mutually exclusive terminal input/gate states: invalid input, withheld for input quality, withheld for condition, or accepted for ranking. Publish the precedence rule and exclusions fixed before scoring. Counts must sum to the cohort total; retain multi-reason diagnostics separately.

Where labels are available, report anomaly counts in each state and the fraction of all labeled anomalies accepted. Missing/uncertain labels remain a separate count, not assumed normal. Rank-based recall among accepted records and captured anomalies divided by all labeled cohort anomalies are different quantities and must both be labeled. An abstained record is not an automatic true negative or a successful detection. A human resolution is credited only when actually observed under the prespecified review process.

Use the same total human-review budget when assessing end-to-end workload, including handling withheld records. If no human review has occurred, report a workload estimate and unresolved cases rather than a measured benefit. Retain unknown-condition cases even if no score can be produced. Sparse groups or absent labels may support only feasibility/coverage reporting, not a performance claim.

## First external review request (not sent)

Proposed wording for owner approval:

> Would your team be willing to review a two-page offline robot-screening evaluation protocol and identify the most important flaw in its session separation, sensor-quality assumptions, or handling of withheld cases? We are asking for written technical feedback, not equipment access, data sharing, endorsement, or a pilot commitment. A short response on one issue would be useful; we can agree the effort and attribution before any further work.

Prepare a two-page extract of this contract with the chosen research question, known negative result, unresolved decisions and immutable evidence links. Record the agreed scope before asking for further effort. A reply, a completed technical review, permission to share data, a pilot and a formal agreement are separate milestones. No outreach is authorized by the presence of this draft.
