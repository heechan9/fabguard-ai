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
