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
| Isolation | Invalid and nonfinite readings are written as JSON-safe dead-letter evidence while valid rows continue | Select upstream DLQ or metadata convention |
| Restart | Single-writer JSON state uses flush/fsync plus atomic replacement; REST output must complete before accepted IDs are committed | Local Fledge restart verified; validate a production state backend |
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

Both REST and local-input CLI JSON artifacts are written through sibling temporary files. If report delivery raises before
completion, processed IDs are not committed to `state.json`, so valid peers remain retryable. This
is a local at-least-once safety property, not a multi-host transaction or production outbox.

### Recovering interrupted delivery

Both CLIs now persist a strict-JSON `state.json.pending.json` journal before publishing outputs.
It contains the complete report (including source metadata, rejected readings and alerts), the
previous state and the next state. All three outputs are then replaced, state is saved, and the
journal is removed, under the same single-writer lock.

If output or state saving fails, fix the underlying disk/path problem and run the CLI again with
the same output directory and its normal required arguments. Pending recovery happens before
API access, input-file loading or reference loading. It uses the saved report and state without
recomputing timestamps, drift or duplicate decisions; the original source may be unavailable.
That invocation only recovers and prints the original report, then exits. Invoke again to ingest
new data. New flags do not change the pending batch's original source or validation decisions.

If state was saved but journal removal failed, recovery accepts the already-committed next state
and replays the same report. Corrupt journals or state unrelated to either saved state fail closed
without replacing outputs; preserve those files for manual inspection. Do not delete a pending
journal merely to bypass recovery. It contains source evidence and needs the same access controls
as report and dead-letter files. It does not store the REST authentication token.

The three output files remain individually atomic, not atomically visible as a group. Treat an
existing pending journal or an unsuccessful invocation as incomplete delivery. Concurrent readers
must coordinate with the state lock; do not consume files during a write. This is recoverable local
at-least-once delivery, not a multi-host or exactly-once transaction. Abrupt process termination can
still leave the existing exclusive lock: confirm its owner is gone before operator cleanup as
described above. Directory fsync and power-loss guarantees remain outside this local backend.

Programmatic callers opt into the journal with `process_batch(..., durable_output=True)` and call
`state_store.recover_pending()` before obtaining new input; a pending journal blocks new processing.
Do not combine durable output with a custom delivery callback. The legacy callback path retains
its retry behavior but does not get automatic journal recovery. Stdout is a convenience copy of
the files, not the durable delivery boundary.

Regression command: `PYTHONPATH=src python -m unittest discover -s tests -p 'test_fledge*.py' -v`.
Coverage includes each artifact failure, unavailable-source recovery for both CLIs, state-save
failure, post-commit cleanup failure, journal write failure, corrupt/divergent state and pending
batch exclusion. These are injected local failure/restart tests, not field or power-loss tests.

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
