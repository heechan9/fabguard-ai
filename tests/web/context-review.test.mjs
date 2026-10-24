import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {parsePackage,digest,reviewDecision,exportDecisions} from '../../web/equipment/context-review-model.mjs';
globalThis.crypto??=webcrypto;
const raw=readFileSync(new URL('../../web/equipment/data/maintenance-synthetic.json',import.meta.url),'utf8');
const copy=()=>JSON.parse(raw),now=Date.parse('2026-09-01T00:22:00Z');
function fields(p,index=1){return {review_id:p.observations[index].review_id,reviewer_role:'공정 담당',decided_at:'2026-09-01T00:21:00Z',outcome:'insufficient_evidence',action:'hold',rationale:'정비 이력과 기준선 재확인 필요'};}
test('generated Python package retains normal/held/missing reference evidence',()=>{
 const p=parsePackage(raw);assert.deepEqual(p.observations.map(r=>r.context_state),['context_clear','withheld','withheld']);assert.equal(p.observations[2].reference_status,'unknown');assert.equal(p.timeline[0].kind,'maintenance');
});
test('browser blocks invalid IDs, empty rationale, future/past decisions and held release',()=>{
 const p=parsePackage(raw),f=fields(p);
 for(const patch of [{review_id:'unknown'},{rationale:' '},{reviewer_role:''},{action:'release'},{outcome:'false_alarm'},{decided_at:'2026-09-01T00:19:00Z'},{decided_at:'2026-09-01T00:23:00Z'},{decided_at:'2026-09-01T00:21:00'},{decided_at:'2026-02-30T00:21:00Z'}])assert.throws(()=>reviewDecision(p,{...f,...patch},now));
 assert.equal(reviewDecision(p,f,now).action,'hold');
});
test('export binds exact UTF-8 bytes and refuses duplicate or empty decisions',async()=>{
 const p=parsePackage(raw),hash=await digest(raw),f=fields(p);
 assert.notEqual(hash,await digest(raw+' '));assert.equal(exportDecisions(p,hash,[f],now).context_package_sha256,hash);
 assert.throws(()=>exportDecisions(p,hash,[f,f],now));assert.throws(()=>exportDecisions(p,hash,[],now));
});
test('invalid shape, scope, chronology and mismatched queue fail closed',()=>{
 for(const mutate of [p=>p.source_input_sha256='bad',p=>p.timeline[0].equipment_id='OTHER',p=>p.observations[1].event_time=p.observations[0].event_time,p=>p.queue.items[1].value=0,p=>p.observations[1].context_state='context_clear',p=>p.history_coverage_verified_by_declaration=false,p=>p.observations[0].value=Infinity,p=>p.observations.push(p.observations[0])]){const p=copy();mutate(p);assert.throws(()=>parsePackage(JSON.stringify(p)));}
 assert.throws(()=>parsePackage('[]'));assert.throws(()=>parsePackage('{bad json'));
});
test('a condition-clear row still needs a complete explicit reviewer decision',()=>{
 const p=parsePackage(raw),f={...fields(p,0),outcome:'false_alarm',action:'no_action'};
 assert.equal(reviewDecision(p,f,now).review_id,p.observations[0].review_id);
 assert.throws(()=>reviewDecision(p,{...f,rationale:''},now));
});
