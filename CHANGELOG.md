# Changelog

## 2026-09-09

- Added a country-first machine-readable evidence catalog and navigation page while retaining all existing canonical paths, preventing broken links and duplicate evidence during the migration.

- Recorded the canonical Enedis France 2024 E2E evidence: 17,568 half-hour rows passed Frictionless and Solar Data Tools with matching SHA-256 lineage; 207 source energy nulls remain explicitly preserved in the collection audit.

- Audited the full Enedis 2024 solar/total-band response: 17,568 timestamp rows contain 207 source energy nulls, zero negative values and zero other invalid values; nulls are now preserved without zero imputation and reported as explicit quality counters/warnings.

- Reconciled Enedis Data Fair deep pagination: the first page must provide an exact total, later internal-dataset pages may omit it, any repeated total must agree, and final accumulated rows must still equal the first-page total.

- Added a bounded Enedis national solar-injection collector using structured Data Fair filters, exact-count deep pagination, official-host and loop checks, complete UTC half-hour coverage, page hashes, and local-only raw/normalized data handling.

- Prepared France follow-up contracts for Enedis national half-hour solar injection aggregates and Météo-France Paris-Montsouris 2024 hourly weather observations, including fail-closed scope, continuity, unit-conversion and provenance tests; no Enedis live E2E result or PV-performance claim is made.

- Added an explicit RTE `published` revision policy after the live 2024 source audit found 35,132 definitive and four consolidated envelope rows in the final UTC hour; per-row lineage is preserved and strict single-state modes remain fail-closed.

- Reconciled RTE's audited Europe/Paris DST API artifacts: exact spring duplicates are removed only on the true transition day, autumn source gaps remain explicit nulls on a continuous UTC grid, conflicting or ordinary-day anomalies still fail closed, and all adjustments raise auditable quality counters.

- Added a fail-closed daily-chunked RTE éCO2mix collector for up to 366 UTC days, with exact daily count checks, structural-null accounting, complete half-hour coverage, raw chunk hashes, normalized SHA-256, and offline regression tests.

## 2026-09-08

- Reconciled the live RTE éCO2mix records response with its 15-minute API envelope: structural :15/:45 solar nulls are explicitly counted and removed, while :00/:30 values remain subject to fail-closed 30-minute continuity and generation checks.

- Replaced platform-dependent country-flag emoji with licensed local SVG assets across country cards, tool roles, and expansion candidates, with regression tests for Windows and offline rendering.

- Synchronized the public README and web demo with canonical GB PV_Live and EU JRC PVGIS E2E evidence, added CI-backed global evidence checks, centered both clickable README navigation rows, and marked France RTE as preflight-ready rather than live-validated.

- Prepared France slice 1 with a fail-closed RTE éCO2mix national solar pre-ingestion contract, bounded API request builder, CET/CEST-to-UTC normalization, MW and 30-minute continuity checks, orthogonal consolidated/definitive revision lineage, and offline tests; no live RTE result is claimed yet.

- Prepared a version-pinned JRC PVGIS 5.3 hourly reference-data contract, fail-closed offline tests, provenance fields, and a bounded live-audit gate; no live PVGIS result is claimed yet.

- Moved the unverified Middle East heat/soiling idea out of the public candidate registry and roadmap into a separate exploratory research note; it is not an approved source or implementation queue item.


- Completed a bounded live smoke against the official PV_Live v4 production API for 48 GB national half-hour estimates, recording response metadata and SHA-256 without redistributing the raw response.
- Added a seven-day-limited, UTC-only PV_Live fetch CLI with mocked network tests; Frictionless and SDT execution remain pending until redistribution and DST analysis-clock gates are resolved.

- Added a fail-closed Sheffield Solar PV_Live pre-ingestion contract for GB 30-minute UTC estimates, mandatory revision lineage, MW units, entity scope, and local-only tests without claiming live API or SDT completion.
- Documented separate gates for API access, data licensing, attribution, DST handling, hashes, Frictionless validation, and the first small live fixture.

- Recorded the reproducible DKASC Alice Springs 2025 observed-data E2E evidence and surfaced its Frictionless, Solar Data Tools, hash, unit, and claim boundaries in the public project views.
- Separated the concise public home view from professional evidence, normalized validation numbering, added direct reader routes, and improved keyboard and navigation accessibility in PRs #60–64.
- Repaired README navigation for GitHub mobile in PRs #65–66 by replacing HTML-wrapped controls with native Markdown file and section links.
- Consolidated the previously duplicated human-decision and smart-factory flows into one four-stage operational path: source/context, risk/budget, human authority, and feedback/audit.
- Preserved the boundary that MES/FDC integration, production control, feedback storage, field KPI gains, and causal effects remain unimplemented or unvalidated.

## 2026-09-07

- Validated authenticated read-only REST ingestion against a local WSL2 Fledge v3.1.0 instance using the Sinusoid South plugin.
- Accepted 60/60 initial readings, verified South-service recovery after restart, and isolated 26 replayed readings as duplicates.
- Corrected the live authentication header from `authtoken` to Fledge-compatible `authorization` and updated its regression test.
- Confirmed that authentication tokens are not recorded in FabGuard result artifacts; this remains local integration evidence, not field or production validation.
- Added a fail-closed DKASC normalizer for five-minute timestamp alignment, collision handling, missing-slot insertion, and preservation of raw versus SDT-ready power values.
- Reproduced the Alice Springs 2025 observed-data path with 105,120 normalized slots; Frictionless validation passed and Solar Data Tools 2.1.5 completed with matching normalized-input hashes.
- Recorded the DKASC power unit as inferred kW pending direct schema confirmation and retained the boundary that this is data-quality evidence, not PV-performance, field, or SECOM model validation.

## 2026-08-29

- Added official SECOM hash verification, parser, audit, and fixed temporal split.
- Added train-fitted missingness, uninformative-column, and duplicate-column filtering.
- Added Dummy, L1 Logistic Regression, and Random Forest candidates.
- Added repeated CV, time-holdout metrics, Top-K capture, feature stability, and priority table outputs.
- Logged the official holdout exposure caused by the engineering smoke run; V1 test results remain provisional.
