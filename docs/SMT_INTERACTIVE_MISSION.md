# Synthetic SMT interactive mission

This is a deterministic browser-only extension of the existing seed-42, 12-board SMT demonstrator, not factory control, heat-transfer simulation, AI inference or safety validation. No new application dependencies or private data are used.

## Input and state contract

- A user can stage a highest-temperature assumption between 235 and 280°C for the next PCB only. Applying again replaces the pending assumption. Selecting an existing fault preset also replaces it. Existing PCB observations are never rewritten.
- The seeded random stream advances identically even when a raw peak is overridden. The observed peak stays unavailable until the existing reflow exit. Existing rules remain unchanged: AOI NG when raw paste volume is below 80% or peak is greater than 250°C. Values of 235/250/251/280 are covered by boundary tests. 235–250°C is only an authored demo range, never a manufacturing or safety specification. Lower-than-235 inputs are rejected rather than misclassified as normal.
- Synthetic E-stop latches the simulator clock. It does not control equipment. Explicit release leaves the simulation paused; Continue is a separate action. It never clears missing observations, HOLD reasons, NG outcomes or past history. Reset starts a new seeded run and clears this run's intervention log; resetting while the stop is latched leaves that new run paused, even without reduced-motion preferences.
- LOTs remain four consecutive PCB identifiers, scoped to the current run. Cards aggregate individual NG/HOLD counts; they do not place the entire LOT on hold, approve quality or release production. Counts can overlap. A card selects its first unfinished PCB, or first member when complete.
- 3D boards have an identifying LOT strip, and their existing body color still represents the measured rule status. Components appear and mounter heads move according to the same board stage/progress object. This is an explanatory pick/place sequence, not calibrated robot kinematics or a collision model.
- Snapshot v1 retains its existing fields and adds pending_peak_celsius, emergency_stopped, control_events and an explicit intervention_scope. The existing manufacturing-event export remains a SPI-only review stream. Temperature intervention events explicitly record queued, replaced and applied phases with a sequence identifier. Application time is the PCB birth time, independent of the advance step size. Control events are synthetic simulation-time records, not operator audit logs.

## Verification

Run `node --test tests/web/*.test.mjs`, `PYTHONPATH=src python -m unittest discover -s tests -v`, `python scripts/build_web_evidence.py --check` and `node --check web/smt/app.mjs`.

The browser checker `verification/check_interactive_mission.cjs` exercises public controls and downloaded snapshots at 1366/390/360px in dark/silver, including next-board timing, stop/release/resume, HOLD preservation, reset, horizontal overflow, reduced-motion startup and a WebGL-disabled control fallback. It does not certify hardware rendering, physical phones or screen-reader behavior. The workflow records screenshots and JSON artifacts. New mission copy is Korean; this increment does not claim full English localization.
