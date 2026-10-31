# Separate OHT explanatory scene

`/oht/` is a standalone semiconductor-fab concept, linked from SMT but not part
of its PCB line. It uses existing vendored Three.js and original primitives:
one ceiling rail, one vehicle, one hoist, one synthetic FOUP and two generic
load ports. No manufacturer geometry/logos or new dependencies are used.

## Deterministic contract

Illustrative seconds, not measured equipment timings:

| Time | Action |
|---|---|
| 0–3 | Approach A |
| 3–5 | Stop at A |
| 5–7 | Lower empty hoist |
| 7–8 | Pick the single container |
| 8–10 | Raise loaded |
| 10–16 | Travel to B |
| 16–18 | Stop at B |
| 18–20 | Lower loaded |
| 20–21 | Place container at B |
| 21–23 | Raise empty |
| 23–27 | Return empty, then remain completed |

One persistent carrier object changes ownership at continuous world positions.
The delay case stops at B from 16 to 24 seconds, then latches a delay without
lowering or automatic restart. Acknowledgement records a human check in local
page memory only; it does not move cargo, clear delay or approve work. Reset,
Replay or case change explicitly starts a new illustrative run, not recovery.

Load, Reset and case change start paused. Replay is an explicit user action.
Hidden tabs pause; history restoration does not auto-resume. Camera selection,
language and persisted silver/dark theme are independent of simulation state.
KO/EN uses `?lang=en`. Native buttons/select and live text remain usable when
Three.js fails, stalls or WebGL loses its context; reload retries 3D. This is not
a GPU driver-recovery implementation. Time output is not a live announcement.

## Evidence boundary and references

Muratec's terminology explains ceiling-track travel and hoist access to load
ports; its floor AGV is a separate category:
https://www.muratec.jp/cfa/products/trans.php

Daifuku introduces Cleanway overhead cleanroom transport:
https://www.daifuku.com/solution/products/

These references ground terminology, not our synthetic dimensions, timings,
performance or safety. No SECOM, UR3 or Fledge data drives motion. No SLAM,
real motion control, physical-clearance/collision/safety validation, fleet
scheduling or throughput prediction is implemented. Real UR3 records and SMT
AGV/R-01/R-02 remain separate and unchanged.

## Reproduction and release checks

```sh
node --test tests/web/oht.test.mjs
node --test tests/web/*.test.mjs
node --check web/oht/app.mjs
node --check verification/check_oht.cjs
python scripts/build_web_evidence.py --check
PYTHONPATH=src python -m unittest discover -s tests -v
```

The PR Silver UI job runs `verification/check_oht.cjs` at 360/390/1366 pixels,
both themes, keyboard controls, pause/replay/reset, case switching, latched
delay and acknowledgement, camera isolation, persistence, failed/stalled
imports and simulated context-loss handling. It saves captures for actual-pixel
review. It also runs the existing floor-AGV browser regression. The release job
adds OHT to the production browser matrix after all 37 static assets match the
exact checked-out release. A successful source test is not a browser pass;
workflow definitions are not execution evidence. Refer to exact-head CI and
review records on the PR for executed results. Physical/mobile-device and
screen-reader testing remain separate from automated Chromium checks.

This source was reconstructed after the original local-only candidate was lost
in an environment restart. Historical reviews are context, not proof that these
new bytes passed rendering; fresh tests and independent review are required.
