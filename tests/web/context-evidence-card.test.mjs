import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {digest} from '../../web/equipment/context-review-model.mjs';
import {buildContextEvidenceCard as card} from '../../web/equipment/context-evidence-card.mjs';
globalThis.crypto ??= webcrypto;
const raw=readFileSync(new URL('../../web/equipment/data/maintenance-synthetic.json',import.meta.url),'utf8');
const p=JSON.parse(raw), id=p.observations[0].review_id;
const valid={signal_class:'SPC',measured_at:'2026-09-01T00:11:00Z',available_at:'2026-09-01T00:12:00Z'};
test('empty annotations remain unverified and no decision is made',async()=>{const c=await card(raw,id);assert.equal(c.evidence_verification,'NOT_PERFORMED');assert.equal(c.operational_decision,'NOT_MADE');assert.equal(c.blockers.length,3);assert.ok(!('status' in c));});
test('complete declarations never become verified or adopted',async()=>{const c=await card(raw,id,valid);assert.deepEqual(c.blockers,[]);assert.equal(c.evidence_verification,'NOT_PERFORMED');assert.equal(c.operational_decision,'NOT_MADE');});
test('plan, side-effect check and evidence reference remain separate declarations',async()=>{
 const notes={verification_plan:'비교 계획',side_effect_check:'추가 계측',verification_evidence_ref:'TEST-01'};
 const c=await card(raw,id,{...valid,...notes});
 for(const [key,value] of Object.entries(notes)) assert.equal(c.declared_annotation[key],value);
 assert.equal(c.evidence_verification,'NOT_PERFORMED');
 assert.equal(c.operational_decision,'NOT_MADE');
 assert.equal(c.source_context_state,p.observations[0].context_state);
 assert.ok(!('verification_plan' in (await card(raw,id,valid)).declared_annotation));
 await assert.rejects(card(raw,id,{side_effect_check:'x'.repeat(501)}),/follow-up/);
});
test('held and missing source reasons are all retained',async()=>{const c=await card(raw,p.observations[2].review_id,valid);assert.equal(c.source_context_state,'withheld');assert.ok(c.blockers.includes('measurement_missing'));assert.ok(c.blockers.includes('change_after_baseline'));assert.equal(c.related_changes[0].kind,'maintenance');});
test('annotation is bound to exact source bytes',async()=>{const c=await card(raw,id,valid);await assert.rejects(card(raw+' ',id,{...valid,context_package_sha256:c.context_package_sha256}));});
test('malformed package and unknown row are rejected',async()=>{await assert.rejects(card('{}',id));await assert.rejects(card(raw,'unknown'));});
test('invalid or naive times are rejected',async()=>{for(const at of ['2026-09-01T00:11:00','2026-02-30T00:11:00Z','bad']) await assert.rejects(card(raw,id,{...valid,available_at:at}));});
test('future availability and retained reasons are not masked',async()=>{const c=await card(raw,p.observations[1].review_id,{...valid,available_at:'2026-09-01T00:21:00Z'});assert.ok(c.blockers.includes('unavailable_at_review_cutoff'));assert.ok(c.blockers.includes('change_after_baseline'));});
test('availability before measurement is explicit',async()=>{const c=await card(raw,id,{...valid,available_at:'2026-09-01T00:10:00Z'});assert.ok(c.blockers.includes('availability_before_measurement'));});
test('one hypothesis never proves causal effect',async()=>{const c=await card(raw,id,{...valid,claim:'causal_effect',hypotheses:['equipment']});assert.ok(c.blockers.includes('causal_effect_not_established'));});
test('one or multiple sites never establish uniformity automatically',async()=>{for(const n of [1,9]){const c=await card(raw,id,{...valid,claim:'wafer_uniformity',measurement_sites:n});assert.ok(c.blockers.includes('wafer_uniformity_not_established'));assert.equal(c.blockers.includes('single_site_cannot_establish_uniformity'),n===1);}});
test('caller cannot inject PASS, approval or unsupported enum',async()=>{for(const a of [{status:'PASS'},{operational_decision:'ADOPT'},{signal_class:'both'},{measurement_sites:0},{hypotheses:[false]}])await assert.rejects(card(raw,id,a));});
test('inputs remain unchanged and exact package linkage is stable',async()=>{const a={...valid,hypotheses:['equipment','measurement']};const before=JSON.stringify(a);const c=await card(raw,id,a);c.declared_annotation.hypotheses.push('data');assert.equal(JSON.stringify(a),before);assert.equal(c.context_package_sha256,(await card(raw,id,a)).context_package_sha256);assert.equal(c.data_role,'synthetic');});

// Same JSON semantics, different source bytes must not share evidence identity.
test('CRLF and LF have distinct exact source hashes', async () => {
  const lf = raw.replace(/\r\n/g, '\n');
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.notEqual(await digest(lf), await digest(crlf));
});

test('submillisecond reversed availability is warned',async()=>{
 const c=await card(raw,id,{...valid,measured_at:'2026-09-01T00:11:00.000999Z',available_at:'2026-09-01T00:11:00.000001Z'});
 assert.ok(c.blockers.includes('availability_before_measurement'));
});
test('one microsecond beyond cutoff is warned',async()=>{
 const c=await card(raw,id,{...valid,available_at:'2026-09-01T00:20:00.000001+00:00'});
 assert.ok(c.blockers.includes('unavailable_at_review_cutoff'));
});
test('measurement beyond cutoff is blocked even without an availability declaration',async()=>{
 const c=await card(raw,id,{signal_class:'FDC',measured_at:'2026-09-01T09:20:00.000001+09:00'});
 assert.deepEqual(c.blockers,['measurement_after_review_cutoff','availability_time_not_declared']);
 assert.equal(c.evidence_verification,'NOT_PERFORMED');
 assert.equal(c.operational_decision,'NOT_MADE');
});
test('different source observation and declared measurement times can describe separate evidence',async()=>{
 const c=await card(raw,id,{signal_class:'FDC',measured_at:p.as_of,available_at:p.as_of});
 assert.equal(c.observation.event_time,p.observations[0].event_time);
 assert.equal(c.declared_annotation.measured_at,p.as_of);
 assert.notEqual(c.observation.event_time,c.declared_annotation.measured_at);
 assert.deepEqual(c.blockers,[]);
});
test('equivalent timezone offsets and fractional trailing zeros stay equal',async()=>{
 const c=await card(raw,id,{...valid,measured_at:'2026-09-01T09:20:00.000000+09:00',available_at:'2026-09-01T00:20:00.000Z'});
 assert.deepEqual(c.blockers,[]);
});
test('fractional precision beyond the Python audit contract is rejected',async()=>{
 await assert.rejects(card(raw,id,{...valid,measured_at:'2026-09-01T00:11:00.1234567Z'}),/6자리/);
});
test('fraction zero, decimal trailing zeros, and pre-epoch instants compare exactly',async()=>{
 for(const [m,a] of [['1969-12-31T23:59:59.5Z','1969-12-31T23:59:59.500000Z'],['2026-09-01T00:11:00Z','2026-09-01T00:11:00.0Z']]) {
  const c=await card(raw,id,{...valid,measured_at:m,available_at:a}); assert.deepEqual(c.blockers,[]);
 }
 const c=await card(raw,id,{...valid,measured_at:'1969-12-31T23:59:59.000999Z',available_at:'1969-12-31T23:59:59.000001Z'});
 assert.ok(c.blockers.includes('availability_before_measurement'));
});
