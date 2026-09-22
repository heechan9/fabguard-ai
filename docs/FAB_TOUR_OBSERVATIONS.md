# Fab tour observation slice — 2026-09-15

Source: eight user-supplied photographs (41539, 41535, 41528, 41521,
41520, 41519, 41517, 41518.jpg) and representative frames at 1 second
from 41532.mp4 and 41526.mp4. No audio transcription or full video
sequence validation was performed. Original media is not published.

Visible evidence:
- 41539: Alarm Manager, warning/alarm messages for developer solution
  shortage and waste overflow, event timestamps. A displayed event list
  does not establish current physical fault status or cause.
- 41517: Wet Oxidation screen, SET/ACT, recipe and temperature zones.
- 41520: Recipe, Lot ID, Run, step times and chamber status fields.
- 41528 and 41532 representative frame: module, chamber and interlock
  status display. No specific interlock logic inferred.
- Remaining photographs show enclosures, an open chamber and cabinets;
  41526 representative frame shows wafer-like samples. These do not
  provide CAD dimensions, layer thickness, recipes or quality labels.

Implemented: one independent lesson in /secom/ explaining observed
display concepts and a synthetic alarm acknowledgement/recovery sequence.
DEMO identifiers are invented; event order is not a real equipment clock.
Buttons act only on in-memory educational state. No machinery is connected.
Acknowledgement never clears the condition; recovery never implies product
quality or permission to resume operation. Reset explicitly clears the lesson.

Not implemented: actual process recipes, thermal/flow simulation, interlock
control, device monitoring or fault prediction. No SECOM anonymous feature
is assigned to a photographed sensor. No SMT temperature range is reused
for oxidation. Photos of displayed accounts and recipe values are not copied.

Validation: node --test tests/web/tour.test.mjs and existing web suite.
Browser rendering and physical equipment behaviour require separate checks.

## Second supplied set — equipment roles

Seven supplied photographs: 41547, 41546, 41545, 41544, 41539, 41536,
41535.jpg. The last set reuses the 41539 alarm view and 41535 chamber
view already considered above; do not count those as independent evidence.
41532.mp4 is also resupplied. New 41548.mp4 (11.726 s) was inspected as a
three-frame contact sheet sampled at 4-second intervals using ffmpeg
`fps=1/4,scale=640:-1,tile=3x1`. No audio transcription or measured motion.

- 41547 and 41548 representative frames show SUSS MicroTec branding,
  an alignment/observation assembly and a sample stage. Used to introduce
  the mask-aligner role; exact model and performance are unconfirmed.
- 41544 shows a PR track label, circular processing area and handling
  mechanism. 41545/41546 show enclosure, tubing/nozzles and circular area.
  Individual module identities (coat/develop) are not established.
- 41536 explicitly labels E beam Evaporater. This supports the equipment
  category, not the manufacturer identity or detailed internal components.

Added three native HTML disclosure cards with original inline SVG concepts:
resist coating/developing, mask alignment/exposure and e-beam evaporation.
Coat -> align/expose -> develop is an abbreviated teaching sequence that
omits bake and other intermediate operations; deposition is explicitly a
separate process whose placement depends on the fabrication route.
There are no synthetic thickness/overlay predictions, manufacturer geometry
or operating setpoints. Candidate measurements are labelled as future data,
not quantities extracted from photographs. School links and original photos
are not published; general primary technical references appear in disclosures.

Primary references checked on 2026-09-15 (general roles only, not confirmation
of the photographed installation or endorsement):
- SUSS coating/developing:
  https://www.suss.com/en/products-solutions/coating-solutions/coating-and-developing
- SUSS mask alignment:
  https://www.suss.com/en/products-solutions/imaging-solutions/mask-alignment
- Korvus e-beam evaporation:
  https://korvustech.com/e-beam-evaporation/

## Third supplied set — processing roles and maintenance context

Seven photographs: 41565, 41567, 41568, 41569, 41570, 41574, 41566.jpg.
Videos 41571.mp4 (27.093 s), 41573.mp4 (49.663 s), and 41563.mp4
(4.608 s) were each inspected as three representative frames using
`ffmpeg -vf 'fps=3/<duration>,scale=480:-1,tile=3x1'`. No audio transcription,
continuous motion validation, or numerical time-series extraction was done.

- 41565/41566 show an ICP Etcher usage-log heading and a MAXIS HMI with
  Set/Monitor columns, recipe and step fields, pressure, RF, gas and temperature
  labels, plus standby/idle displays. 41574 shows the same HMI partly obscured.
  Video 41571/41573 frames show the ICP Etcher equipment label and HMI;
  41563 frames show an open circular chamber/handling area. These establish
  a process category and display concepts, not exact model or etch performance.
- 41567/41568 show DISCO DAD3350 and Blade Replacement fields, including
  blade specifications, usage, and replacement reason. The Lot ID in this
  context is not assumed to be a wafer production LOT without a data dictionary.
- 41569/41570 show DISCO DGP8760 Grinder / Polisher branding and fields for
  wheel wear, processed wafers, estimated wafers, and grinding time. READY
  labels for components coexist with a message about exceeded PM periods.
  A component's READY label does not establish overall health, product quality,
  permission to operate, or whether physical maintenance has actually occurred.

Added three explanatory roles with original SVG concepts: selective plasma
etching, backside grinding/polishing, and blade dicing. They are separate roles,
not an asserted chronological route or manufacturer CAD. Candidate measurement
needs (etch depth/profile, thickness variation, surface/crack inspection,
cut position/width/chipping, consumable usage and maintenance history) are
future data requirements, not measured values obtained from these images.

Extended the existing alarm lesson with a synthetic READY + overdue-maintenance
case. Acknowledgement cannot clear the condition. Only an explicit hypothetical
completion action changes it; product quality remains unassessed. Switching
cases and resetting remove stale READY states, acknowledgements, and history.
Set/Monitor differences require process-phase context before interpretation.
Estimated Wafers remains an equipment-displayed estimate with unknown formula
and validation; it is not a FabGuard AI prediction or a remaining-life result.
No photographed numerical recipes, account information, or original media
are published.

Primary references checked for general roles (not installation validation):
- Oxford Instruments ICP etching:
  https://plasma.oxinst.com/technologies/icp-rie
- DISCO DAD3350:
  https://www.disco.co.jp/eg/products/dicer/dad3350.html
- DISCO grinding and polishing:
  https://www.disco.co.jp/eg/solution/library/grinding.html
  https://www.disco.co.jp/eg/solution/library/strlf.html

Validation for this addition: `node --test tests/web/*.test.mjs` — 35 passed,
0 failed, 0 skipped. New regression cases cover READY/maintenance separation,
acknowledgement and completion in either order, switching cases, invalid case
identifiers, and reset. No physical equipment behaviour has been validated.

## Fourth supplied set — choosing measurements and linking records

Nine photographs: 41577, 41578, 41579, 41583, 41584, 41585, 41586,
41553, 41552.jpg. Video 41580.mp4 (53.994 s) was inspected as three
representative frames with `fps=3/<duration>,scale=480:-1,tile=3x1`.
The frames show an optical instrument, sample stage and display. No audio
transcription, full motion validation or numerical extraction was performed.

- 41577/41578 show Veeco Dektak 150 and 3D profiler labels. 41583 shows
  a positioning/scan interface rather than a completed height profile.
  The labels do not establish installed mapping options or achieved precision.
- 41579 and video frames show an optical instrument/sample stage; 41584
  shows a Nanospec label on the associated workstation. NanoSpec is discussed
  at family level; workstation labels do not establish the instrument model.
- 41553 shows VERTEX 70v branding. No spectrum, sample preparation or
  configured measurement accessories are established by the exterior image.
- 41552 shows k-Space MOS Ultra-Scan branding. The photograph does not
  establish a measured curvature/stress map, a temperature stage, or any
  optional measurement package.
- 41585 shows slotted carriers. No slot count, occupied slots, identities,
  production LOT membership or transfer history was extracted.
- 41586 shows a cabinet with a DRIE SOP label. This is retained as an
  observation, not treated as evidence of a particular deep-etch process,
  aspect ratio, recipe, or the actual configuration of the earlier ICP tool.

Added a compact measurement-selection table and native disclosures in
`/secom/#tour-metrology-title`, with a three-anchor map of the existing tour.
It distinguishes stylus height/step measurements, model-based optical film
thickness, infrared spectra and curvature/bow measurements. Film stress is
described as an interpretation requiring before/after curvature, thickness,
elastic properties, calibration and model assumptions. No measured result,
synthetic spectrum, film-thickness prediction or automatic quality decision
has been introduced. Missing measurements remain explicit in the prose.

Record-linking guidance distinguishes wafer ID, production LOT, carrier ID,
slot and process Run, along with measurement time/location/method/units,
raw file and calibration. This is a future data contract, not an implemented
equipment connector or reconstructed trace of the photographed samples.

Primary references checked on 2026-09-15 for general methods:
- Bruker Dektak Pro (different generation; principles only, not Dektak 150 specs):
  https://www.bruker.com/en/products-and-solutions/test-and-measurement/stylus-profilometers/dektak-pro.html
- NNCI NanoSpec (different installations; family-level optical method):
  https://nnci.net/tools/nanospec-film-thickness-measurement-system
- Bruker FTIR fundamentals (not configuration verification for VERTEX 70v):
  https://www.bruker.com/en/products-and-solutions/infrared-and-raman/ft-ir-routine-spectrometer/what-is-ft-ir-spectroscopy.html
- k-Space curvature/bow and stress interpretation:
  https://k-space.com/product/mos-scan/
  https://k-space.com/document/application-notes-ksa-mos-resolution-and-sensitivity/

This addition changes static HTML/CSS and documentation only. The existing web
suite passes all 35 tests. Static checks confirm unique IDs, valid labelled-by
and tour anchor references, balanced sections/disclosures, and four measurement
rows; `git diff --check` is clean. Browser visual
verification remains incomplete: local navigation was blocked by the browser
client, and the preview navigated to a Vercel origin that automatic approval
review did not permit. No account access or alternative bypass was attempted.

## Fifth supplied set — wet processing and supporting operations

Nine photographs: 41600, 41599, 41598, 41594, 41593, 41592, 41591,
41590, 41589.jpg. The 3.700 s video 41595.mp4 was inspected as three
representative frames (`fps=3/3.7002,scale=480:-1,tile=3x1`). Those frames
show a Deep Si Etcher label, MUC-21 branding and the recipe-list screen.
No audio transcription, continuous operation verification, or numerical
process result was obtained from the clip.

- 41589/41591 show SPIN ETCHER, liquid/waste paths, stage/time fields,
  wafer-holding controls and a buzzer control. No Chemical and Active are
  observed interface labels, not verified chemical inventory or run states.
  The exact tool model and actual chemical composition remain unknown.
- 41592 shows ELECTRO PLATING MACHINE, temperature and rotation displays.
  The deposited metal, solution, exact model, current history and measured
  film are not established. 41593 shows an open circular processing area;
  its detailed electrode arrangement and tool identity are not assigned.
- 41594 and the video show MUC-21 branding, a recipe directory/list and
  process-pump warning entries with different dates. A stored recipe is not
  an execution record; visible dates are not proof of approved versioning.
  Neither current warning activity nor root cause is established.
- 41590 shows DAD3350 again; it supplements the existing dicing observation
  without duplicating a role card or adding unsupported cutting results.
- 41598/41599 show this facility's entry/gowning, role, sample and reagent
  storage guidance. These are site-specific observations, not universal
  cleanroom rules, confirmed current permissions, or a completed audit.
  No wearer identity or authorization is inferred from garment colour.
- 41600 shows MCC-604 and circuit labels for supporting equipment such as
  air showers and pass boxes. Meter types and breaker ratings are not an
  energy dataset; values, circuit topology, operational health and carbon
  emissions are not reconstructed from the photograph.

The static lesson adds two labelled conceptual role diagrams (spin wet
etching and electroplating), a recipe/execution/acknowledgement disclosure,
and a fourth navigation stop for supporting operations. No cabinet wiring
diagram is reconstructed. The plating
diagram illustrates deposition at a conductive surface and explicitly omits
parts of the electrode/wiring arrangement; it is not an operating schematic.

Future record-design guidance includes recipe ID/version/approval and the
conditions actually used by a Run; warning onset/clearance/acknowledgement;
training and equipment-specific authorization; sample ownership/location;
and metered active energy with measurement boundaries. Carbon accounting
would additionally require a factor appropriate to the region, period and
accounting method. None of these integrations or datasets is implemented.
The synthetic lesson remains the existing two scenarios; no equipment
control, recipe execution, real approval or automatic quality decision is added.

Primary references checked on 2026-09-15:
- POLOS spin etching, general principle for a different tool:
  https://www.sps-polos.com/support/applications/spin-etching/
- Lam Research electroplating introduction (2018-08-13):
  https://newsroom.lamresearch.com/Tech-Brief-Elements-of-Electroplating
  https://www.lamresearch.com/technical-glossary/
- Sumitomo member profile in MMC MICRONANO No. 61 (2007-10-30):
  https://www.mmc.or.jp/en/magazine/61e/08.pdf
  This historical manufacturer profile describes multiple MUC-21-based
  configurations. It does not identify this installed configuration or
  validate its etch depth, rate or aspect ratio.

Only static HTML/CSS and observation documentation change in this addition.
All 35 web tests pass. Static checks confirm eight labelled SVGs, four valid
tour anchors, four measurement rows, unique IDs, valid labelled-by references,
and balanced structural elements. `git diff --check` passes. The browser
limitation recorded above still applies.

## Integration verification — 2026-09-22

Integrated with main `f70a7a1` without replacing the existing SECOM evidence,
SMT event export, or NVIDIA preparation section. Local web suite: 48 passed.
Python suite in the declared optional PV environment: 177 total, 176 passed,
1 skipped because the official SECOM raw data was unavailable.

Actual cloud Chrome checks on the PR preview:
- Desktop (1363px): solution/maintenance selection, acknowledgement, independent
  recovery, case reset, and empty-history reset passed.
- A separate preview-only 390×844 iframe exercised the real SECOM page at a
  narrow CSS viewport (375px content after scrollbar), not a physical phone.
  Scenario selection, acknowledgement and recovery passed without horizontal
  document overflow. The viewport harness is not part of production.
- The narrow screenshot exposed a nowrap demo-ID badge; scoped wrapping and
  extra narrow-screen anchor clearance were added. Existing page design retained.
- Real equipment behaviour and physical iOS/Android testing are not established.

Human scope: Choi Heechan requested completion of the pending feature.
Codex: main integration, browser interaction checks, narrow-layout correction.
