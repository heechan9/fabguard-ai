# Changelog

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
