# Fledge operational validation slice

Status: **local runtime-agnostic validation, not execution inside Fledge**

This slice exercises the operational behavior that a future Fledge filter adapter can call without
coupling FabGuard's model experiment to the Fledge lifecycle.

## Implemented evidence

| Target | Current evidence | Remaining external evidence |
| --- | --- | --- |
| Reading ingestion | JSON reading batches enter the same normalization boundary intended for an adapter | Run inside a maintainer-approved Fledge plugin repository |
| Fault scenarios | Missing/invalid, duplicate, late and disconnected-asset cases have deterministic tests | Sensor/network faults in a Fledge deployment |
| Isolation | Invalid readings are written to a dead-letter result while valid rows continue | Select upstream DLQ or metadata convention |
| Restart | Atomic JSON state reload preserves processed IDs and last-seen timestamps | Validate Fledge restart/configuration lifecycle |
| Capacity | Repeatable local throughput report records min/mean/max | Measure container/device latency, memory and back-pressure |
| Drift and alerts | Reference-based PSI and JSON alert contracts are tested | Agree thresholds, baseline lifecycle and notification plugin mapping |

The JSON state store is deliberately a verification implementation, not a production state backend.
Its processed-ID set is unbounded, so retention and compaction must be designed before continuous
operation.

## Scenario run

```bat
python -m fabguard.integrations.fledge_operations_cli ^
  --input examples\fledge\operational_readings.json ^
  --output-dir results\fledge-operations ^
  --observed-at 2026-09-04T01:01:00Z ^
  --reference examples\fledge\reference_distribution.json ^
  --require pressure ^
  --require temperature
```

This creates `report.json`, `dead_letters.json`, `alerts.json`, and atomic `state.json`. Running the
same input again demonstrates restart-safe duplicate isolation.

## Local benchmark

```bat
python -m fabguard.integrations.fledge_benchmark ^
  --count 1000 ^
  --repeats 3 ^
  --output results\fledge-operations\benchmark.json
```

Numbers are machine-specific single-process measurements. They must not be presented as Fledge,
edge-device, production, or factory capacity.
