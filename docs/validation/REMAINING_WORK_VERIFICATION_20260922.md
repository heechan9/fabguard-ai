# Follow-up verification — 2026-09-22

Base: main `f70a7a1` (PR #130). This is a dated check, not a live status feed.

## SMT and introduction recording (#110)

The public `/smt/index.html` initialized the simulation, stage buttons, selected
PCB and inspection lesson in cloud Chrome. Console evidence identifies this
browser's WebGL vendor/renderer as Disabled; WebGL context creation failed.
The existing fallback message appeared and stage selection/pause still worked.
The earlier single 502 reload is not proof of an application defect and its
transport cause remains unclassified.

PR #110 was integrated with main while preserving automatic reflow cutaway,
NVIDIA preparation and manufacturing-event export. Local web tests: 46 passed
on this isolated integration. The preview dialog opens/closes; preview/record
correctly reports unavailable 3D and exposes no fake download in this browser.
Actual GPU rendering, context loss, 10-second recorder finalization, codec,
playback/download and restoration of a live run remain **unverified**. Keep
#110 Draft until those checks pass in a WebGL-capable browser. No recorder
feature has been deployed to production by this verification.

## Fab tour lesson (#111, merged)

Merged as `ae3d9417114fbc07f4e2c7f7c6f1e0387a717380` after CI success.
See [the observation and integration record](../FAB_TOUR_OBSERVATIONS.md).
A current-main integration passed 48 Node tests. Desktop interactions and a
390×844 preview-only iframe checked independent alarm acknowledgement/recovery,
maintenance READY state, case changes and reset. A nowrap identifier badge
was corrected; the verification harness is excluded from production.
Physical iOS/Android device behaviour was not tested.

## RTE annual run — blocked, partial checkpoint only

Existing annual result files were not found in the inspected checkout or the
Library search. This does not prove they do not exist on the user's PC.
A new run against the existing official RTE endpoint obtained **44 daily raw
responses**, 2024-01-01 through 2024-02-13 UTC, before a network tunnel returned
`403 Forbidden`. The run stopped; access controls were not bypassed.

Replaying those cached bytes through the unchanged collection contract gives:

| Check | Partial result |
|---|---|
| Input envelope | 4,224 quarter-hour rows |
| Structural null rows removed | 2,112 |
| Normalized half-hour rows | 2,112 |
| Missing power / duplicate / DST days | 0 / 0 / 0 |
| Revision status | 2,112 definitive; source role remains estimated |
| Frictionless 5.19.0 | Valid, zero structural errors |
| Normalized CSV SHA-256 | `92f9b3f0d18b13204c02bd99e10cf8082a6126b6f875189e5ed935cb4e6f706a` |
| Annual coverage / SDT | Incomplete / not executed |

`FabGuard_RTE_2024_checkpoint.zip` privately retains raw bytes, retrieval time,
URL and hash per day, a partial audit and a serial resume script that validates
cached hashes. No raw responses or credentials were committed. Do not add this
partial result to the canonical annual catalogue or promote the public RTE card.
On an authorized network, complete the remaining 322 days, test the DST and
revision tail under the existing contract, run the pinned optional SDT pipeline,
match hashes, and confirm attribution/redistribution terms before admission.
Official source: <https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/>.

## Environment and contribution

A separate virtual environment installed the already-declared `.[pv]` extra:
Solar Data Tools 2.1.5 and Frictionless 5.19.0. Python tests: 177 total,
176 passed, 1 skipped (official SECOM raw data absent). This is a different
optional-dependency environment from the earlier 174-pass/3-skip run, not an
edited test or a re-run of canonical model experiments.

Choi Heechan requested completion and preservation of the existing product.
Codex performed integration, browser checks, scoped mobile correction, live
collection attempt and evidence recording. No field performance, expert
endorsement, or upstream contribution is inferred from these checks.
