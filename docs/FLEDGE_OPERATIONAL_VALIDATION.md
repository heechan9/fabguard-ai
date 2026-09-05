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
| Restart | Single-writer JSON state uses flush/fsync plus atomic replacement; corrupt state fails closed | Validate Fledge restart/configuration lifecycle and production state backend |
| Capacity | Ordered and deterministic stress-profile local reports record min/mean/max | Measure container/device latency, memory and back-pressure |
| Drift and alerts | PSI handles minimum evidence and constant baselines; disconnect alerts are one-shot until recovery | Agree thresholds, baseline lifecycle and notification plugin mapping |

The JSON state store is deliberately a verification implementation, not a production state backend.
It enforces one local writer with a lock file and bounds processed IDs with a configurable retention
window. A crash can leave a stale lock that requires operator inspection; multi-host coordination,
automatic stale-lock recovery, directory fsync semantics and a production database remain outside
this slice. Expired IDs can be accepted again, so retention must exceed the source replay horizon.

Future timestamps beyond the configured clock-skew allowance are isolated before they can update
`last_seen`. A disconnect alert is emitted once and re-armed only after a new accepted reading.
PSI is not calculated below the minimum finite sample count; this produces an explicit
`drift_evidence_insufficient` alert. Constant reference distributions distinguish unchanged values
from a shift, but baseline governance and missingness alerts still require field design.

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
  --stress ^
  --output results\fledge-operations\benchmark.json
```

The stress profile injects a deterministic adjacent out-of-order pair and one duplicate; it is not a
network, concurrency or back-pressure simulation. Numbers are machine-specific single-process
measurements. They must not be presented as Fledge, edge-device, production, or factory capacity.
