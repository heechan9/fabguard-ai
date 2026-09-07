# Solar Data Tools integration contract

Status: **synthetic Frictionless-to-SDT path implemented; public PV data and field validation not yet performed**

This optional integration sends a declared PV power time series through a Frictionless structural
gate and Solar Data Tools (SDT), then records a versioned, JSON-safe quality report. It is a separate
systems demonstration and is not evidence that the SECOM model generalizes to solar generation data.

## Required source declarations

Every run must declare:

- a stable source identifier;
- exactly one source type: `synthetic`, `observed`, `estimated`, or `reference`;
- the source timezone and input power unit (`W`, `kW`, or `MW`);
- a timezone-aware observation/retrieval timestamp;
- an input file whose SHA-256 is written to the result.

Timestamps are localized using the declared timezone and normalized to UTC. Ambiguous daylight
saving timestamps, duplicates, invalid timestamps, non-numeric power values, and infinite values
fail closed. Missing power values remain available to SDT for quality analysis.

## Structural gate

Frictionless 5.19.0 validates the CSV before pandas normalization or SDT pipeline execution. The
resource is opened by filename relative to its resolved parent directory, avoiding an unsafe
absolute resource path while allowing an explicitly selected local input. An invalid structural
report stops the command before SDT runs. The final artifact records the Frictionless version,
resource filename, validity, and error count.

The first workstation check demonstrated two intended failures and recoveries:

- an absolute CLI resource path was rejected as unsafe;
- the original pandas index export was rejected with `blank-label`;
- a non-destructive copy with explicit `timestamp` and `dc_power` headers validated successfully.

## Optional dependency

The SECOM experiment does not depend on this integration. Install the pinned optional integration
in a separate environment:

```bash
python -m pip install -e ".[pv]"
```

The verified workstation smoke used Solar Data Tools 2.1.5, Frictionless 5.19.0, Python 3.11.16,
and CLARABEL. This local observation is not a claim that CI or another machine reproduced the full
optional runtime.

## CLI

```bat
fabguard-sdt-smoke ^
  --input synthetic_pv_contract.csv ^
  --timestamp-column timestamp ^
  --power-column dc_power ^
  --source-id synthetic-pv-frictionless-120d ^
  --source-type synthetic ^
  --timezone UTC ^
  --power-unit W ^
  --observed-at 2026-09-07T07:30:00Z ^
  --output results\sdt-frictionless-smoke\report.json
```

If `--timestamp-column` is omitted, the first CSV column is used. The CLI requires a valid
Frictionless report, converts power to kW, runs SDT with CLARABEL by default, normalizes the SDT
report, and writes the final JSON atomically. The output path may not overwrite the input file.

## Evidence and claim boundary

A local engineering smoke processed 11,520 synthetic 15-minute readings into 96 x 120 raw and
filled matrices after the corrected CSV passed Frictionless. The corrected input SHA-256 was
`5a437ba33762c29ce007271488b936d03f825f3d8d2913e7681d4d73dffd0012`.
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
