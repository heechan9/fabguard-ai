# SMT lab within the FabGuard web demo

The existing static Vercel deployment serves `web/`. The SMT lab now lives at
`/smt/`, with historical SECOM evaluation at `/secom/`. The original overview,
global data, inspection queue and evidence routes remain available. This change
does not deploy a Python service, ingest live equipment data, or retrain a model.

## Source and appearance

Imported from the user's separate FabGuard SMT Sites repository, source revision
`7289da6abbc138644e7eafc0dba34cb56e7f0890`. Its ownership, editable source and
deployed revision were checked before integration. The original standalone URL
remains available; it is not the canonical path for subsequent FabGuard updates.

Shared `/style.css` supplies FabGuard fonts, theme variables and ambient background.
The existing fab concept image is reused with its conceptual, non-field meaning.
`navigation.css` supports the six destinations on desktop and mobile. SMT layout
and evidence overrides stay in `web/smt/theme.css`; the original dashboard design
is retained. Scene background, fog, grid and labels use the dark/teal palette.
Camera controls, PCB selection, pause/reset/speed, fault injection and export
retain the original behavior. The simulation module is unchanged.

The existing Three.js 0.170.0 module is vendored with its original MIT license.
This is the only imported runtime dependency; no framework, package install or
new build system is introduced. It runs the existing 3D geometry, not physics or
model inference. `web/smt/style.css` preserves the source lab's layout beneath the
shared theme. It is loaded only in the SMT page, not the main dashboard.

## Shared analysis evidence

Both Global data and the SMT lab mount the same evidence renderer. They and the
SECOM page read `/data/evidence_snapshot.json`, generated exclusively from the
canonical result files and existing web summaries listed in
`scripts/web_evidence_sources.json`. The main dashboard's existing summary files
remain unchanged. CI checks that all shared values agree with the canonical files.

Run `python scripts/build_web_evidence.py` after a reviewed source update;
`python scripts/build_web_evidence.py --check` detects stale output. When admitting
changed evidence, update its exact source revision, checked date and Git blob
identities together. The generator fails on changed source bytes, preventing an
old immutable source link from silently representing new results. Original raw
PV CSVs and private data are not republished.

- DKASC, PV_Live, PVGIS, Enedis and Météo-France retain their distinct periods,
  geography, units and observed/estimated/reference status. No country ranking.
- Frictionless structure validation is separate from SDT quality diagnostics.
  DKASC unit uncertainty and transformations, Enedis's 207 nulls, and the absence
  of an individual Météo-France SDT report remain visible.
- Hash/row checks compare declarations in committed artifacts; this work does not
  re-fetch upstream data, rehash raw CSVs or rerun SDT.
- RTE annual report and 366-day collection audit are admitted: 17,568 half-hour
  intervals with matching SHA-256. Validation is complete, with two missing power
  values, two consolidated intervals, and collection/SDT quality warnings retained.
  See `results/rte-france-national-solar-2024/{report,fetch_audit}.json`.
- SECOM is historical, provisional model evaluation, not a new online prediction.
  Its anonymous features never map to SMT sensors. The Phase 1 cost calculator
  uses Phase 1 counts, separate from V1, with explicit hypothetical cost units.
- Synthetic AOI uses the same rules as the generated faults, so it cannot establish
  predictive accuracy. 86 simulated seconds is not measured line throughput.

## Validation

`node --test tests/web/*.test.mjs` verifies deterministic behavior and original
fault/measurement timing, validates the shared artifacts, and checks explicit
cost assumptions. Existing Python web navigation/data tests continue to run.
Browser/WebGL visual verification is not included in this execution environment.

## Next actual SMT connection

Start with authorized exports linking board ID, station, event time, units,
SPI measurement, reflow profile and AOI result. Establish missingness, temporal
alignment and labeling contracts before separate model training and independent
evaluation. Energy scenarios additionally require the actual plant's location,
metered load, aligned weather/generation periods and tariff assumptions.
