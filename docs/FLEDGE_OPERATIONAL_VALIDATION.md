# Fledge operational validation slice

Status: **live REST validation completed against local Fledge v3.1.0 on WSL2; not field or production validation**

This slice exercises the operational behavior that a future Fledge filter adapter can call without
coupling FabGuard's model experiment to the Fledge lifecycle.

## Live Fledge v3.1.0 evidence (2026-09-07)

- Runtime pins: Fledge `f90ffc2047ee49a380ada98a59fcc2985bd6a943`; Sinusoid plugin `4ff6eab5f21671fbcfd244e716572e699d0974da`.
- Authenticated read-only REST pull from `sinusoid` succeeded with 60/60 readings accepted.
- Restart preserved the `FabGuardSinusoid` South service and collection resumed with health green.
- A repeated pull accepted 34 new readings and isolated 26 overlaps as `duplicate reading already processed`.
- Authentication-token scanning returned `TOKEN NOT RECORDED`.
- Live validation exposed and corrected the HTTP header from `authtoken` to `authorization`.
- This is local integration evidence, not field validation, production capacity evidence, or SECOM model validation.

## Implemented evidence

| Target | Current evidence | Remaining external evidence |
| --- | --- | --- |
| Reading ingestion | JSON batches and the official read-only asset REST envelope enter the same normalization boundary | Completed against local Fledge v3.1.0; separately assess an in-process plugin and field sensor |
| Fault scenarios | Missing/invalid, duplicate, late and disconnected-asset cases have deterministic tests | Sensor/network faults in a Fledge deployment |
| Isolation | Invalid readings are written to a dead-letter result while valid rows continue | Select upstream DLQ or metadata convention |
| Restart | Single-writer JSON state uses flush/fsync plus atomic replacement; corrupt state fails closed | Local Fledge restart verified; validate a production state backend |
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
