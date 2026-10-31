import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {loadSource,newDocument,appendRecord,validateDocument,parseDocument,strictJSON,MAX_BYTES} from '../../web/review/model.mjs';
globalThis.crypto??=webcrypto;
const bytes=readFileSync(new URL('../../web/review/source.json',import.meta.url));
const source=await loadSource(bytes),id='secom_1397',now='2026-10-31T04:30:00.000Z';
const fresh=()=>newDocument(source,id);
const fields=()=>({reviewer_role:'Self-declared reader',reviewed_at:'2026-10-31T04:29:00.000Z',outcome:'insufficient_evidence',proposed_action:'request_evidence',rationale:'No sensor map; do not infer cause.',available_evidence:'Saved public score',missing_evidence:'Physical sensor mapping and process history'});
const first=()=>appendRecord(fresh(),fields(),source,now);
test('source bytes are pinned; real rank one is not a failure verdict',async()=>{
 assert.equal(source.rows.length,392);assert.equal(fresh().source.retrospective_label,0);assert.equal(fresh().source.rank,1);assert.equal(fresh().source.risk_score,0.28177356090705113);assert.equal(newDocument(source,'secom_1363').source.retrospective_label,1);
 await assert.rejects(loadSource(Buffer.concat([bytes,Buffer.from(' ')])));assert.throws(()=>newDocument(JSON.parse(bytes),id));assert.throws(()=>newDocument(source,'unknown'));assert.throws(()=>{source.rows[0].rank=2});
});
test('full export/reimport round trip and consecutive appended history',()=>{
 const a=first(),b=appendRecord(a,{...fields(),reviewed_at:now},source,'2026-10-31T04:31:00.000Z');
 assert.deepEqual(parseDocument(JSON.stringify(b),source,id,{now:'2026-10-31T04:32:00.000Z',current:a}),b);assert.equal(b.history.length,2);assert.equal(a.history.length,1);assert.deepEqual(fresh().history,[]);
});
test('tampered evidence/hash/id/scope/label/score rejected against trusted source',()=>{
 for(const [key,value] of Object.entries({source_repo_sha:'a'.repeat(40),priority_table_sha256:'b'.repeat(64),sample_id:'secom_1363',rank:2,risk_score:0.99,retrospective_label:1,prediction:1,model:'other',analysis_role:'live',source_role:'synthetic',evidence_scope:'local_cause'})){
 const d=first();d.source[key]=value;assert.throws(()=>validateDocument(d,source,id,{now}));}
});
test('unknown keys, revision/order/version and prohibited outcomes fail closed',()=>{
 const mutations=[d=>d.extra=1,d=>d.source.extra=1,d=>d.schema_version='v2',d=>d.history[0].extra=1,d=>d.history[0].revision=2,d=>d.history.push(d.history[0]),d=>d.history[0].outcome='approved',d=>d.history[0].proposed_action='release',d=>d.history[0].proposed_action='reference_only'];
 for(const mutate of mutations){const d=first();mutate(d);assert.throws(()=>validateDocument(d,source,id,{now}));}
});
test('strict duplicate-key/unsafe JSON/nesting and byte limits',()=>{
 for(const raw of ['{"x":1,"x":2}','{"x":{"y":1,"y":2}}','{"x":1e999}','[01]','{"x":NaN}','{"x":true,}','[] trailing','['.repeat(15)+']'.repeat(15),'"'+'x'.repeat(MAX_BYTES)+'"'])assert.throws(()=>strictJSON(raw));
 assert.equal(strictJSON('{"x":"quote\\\"slash\\\\"}').x,'quote"slash\\');assert.throws(()=>parseDocument('{"__proto__":{}}',source,id,{now}));
});
test('calendar, timezone, source availability, future and reversed time rejected',()=>{
 for(const reviewed_at of ['2026-02-30T04:00:00.000Z','2026-10-31T04:29:00','2026-10-31T04:29:00+00:00','2026-10-31T03:00:00.000Z','2026-10-31T04:31:00.000Z'])assert.throws(()=>appendRecord(fresh(),{...fields(),reviewed_at},source,now));
 const a=first();assert.throws(()=>appendRecord(a,{...fields(),reviewed_at:'2026-10-31T04:28:00.000Z'},source,'2026-10-31T04:32:00.000Z'));
 assert.throws(()=>validateDocument(a,source,id,{now:'2026-10-31T04:29:59.999Z'}));
});
test('old/divergent imports cannot truncate or overwrite existing revisions',()=>{
 const a=first(),b=appendRecord(a,{...fields(),rationale:'Second note'},source,now),before=JSON.stringify(b);
 assert.throws(()=>validateDocument(a,source,id,{now,current:b}));const bad=structuredClone(b);bad.history[0].rationale='Edited past';assert.throws(()=>validateDocument(bad,source,id,{now,current:b}));assert.equal(JSON.stringify(b),before);
});
test('bounded required free text and max100 revisions; text is retained not executed',()=>{
 for(const patch of [{reviewer_role:''},{rationale:' '},{available_evidence:''},{missing_evidence:''},{rationale:'a'.repeat(2001)},{rationale:'\u0000'}])assert.throws(()=>appendRecord(fresh(),{...fields(),...patch},source,now));
 const d=appendRecord(fresh(),{...fields(),rationale:'<img src=x onerror=alert(1)>'},source,now);assert.equal(d.history[0].rationale,'<img src=x onerror=alert(1)>');
 let doc=fresh();for(let i=0;i<100;i++)doc=appendRecord(doc,fields(),source,now);assert.throws(()=>appendRecord(doc,fields(),source,now));
});
test('snapshot reconstructs byte-exactly from original saved CSV without inference',async()=>{
 const {execFileSync}=await import('node:child_process');
 const output=execFileSync('python',['scripts/build_secom_review_source.py'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
 assert.match(output,/matches all 392 saved rows/);
});
test('UI only translates enum fields, never authored text matching enum tokens',()=>{
 const app=readFileSync(new URL('../../web/review/app.mjs',import.meta.url),'utf8');
 assert.match(app,/\['outcome','proposed_action'\]\.includes\(key\) && enums\[entry\[key\]\]/);
 const d=appendRecord(fresh(),{...fields(),reviewer_role:'reference_only',rationale:'hold'},source,now);
 assert.equal(d.history[0].reviewer_role,'reference_only');assert.equal(d.history[0].rationale,'hold');
});
