import {strictJSON,parseDocument,serializeDocument} from './model.mjs';
export const ITEMS=['physical_mapping','process_context','time_and_label','measurement_quality','change_history'];
export const DOCS_SHA='0eb1df1507972f98f188c076e987bf425cd02e35';
export const HANDOFF_URL=`https://github.com/heechan9/fabguard-ai/blob/${DOCS_SHA}/docs/TECHNICAL_HANDOFF_EN.md`;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const exact=(x,keys)=>check(x&&typeof x==='object'&&!Array.isArray(x)&&JSON.stringify(Object.keys(x).sort())===JSON.stringify([...keys].sort()),'Unexpected handoff fields');
export const emptyChecklist=()=>ITEMS.map(id=>({id,state:'unknown',requested_role:'unknown',note:''}));
export function validateChecklist(rows){
 check(Array.isArray(rows)&&rows.length===ITEMS.length,'Incomplete checklist');
 return rows.map((r,i)=>{exact(r,['id','state','requested_role','note']);check(r.id===ITEMS[i],'Checklist identity/order mismatch');check(['unknown','requested','declared_present'].includes(r.state),'Unsupported checklist state');check(['unknown','process','equipment','test_quality','data'].includes(r.requested_role),'Unsupported requested role');check(typeof r.note==='string'&&r.note.length<=500&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/.test(r.note),'Invalid checklist note');check(r.state!=='declared_present'||r.note.trim().length>0,'Declared evidence requires a location or explanation');return {...r};});
}
export function buildPacket(review,checklist,source,sampleId,now=new Date().toISOString()){
 const verified=parseDocument(serializeDocument(review),source,sampleId,{now});
 const rows=validateChecklist(checklist);
 const packet={schema_version:'fabguard-secom-handoff/v1',prepared_at:now,review:verified,checklist:rows,unresolved:rows.filter(r=>r.state!=='declared_present').map(r=>r.id),readiness:'not_validated',authority:'self_declared_unauthenticated',handoff_document:HANDOFF_URL};
 check(Number.isFinite(Date.parse(now))&&new Date(now).toISOString()===now,'Invalid preparation time');serializeDocument(packet);return packet;
}
export function parsePacket(text,source,sampleId,{current=null,now=new Date().toISOString()}={}){
 const packet=strictJSON(text);exact(packet,['schema_version','prepared_at','review','checklist','unresolved','readiness','authority','handoff_document']);
 check(packet.schema_version==='fabguard-secom-handoff/v1'&&packet.readiness==='not_validated'&&packet.authority==='self_declared_unauthenticated'&&packet.handoff_document===HANDOFF_URL,'Unsupported handoff or authority claim');
 check(typeof packet.prepared_at==='string'&&Number.isFinite(Date.parse(packet.prepared_at))&&new Date(packet.prepared_at).toISOString()===packet.prepared_at&&Date.parse(packet.prepared_at)<=Date.parse(now),'Invalid/future preparation time');
 const review=parseDocument(JSON.stringify(packet.review),source,sampleId,{current,now});
 const rebuilt=buildPacket(review,packet.checklist,source,sampleId,packet.prepared_at);
 check(JSON.stringify(packet.unresolved)===JSON.stringify(rebuilt.unresolved),'Unresolved checklist mismatch');return rebuilt;
}
