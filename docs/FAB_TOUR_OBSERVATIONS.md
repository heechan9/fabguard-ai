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
