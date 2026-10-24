import {parsePackage,digest,reviewDecision,exportDecisions} from './context-review-model.mjs';
const $=id=>document.getElementById(id);
let current=null,packageHash='',generation=0;const drafts=new Map();
const labels={within_limits:'참고: 관리범위 안',above_limit:'참고: 위쪽 이탈',below_limit:'참고: 아래쪽 이탈',unknown:'측정값 없음',baseline_review_required:'통계 기준선 검토 필요'};
const reasonLabels={measurement_missing:'측정값 없음 · 판단 보류',history_coverage_unverified:'이력 범위·완전성 미확인',change_inside_baseline:'기준 구간 안에 조건 변경',change_after_baseline:'기준 구간 뒤 조건 변경',statistical_baseline_requires_review:'통계 기준선 자체 재확인 필요'};
const kinds={maintenance:'정비',calibration:'교정',recipe_change:'레시피 변경'},periods={before_baseline:'기준 구간 전',baseline:'기준 구간 안',monitoring:'이후 측정 구간',scheduled:'측정 구간 뒤 예정'};
function node(tag,value,parent){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function error(e){$('context-error').textContent=e.message||String(e);$('context-error').focus();}
function count(){ $('review-count').textContent=current?`초안 ${drafts.size}건 · 미작성 pending ${current.observations.length-drafts.size}건`:'검토 초안 없음';$('review-export').disabled=!current||drafts.size===0; }
function clear(){generation++;current=null;packageHash='';drafts.clear();$('context-view').hidden=true;$('context-form').hidden=true;$('context-error').textContent='';$('context-status').textContent='파일과 검토 초안을 지웠습니다.';$('review-reason').value='';$('review-role').value='';$('review-time').value='';count();return generation;}
function svg(tag,attrs,value){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(value!==undefined)el.textContent=value;$('context-chart').append(el);}
function chart(p){
 $('context-chart').replaceChildren();const rows=p.observations,limits=p.reference_limits;
 const first=Date.parse(rows[0].event_time),last=Date.parse(rows.at(-1).event_time),span=Math.max(1,last-first);
 const values=[limits.lcl,limits.ucl,...rows.map(r=>r.value).filter(Number.isFinite)];const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
 const x=t=>75+750*(t-first)/span,y=v=>225-170*(v-min)/range;
 for(const [key,color] of [['lcl','#e8aa4e'],['center','#9bc7c7'],['ucl','#e8aa4e']]){svg('line',{x1:75,x2:825,y1:y(limits[key]),y2:y(limits[key]),stroke:color,'stroke-dasharray':'7 5'});svg('text',{x:8,y:y(limits[key])+4,fill:color,'font-size':13},`${key} ${limits[key].toFixed(2)}`);}
 for(const e of p.timeline){const at=Date.parse(e.effective_at);if(at>=first&&at<=last){svg('line',{x1:x(at),x2:x(at),y1:35,y2:235,stroke:'#f49f51'});svg('text',{x:x(at)+4,y:30,fill:'#f49f51','font-size':13},e.change_id);}}
 for(const r of rows){const px=x(Date.parse(r.event_time));if(r.value===null)svg('text',{x:px,y:150,fill:'#f4cf82','font-size':22},'?');else svg('circle',{cx:px,cy:y(r.value),r:5,fill:r.context_state==='withheld'?'#f4ad61':'#54d9c0'});}
 svg('text',{x:75,y:263,fill:'#c7d7df','font-size':13},rows[0].event_time);svg('text',{x:825,y:263,'text-anchor':'end',fill:'#c7d7df','font-size':13},rows.at(-1).event_time);
}
function syncTarget(){
 const row=current.observations.find(r=>r.review_id===$('review-target').value),saved=drafts.get(row.review_id),held=row.context_state==='withheld';
 for(const o of $('review-outcome').options)o.disabled=held&&o.value!=='insufficient_evidence';
 for(const o of $('review-action').options)o.disabled=held&&['release','no_action'].includes(o.value);
 $('review-outcome').value=saved?.outcome||'insufficient_evidence';$('review-action').value=saved?.action||'hold';$('review-reason').value=saved?.rationale||'';$('review-time').value=saved?.decided_at||new Date().toISOString();if(saved)$('review-role').value=saved.reviewer_role;
}
function render(p){
 $('context-view').hidden=false;$('context-form').hidden=false;
 $('context-source').textContent=`${p.data_role==='synthetic'?'설명용 합성 자료':'사용자 선언 관측 자료 · 진위 미확인'} · ${p.stream_dimensions.equipment_id} · ${p.stream_dimensions.process_step} · ${p.measurement.name} (${p.measurement.unit}) · 판단 정보 시점 ${p.as_of}`;
 $('context-reference').textContent=`앞 ${p.baseline_count}건으로 고정한 참고 기준 · 종료 ${p.baseline_end} · 중심 ${p.reference_limits.center.toFixed(4)}, 하한 ${p.reference_limits.lcl.toFixed(4)}, 상한 ${p.reference_limits.ucl.toFixed(4)}. 원본·이력의 출처와 완전성은 사용자 선언이며 인증되지 않았습니다.`;
 $('context-history').replaceChildren();for(const e of p.timeline){const tr=node('tr','',$('context-history'));for(const v of [`${e.change_id} · ${kinds[e.kind]}`,e.effective_at,e.available_at,`${periods[e.period]} · ${e.description}`])node('td',v,tr);}if(!p.timeline.length){const tr=node('tr','',$('context-history'));node('td','해당 장비·공정의 선언된 변경 없음. 이력의 실제 완전성을 증명하지 않습니다.',tr).colSpan=4;}
 $('context-excluded').textContent=`다른 장비·공정으로 연결하지 않은 이력 ${p.excluded_other_stream_changes.length}건: ${p.excluded_other_stream_changes.join(', ')||'없음'}`;
 $('context-observations').replaceChildren();$('review-target').replaceChildren();for(const r of p.observations){const tr=node('tr','',$('context-observations'));for(const v of [`${r.event_time} · ${r.value===null?'결측':r.value+' '+r.unit}`,labels[r.reference_status],r.context_state==='withheld'?'판단 보류':'선언된 조건 충돌 없음 · 품질 보장 아님',[...r.reasons.map(x=>reasonLabels[x]),...r.related_changes].join(' / ')||'없음'])node('td',v,tr);const option=node('option',`${r.trace.unit_id} · ${r.event_time} · ${r.context_state==='withheld'?'보류':'조건 검토'}`,$('review-target'));option.value=r.review_id;}
 chart(p);syncTarget();count();
}
async function load(raw,token){try{const parsed=parsePackage(raw),hash=await digest(raw);if(token!==generation)return;current=parsed;packageHash=hash;render(parsed);$('context-status').textContent=`${parsed.observations.length}개 측정의 검토 묶음을 열었습니다. 원본 CLI 재검증 전 표시·초안입니다. 묶음 SHA-256 ${hash}`;}catch(e){if(token===generation){clear();error(e);}}}
$('context-file').addEventListener('change',async event=>{const token=clear(),file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024){error(Error('파일은 5MiB 이하여야 합니다.'));return;}try{const bytes=await file.arrayBuffer();await load(new TextDecoder('utf-8',{fatal:true}).decode(bytes),token);}catch(e){if(token===generation)error(e);}});
$('context-clear').addEventListener('click',()=>{clear();$('context-file').value='';});
$('context-example').addEventListener('click',async()=>{const token=clear();$('context-file').value='';try{const response=await fetch('./data/maintenance-synthetic.json');if(!response.ok)throw Error('합성 예제를 열지 못했습니다.');await load(await response.text(),token);}catch(e){if(token===generation)error(e);}});
$('review-target').addEventListener('change',()=>{if(current)syncTarget();});
$('review-add').addEventListener('click',()=>{try{if(!current)throw Error('먼저 묶음을 여세요.');const fields={review_id:$('review-target').value,reviewer_role:$('review-role').value,decided_at:$('review-time').value,outcome:$('review-outcome').value,action:$('review-action').value,rationale:$('review-reason').value};const decision=reviewDecision(current,fields);drafts.set(decision.review_id,decision);$('context-error').textContent='';count();}catch(e){error(e);}});
$('review-remove').addEventListener('click',()=>{if(current){drafts.delete($('review-target').value);syncTarget();count();}});
$('review-export').addEventListener('click',()=>{try{const result=exportDecisions(current,packageHash,[...drafts.values()]),url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='context-review-decisions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('context-status').textContent='검토 초안 JSON을 내려받았습니다. 원본·이력과 함께 CLI에서 재검증하세요.';}catch(e){error(e);}});
count();
