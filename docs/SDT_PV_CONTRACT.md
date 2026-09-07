# Solar Data Tools integration contract

Status: **synthetic smoke path implemented; public PV data and field validation not yet performed**

This optional integration sends a declared PV power time series through Solar Data Tools (SDT) and
records a versioned, JSON-safe quality report. It is a separate systems demonstration and is not
evidence that the SECOM model generalizes to solar generation data.

## Required source declarations

Every run must declare:

- a stable source identifier;
- exactly one source type: \`synthetic\`, \`observed\`, \`estimated\`, or \`reference\`;
- the source timezone and input power unit (\`W\`, \`kW\`, or \`MW\`);
- a timezone-aware observation/retrieval timestamp;
- an input file whose SHA-256 is written to the result.

Timestamps are localized using the declared timezone and normalized to UTC. Ambiguous daylight
saving timestamps, duplicates, invalid timestamps, non-numeric power values, and infinite values
fail closed. Missing power values remain available to SDT for quality analysis.

## Optional dependency

The SECOM experiment does not depend on SDT. Install the pinned optional integration in a separate
environment:

\`\`\`bash
python -m pip install -e ".[pv]"
\`\`\`

The first verified workstation smoke used Solar Data Tools 2.1.5, Python 3.11.16, and CLARABEL.
That local observation is not a claim that CI or another machine reproduced the SDT runtime.

## CLI

\`\`\`bat
fabguard-sdt-smoke ^
  --input synthetic_pv.csv ^
  --power-column dc_power ^
  --source-id synthetic-pv-120d ^
  --source-type synthetic ^
  --timezone UTC ^
  --power-unit W ^
  --observed-at 2026-09-07T06:49:00Z ^
  --output results\sdt-smoke\report.json
\`\`\`

If \`--timestamp-column\` is omitted, the first CSV column is used. The CLI converts power to kW,
runs SDT with CLARABEL by default, normalizes the SDT report, and writes the final JSON atomically.

## Evidence and claim boundary

A local engineering smoke processed 11,520 synthetic 15-minute readings into 96 x 120 raw and
filled matrices. The input SHA-256 observed on that workstation was
\`612a72dc1623fa2e594dd596ea5587679ff452ee518a78ae963e5c1ac50d0a01\`.
The result reported quality score 1.0 and clearness score 0.9916666667. These values describe a
deliberately clean synthetic fixture only.

This integration does **not** establish:

- external validation of the SECOM model;
- PV forecasting or anomaly-detection accuracy;
- compatibility with DKASC, PV_Live, or PVGIS before their adapters are tested;
- performance on a physical sensor, solar farm, or production system;
- yield, reliability, cost, or energy improvements.

Before adding a public source, record its license/citation terms, retrieval time, stable URL or
dataset version, original checksum, timezone, unit, observed/estimated/reference semantics, and
redistribution decision.
