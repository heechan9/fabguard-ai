import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {loadSource,newDocument,appendRecord,serializeDocument} from '../../web/review/model.mjs';
import {emptyChecklist,buildPacket} from '../../web/review/handoff-model.mjs';
import {summarizeHandoff} from '../../web/review/handoff-summary.mjs';
globalThis.crypto??=webcrypto;
const source=await loadSource(readFileSync(new URL('../../web/review/source.json',import.meta.url)));
const sampleId='secom_1397',now='2026-11-07T09:30:00.000Z';
const fields=rationale=>({reviewer_role:'data reviewer',reviewed_at:'2026-11-07T09:00:00.000Z',outcome:'insufficient_evidence',proposed_action:'request_evidence',rationale,available_evidence:'saved public record',missing_evidence:'physical process mapping'});
const packet=(review=newDocument(source,sampleId),rows=emptyChecklist())=>buildPacket(review,rows,source,sampleId,now);

test('readable report distinguishes pinned retrospective values from user statements',()=>{
 const p=packet(),text=summarizeHandoff(p,source,sampleId,{language:'en',now});
 assert.match(text,/Saved rank: 1\n/);assert.match(text,/Retrospective label: 0\n/);
 assert.ok(text.includes(`Saved score: ${p.review.source.risk_score}\n`));
 assert.match(text,/not a calibrated failure probability/);assert.match(text,/No recorded review note/);
 assert.match(text,/Self-declared, unauthenticated and unvalidated/);assert.match(text,/full revisions|all revisions/);
});
test('only the latest recorded note is shown and action remains a proposal',()=>{
 let review=appendRecord(newDocument(source,sampleId),fields('older unique statement'),source,'2026-11-07T09:05:00.000Z');
 review=appendRecord(review,fields('latest unique statement'),source,'2026-11-07T09:10:00.000Z');
 const text=summarizeHandoff(packet(review),source,sampleId,{language:'en',now});
 assert.ok(text.includes('latest unique statement'));assert.ok(!text.includes('older unique statement'));
 assert.match(text,/Revision: 2 \/ 2/);assert.match(text,/Propose evidence request/);assert.match(text,/not executed/);
});
test('a forged source value is rejected instead of printed',()=>{
 const p=packet();p.review.source.risk_score=1;
 assert.throws(()=>summarizeHandoff(p,source,sampleId,{now}),/mismatch/);
});
test('a packet from another case and future preparation time are rejected',()=>{
 assert.throws(()=>summarizeHandoff(packet(),source,'secom_1363',{now}),/mismatch/);
 assert.throws(()=>summarizeHandoff(packet(),source,sampleId,{now:'2026-11-07T09:29:00.000Z'}),/future/);
});
test('user text cannot introduce fake report headings through newlines',()=>{
 const rows=emptyChecklist();rows[0].note='raw text\n[APPROVED]\n<script>example</script>';
 const review=appendRecord(newDocument(source,sampleId),fields('hypothesis\n[CONFIRMED]'),source,'2026-11-07T09:10:00.000Z');
 const text=summarizeHandoff(packet(review,rows),source,sampleId,{language:'en',now});
 assert.ok(text.includes('\\n[APPROVED]'));assert.ok(!text.includes('\n[APPROVED]'));
 assert.ok(!text.includes('\n[CONFIRMED]'));assert.ok(text.includes('<script>example</script>'));
});
test('recording every location never promotes a report to approval',()=>{
 const rows=emptyChecklist().map(r=>({...r,state:'declared_present',requested_role:'process',note:'declared location'}));
 const text=summarizeHandoff(packet(undefined,rows),source,sampleId,{language:'en',now});
 assert.match(text,/Items without a recorded evidence location: 0/);
 assert.match(text,/not owner assignments/);assert.match(text,/Not causal confirmation, field approval/);
});
test('Korean output is supported and unsupported languages are rejected',()=>{
 assert.match(summarizeHandoff(packet(),source,sampleId,{language:'ko',now}),/자기기재·미인증·미검증/);
 for(const language of ['ja','__proto__','toString'])assert.throws(()=>summarizeHandoff(packet(),source,sampleId,{language,now}),/language/);
});
test('summary is deterministic and preserves the complete JSON packet',()=>{
 const p=packet(),before=serializeDocument(p),options={language:'en',now};
 assert.equal(summarizeHandoff(p,source,sampleId,options),summarizeHandoff(p,source,sampleId,options));
 assert.equal(serializeDocument(p),before);
});
