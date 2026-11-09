# Selected SPI HUD prototype

This small UI slice adds an original, restrained selection HUD to process 03 (SPI) in the existing synthetic SMT scene. Circular selection graphics and leader-line hierarchy take general inspiration from the publicly documented [Homecoming FUI](https://www.hudsandguis.com/home/2018/spiderman-homecoming); no film image, logo, font, or other franchise asset is included.

## Behavior and data boundary

- Only selected process 03 receives the screen-space ring, leader and adjacent card. Other processes and both robot types/AGV suppress it.
- On narrow scene widths the card moves below the scene and the leader is omitted. A side-switch dead band prevents chatter around the screen center.
- Cyan means selection. Neutral text means within the demo range; amber plus explicit text means review/HOLD/missing. There is no probability, uptime or model-confidence gauge.
- The card refers to the explicitly identified selected PCB. It distinguishes before SPI, currently at SPI, and an earlier SPI record. It does not claim that this PCB is physically inside the selected machine.
- Only the existing observed `volume` is shown. Precomputed `rawVolume` is not read. A missing value stays missing; context HOLD is not cleared.
- All values remain synthetic and the card continuously says no real equipment is connected. Simulation, measurements, seed, exported records, SECOM results and private research remain unchanged.
- HUD controls support keyboard use and a HUD-only Korean/English switch. This is not a claim that the entire SMT page has been translated.
- Decoration never receives pointer input, no looping HUD animation is introduced, and the existing reduced-motion pause behavior is preserved. The optional module failing to load does not stop the simulation.

## Verification

Baseline: public main `0493fc88138a75500f939c04d11cac46ea463471`.

Local final checks: 227 Node tests passed (219 existing plus 8 HUD tests); Python 307 run, 301 passed and 6 existing optional-data/dependency skips. JS syntax, `git diff --check`, shared evidence check, persisted-evidence recomputation and source-registry structural check passed. No new model fit or inference was run.

A source review found a narrow-layout `[hidden]` CSS specificity bug; it was fixed and regression coverage added. Local Chromium launch was blocked by the execution sandbox's UNIX-socket restriction, including an approved escalation. Therefore no local visual pass is claimed.

`verification/check_smt_hud.cjs` is included in the existing Silver CI at 1366/390/360 widths. It covers both themes, HUD languages, selection and toggles, mobile docking, missing values, pause/reset, intro interruption, and optional HUD module failure. CI results and image inspection must be checked separately for the exact published head. Actual hardware, mobile devices and screen readers are outside this prototype verification.

No merge or production deployment is part of this prototype.
