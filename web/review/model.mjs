// Source SHA pins existing evidence, not this feature's future commit.
export const SOURCE_SHA = '78a8f61bf8319a5da01f4b2eb81fa6778cd7fde5';
export const CSV_SHA = '73a14b4a64a257f32ddef5924d79f3e6729ba9db6f0c402acdfe0c1708d6c563';
export const SNAPSHOT_SHA = 'e6655814c70bef890231a27497e2610604a6f0e9a000011e9d617c2937b622db';
export const SOURCE_AVAILABLE_AT = '2026-10-31T03:12:35.000Z';
export const MAX_BYTES = 1048576;
const ROW_KEYS = ['sample_id','rank','risk_score','prediction','retrospective_label','model','evidence_scope','measurement_timestamp'];
const SOURCE_KEYS = ['source_repo_sha','priority_table_sha256',...ROW_KEYS,'source_role','analysis_role'];
const FIELD_KEYS = ['reviewer_role','reviewed_at','outcome','proposed_action','rationale','available_evidence','missing_evidence'];
const HISTORY_KEYS = ['revision','recorded_at',...FIELD_KEYS];
const fail = message => { throw new Error(message); };
const require = (condition,message) => { if (!condition) fail(message); };
function keys(value, expected) {
  require(value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value)), 'Expected a plain object');
  const actual=Object.keys(value).sort();
  require(JSON.stringify(actual)===JSON.stringify([...expected].sort()), 'Unexpected or missing fields');
}
function equal(a,b) { return Object.keys(a).length===Object.keys(b).length && Object.keys(a).every(k=>a[k]===b[k]); }
function instant(value) {
  require(typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),'Use canonical UTC ISO time with milliseconds');
  const d=new Date(value); require(Number.isFinite(d.getTime()) && d.toISOString()===value,'Invalid calendar time');return d.getTime();
}
function text(value,max) { require(typeof value==='string' && value.trim().length>0 && value.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/.test(value),'Missing, oversized or invalid text'); }
// Strict JSON parser: rejects duplicate keys, nonfinite values and excessive depth.
export function strictJSON(input) {
  require(typeof input==='string' && new TextEncoder().encode(input).length<=MAX_BYTES,'JSON exceeds 1 MiB');
  let i=0; const space=()=>{while(/[\x20\t\r\n]/.test(input[i]??'!'))i++;};
  function string() {const start=i++;while(i<input.length){if(input[i]==='\\'){i+=2;continue;}if(input[i++]==='"')return JSON.parse(input.slice(start,i));}fail('Unterminated JSON string');}
  function value(depth=0) {
    require(depth<=12,'JSON nesting too deep');space();const c=input[i];
    if(c==='"')return string();
    if(c==='{') {i++;space();const out=Object.create(null),seen=new Set();if(input[i]==='}'){i++;return out;}while(true){space();require(input[i]==='"','Expected JSON key');const k=string();require(!seen.has(k),'Duplicate JSON key');seen.add(k);space();require(input[i++]===':','Expected colon');out[k]=value(depth+1);space();const end=input[i++];if(end==='}')return out;require(end===',','Expected object delimiter');}}
    if(c==='[') {i++;space();const out=[];if(input[i]===']'){i++;return out;}while(true){require(out.length<500,'Too many array items');out.push(value(depth+1));space();const end=input[i++];if(end===']')return out;require(end===',','Expected array delimiter');}}
    for(const [token,result] of [['true',true],['false',false],['null',null]])if(input.startsWith(token,i)){i+=token.length;return result;}
    const match=input.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);require(match,'Invalid JSON value');i+=match[0].length;const n=Number(match[0]);require(Number.isFinite(n),'Nonfinite JSON number');return n;
  }
  const result=value();space();require(i===input.length,'Trailing JSON data');return result;
}
function validateSource(source) {
  keys(source,['source_repo_sha','priority_table_sha256','rows']);require(source.source_repo_sha===SOURCE_SHA && source.priority_table_sha256===CSV_SHA,'Untrusted evidence source');
  require(Array.isArray(source.rows)&&source.rows.length===392,'Incomplete evidence rows');const ids=new Set();
  source.rows.forEach((r,i)=>{keys(r,ROW_KEYS);require(/^secom_\d+$/.test(r.sample_id)&&!ids.has(r.sample_id),'Invalid/duplicate sample');ids.add(r.sample_id);require(r.rank===i+1 && Number.isFinite(r.risk_score)&&r.risk_score>=0&&r.risk_score<=1 && [0,1].includes(r.prediction)&&[0,1].includes(r.retrospective_label),'Invalid evidence values');require(r.model==='random_forest_depth_none_leaf_8'&&r.evidence_scope==='global_model_importance','Unexpected model scope');require(typeof r.measurement_timestamp==='string'&&/^2008-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.measurement_timestamp),'Invalid measurement timestamp');});return source;
}
const trustedSources = new WeakSet();
export async function loadSource(bytes) {
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);require(data.byteLength<=MAX_BYTES,'Oversized source');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');require(digest===SNAPSHOT_SHA,'Evidence byte hash mismatch');
  const source=validateSource(strictJSON(new TextDecoder('utf-8',{fatal:true}).decode(data)));
  source.rows.forEach(Object.freeze);Object.freeze(source.rows);Object.freeze(source);trustedSources.add(source);return source;
}
function evidence(source,sampleId) {require(trustedSources.has(source),'Load and verify bundled source first');const row=source.rows.find(x=>x.sample_id===sampleId);require(row,'Unknown sample ID');return {source_repo_sha:SOURCE_SHA,priority_table_sha256:CSV_SHA,...row,source_role:'observed_public',analysis_role:'offline_retrospective'};}
export function newDocument(source,sampleId) {return {schema_version:'fabguard-secom-offline-review/v1',source:evidence(source,sampleId),history:[]};}
export function serializeDocument(doc) {
  const output=JSON.stringify(doc,null,2)+'\n';
  require(new TextEncoder().encode(output).length<=MAX_BYTES,'Exported JSON would exceed 1 MiB');return output;
}
export function validateDocument(doc,source,sampleId,{now=new Date().toISOString(),current=null}={}) {
  const nowMs=instant(now);keys(doc,['schema_version','source','history']);require(doc.schema_version==='fabguard-secom-offline-review/v1','Unsupported review version');keys(doc.source,SOURCE_KEYS);require(equal(doc.source,evidence(source,sampleId)),'Review evidence mismatch');require(Array.isArray(doc.history)&&doc.history.length<=100,'Invalid revision history');
  let recorded=-Infinity,reviewed=-Infinity;
  doc.history.forEach((item,index)=>{keys(item,HISTORY_KEYS);require(item.revision===index+1,'Revision order mismatch');const at=instant(item.recorded_at),decision=instant(item.reviewed_at);require(at>=recorded&&decision>=reviewed&&decision>=instant(SOURCE_AVAILABLE_AT)&&decision<=at&&at<=nowMs,'Review time ordering/future time violation');recorded=at;reviewed=decision;text(item.reviewer_role,120);for(const k of ['rationale','available_evidence','missing_evidence'])text(item[k],2000);require(['insufficient_evidence','documented_observation'].includes(item.outcome),'Unsupported outcome');require(['hold','request_evidence','reinspect','reference_only'].includes(item.proposed_action),'Unsupported proposed action');require(item.outcome!=='insufficient_evidence'||item.proposed_action!=='reference_only','Insufficient evidence cannot clear a hold');});
  if(current){validateDocument(current,source,sampleId,{now});require(doc.history.length>=current.history.length,'Import would truncate local history');current.history.forEach((r,i)=>require(equal(r,doc.history[i]),'Import would replace local history'));}
  serializeDocument(doc);
  return JSON.parse(JSON.stringify(doc));
}
export function parseDocument(text,source,sampleId,options={}) {return validateDocument(strictJSON(text),source,sampleId,options);}
export function appendRecord(current,fields,source,now=new Date().toISOString()) {
  keys(fields,FIELD_KEYS);const checked=validateDocument(current,source,current.source.sample_id,{now});
  checked.history.push({revision:checked.history.length+1,recorded_at:now,...fields});return validateDocument(checked,source,current.source.sample_id,{now,current});
}
