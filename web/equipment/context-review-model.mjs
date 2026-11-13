export const PACKAGE_SCHEMA='fabguard-context-review/v1';
export const DECISIONS_SCHEMA='fabguard-context-review-decisions/v1';
const states=new Set(['withheld','context_clear']);
const statuses=new Set(['within_limits','above_limit','below_limit','unknown','baseline_review_required']);
const reasons=new Set(['measurement_missing','history_coverage_unverified','change_inside_baseline','change_after_baseline','statistical_baseline_requires_review']);
const outcomes=new Set(['confirmed_issue','false_alarm','insufficient_evidence']);
const actions=new Set(['reinspect','equipment_check','hold','release','no_action']);
const sha=/^[a-f0-9]{64}$/;
const id=/^[a-f0-9]{24}$/;
function timeParts(value){
 const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/);
 if(!match||!Number.isFinite(Date.parse(value)))throw Error('시간대가 있는 유효한 ISO 시각이 필요합니다.');
 const fraction=match[7]??'';
 if(fraction.length>6)throw Error('시각의 소수초는 마이크로초(6자리)까지만 입력하세요.');
 const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number),leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(year<1||month<1||month>12||day<1||day>days[month-1]||hour>23||minute>59||second>59)throw Error('실제 달력에 있는 시각이 필요합니다.');
 const whole=Date.parse(value.slice(0,19)+match[8]);
 const utcYear=new Date(whole).getUTCFullYear();
 if(utcYear<1||utcYear>9999)throw Error('UTC 변환 시각은 0001~9999년 범위여야 합니다.');
 return {whole,fraction};
}
export function stamp(value){timeParts(value);return Date.parse(value);}
function text(value,label,max=2000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+'을 확인하세요.');return value.trim();}
// Use integers before subtracting the chart origin or comparing audit boundaries.
export function epochMicros(value){
 const {whole,fraction}=timeParts(value);
 return BigInt(whole)*1000n+BigInt(fraction.padEnd(6,'0'));
}
export function compareTimes(a,b){return Math.sign(Number(epochMicros(a)-epochMicros(b)));}

export function parsePackage(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>5*1024*1024)throw Error('검토 묶음은 UTF-8 JSON 5MiB 이하여야 합니다.');
 const p=JSON.parse(raw);
 if(!p||p.schema_version!==PACKAGE_SCHEMA||!sha.test(p.source_input_sha256)||!sha.test(p.history_input_sha256)||!['synthetic','observed'].includes(p.data_role))throw Error('검토 묶음 스키마·해시·출처가 잘못됐습니다.');
 stamp(p.as_of); stamp(p.baseline_end);
 const cutoff=p.as_of,base=p.baseline_end;
 if(compareTimes(base,cutoff)>0||!Number.isInteger(p.baseline_count)||p.baseline_count<10)throw Error('기준 구간과 판단 시점을 확인하세요.');
 const limits=p.reference_limits;
 if(!limits||![limits.center,limits.lcl,limits.ucl].every(Number.isFinite)||!(limits.lcl<limits.center&&limits.center<limits.ucl))throw Error('참고 관리한계가 잘못됐습니다.');
 if(!p.stream_dimensions||!p.measurement||typeof p.history_coverage_verified_by_declaration!=='boolean')throw Error('공정·측정 조건이 없습니다.');
 text(p.measurement.name,'측정 항목',120);text(p.measurement.unit,'단위',120);
 for(const key of ['equipment_id','process_step','recipe_id','recipe_version','spec_version'])text(p.stream_dimensions[key],key,120);
 if(!Array.isArray(p.timeline)||p.timeline.length>20000||!Array.isArray(p.observations)||!p.observations.length||p.observations.length>20000||!Array.isArray(p.excluded_other_stream_changes))throw Error('이력·측정 목록이 잘못됐습니다.');
 const changes=new Set();
 for(const e of p.timeline){
  text(e.change_id,'변경 ID',120);text(e.description,'변경 설명');
  if(changes.has(e.change_id)||!['maintenance','calibration','recipe_change'].includes(e.kind)||!['before_baseline','baseline','monitoring','scheduled'].includes(e.period)||e.equipment_id!==p.stream_dimensions.equipment_id||e.process_step!==p.stream_dimensions.process_step)throw Error('변경 범위·종류·중복 ID를 확인하세요.');
  stamp(e.effective_at);if(compareTimes(e.available_at,cutoff)>0)throw Error('판단 시점 이후의 변경 정보입니다.');changes.add(e.change_id);
 }
 if(p.queue?.schema_version!=='fabguard-manufacturing-review-queue/v1'||p.queue.source_input_sha256!==p.source_input_sha256||!Array.isArray(p.queue.items)||p.queue.items.length!==p.observations.length)throw Error('검토 목록 연결이 잘못됐습니다.');
 const queue=new Map();for(const item of p.queue.items){if(!id.test(item.review_id)||queue.has(item.review_id)||!sha.test(item.event_evidence_sha256))throw Error('검토 ID 또는 증거 해시를 확인하세요.');queue.set(item.review_id,item);}
 let previous=base;const seen=new Set();
 for(const row of p.observations){
  stamp(row.event_time); const at=row.event_time,item=queue.get(row.review_id);
  if(!id.test(row.review_id)||seen.has(row.review_id)||!item||compareTimes(at,previous)<=0||compareTimes(at,cutoff)>0||!states.has(row.context_state)||!statuses.has(row.reference_status)||!(row.value===null||Number.isFinite(row.value)))throw Error('측정 순서·상태·값·검토 ID가 잘못됐습니다.');
  if(!Array.isArray(row.reasons)||row.reasons.some(r=>!reasons.has(r))||(row.context_state==='withheld')!==(row.reasons.length>0)||!Array.isArray(row.related_changes)||row.related_changes.some(c=>!changes.has(c)))throw Error('판단 보류 근거가 잘못됐습니다.');
  if(item.event_time!==row.event_time||item.value!==row.value||item.screening_status!==row.reference_status||item.sample_id!==row.sample_id||item.measurement!==row.measurement||item.unit!==row.unit||JSON.stringify(item.trace)!==JSON.stringify(row.trace))throw Error('측정과 검토 목록의 증거가 다릅니다.');
  if(!p.history_coverage_verified_by_declaration&&!row.reasons.includes('history_coverage_unverified'))throw Error('이력 범위 부족의 보류 사유가 없습니다.');
  previous=at;seen.add(row.review_id);
 }
 return p;
}
export async function digest(raw){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function reviewDecision(p,fields,now=Date.now()){
 const row=p.observations.find(r=>r.review_id===fields.review_id);
 if(!row||!outcomes.has(fields.outcome)||!actions.has(fields.action))throw Error('검토 대상·결과·후속 제안을 확인하세요.');
 const {whole,fraction}=timeParts(fields.decided_at);
 if(compareTimes(fields.decided_at,p.as_of)<0||compareTimes(fields.decided_at,new Date(now).toISOString())>0)throw Error('검토 시각은 묶음의 판단 시점 이후이며 현재 시각 이하여야 합니다.');
 if(row.context_state==='withheld'&&(fields.outcome!=='insufficient_evidence'||!['hold','equipment_check','reinspect'].includes(fields.action)))throw Error('판단 보류 항목은 해제·해결 처리할 수 없습니다.');
 return {review_id:fields.review_id,reviewer_role:text(fields.reviewer_role,'검토 역할',120),decided_at:new Date(whole).toISOString().slice(0,19)+'.'+fraction.padEnd(3,'0')+'Z',outcome:fields.outcome,action:fields.action,rationale:text(fields.rationale,'검토 이유')};
}
export function exportDecisions(p,packageHash,decisions,now=Date.now()){
 if(!sha.test(packageHash)||!Array.isArray(decisions)||!decisions.length)throw Error('검토 초안이 없습니다.');
 const seen=new Set();const checked=decisions.map(d=>{const x=reviewDecision(p,d,now);if(seen.has(x.review_id))throw Error('중복 검토 ID입니다.');seen.add(x.review_id);return x;});
 return {schema_version:DECISIONS_SCHEMA,context_package_sha256:packageHash,decisions:checked};
}
