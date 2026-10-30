# R-02 synthetic transfer robot

Implementation base: `35883a9` (existing silver SMT scene). No new assets, dependencies, CAD, licenses, data fields or simulation stages.

## Location and role source

`web/smt/simulation.mjs` defines Cooling (index 7) immediately before 3D AOI (index 8). Its existing duration is 3 seconds, while insertion cadence is 4 seconds. `web/smt/app.mjs` already models Cooling as an open 1.45-wide station, with an existing board path from `-width/2-.24` to `width/2+.24`. R-02 replaces only that stage's rendered board position with pick → lifted horizontal travel → lower/place. The next stage resumes the unchanged conveyor timeline. The small existing inter-station gap remains schematic, not a validated trajectory.

The overhead Cartesian gantry has two external support posts, a raised rail, translating carriage, cantilever, vertical slide and gripper. It is visually and functionally distinct from R-01, which retains final-inspection normal/NG/HOLD sorting. Supports sit outside the conveyor in Z; horizontal board travel occurs only when lifted. Invalid overlapping input causes the gripper to idle rather than attach multiple boards. This is a presentation guard, **not physical collision/safety validation**.

Pose depends only on existing stage/progress, not seed, raw measurements, faults, SECOM, AI score, hardware or UR3. Reset/pause/speed/intro replay reuse their existing source. No real equipment, kinematic or digital-twin claim is made.

## Verification

- `node --check web/smt/app.mjs`
- `node --check verification/check_transfer_robot.cjs`
- `node --test tests/web/*.test.mjs` (148 passed locally before theme integration).
- New model/view tests mount actual Three.js geometry in Node, verify distinct mesh presence/moving parts, continuous lift/travel/lower, all 12 boards, overlap guard, pause, repeated mid-motion reset, seeded replay, interrupted intro source restoration, no simulation mutation, and preserved R-01 NG/HOLD rules.
- Existing `.github/workflows/robot-sort-ui.yml` additionally runs `verification/check_transfer_robot.cjs` after publication approval, against loopback and preinstalled CI Chrome. It captures pick/transfer/place at widths 360, 390, 1366 in silver/dark, plus selection/camera/intro cancellation/reset/overflow checks. Both-theme script expects the bundled theme change.
- No local browser automation was run. CI screenshots still require review; hashes only establish changed rendered pixels, not visual quality or engineering validation.

## Continuous empty return

The previously abrupt idle reset is replaced by a pure `transferRobotPose(boards,time)` sample of the existing 1 s inter-arrival gap: lift at the destination (0–0.25 s), horizontal empty return while raised (0.25–0.75 s), lower at the pickup (0.75–1 s). Initial/final idle is at pickup height; the next board starts there without snapping. Existing process durations, board positions, RNG and export fields are unchanged. Tests cover both sides of departure/next-pickup and internal boundaries, frozen return, final-board return, reset/replay, and restoring an interrupted intro source. CI adds empty-lift/empty-return/ready/next-pickup pixel captures in both themes at all three widths.
