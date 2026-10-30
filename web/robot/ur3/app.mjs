import {validateDataset,rowState,tracePoints,nextRecord,SENSOR_INDICES,COLUMNS,GAP_SECONDS} from './core.mjs';
import {DATA_SHA256} from './data-hash.mjs';
const $=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
let data=null,index=0,timer=null;
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
const fmt=value=>value===null?'결측 (null)':Number(value).toPrecision(7);
const recorded=value=>value===null?'결측 (판단 불가)':value?'True · 원본에 기록됨':'False · 해당 행의 원본 값';
function svg(tag,attrs={}){const e=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
function pause(message='일시정지'){clearInterval(timer);timer=null;$('play-status').textContent=message;}
function draw(points,sensor){
 const width=Math.max(240,$('chart').clientWidth),left=92;
 const gaps=points.slice(1).filter(p=>p.breakBefore).map(p=>{
  const previous=points.find(q=>q.index===p.index-1);return (p.time-previous.time)/1000;
 });
 const gapText=`표시 구간 ${points.length}행 · 시간 공백 ${gaps.length}곳`+(gaps.length?` · 최대 ${Math.max(...gaps).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})}초. 공백을 압축하거나 선으로 연결하지 않습니다.`:' · 선택 구간 내 5초 초과 공백 없음.');
 if($('chart-quality').textContent!==gapText)$('chart-quality').textContent=gapText;
 const plot=svg('svg',{viewBox:`0 0 ${width} 220`,role:'img','aria-label':`${COLUMNS[sensor]} 실제 기록. 결측·5초 초과 시간 공백에서 선을 끊음. 예측 아님`});
 const finite=points.filter(p=>p.value!==null);
 if(!finite.length){const t=svg('text',{x:20,y:100});t.textContent='이 구간의 선택 센서가 모두 결측입니다.';plot.append(t);$('chart').replaceChildren(plot);return;}
 const min=Math.min(...finite.map(p=>p.value)),max=Math.max(...finite.map(p=>p.value)),range=max-min||1;
 const start=points[0].time,end=points.at(-1).time;
 const x=t=>left+(t-start)/Math.max(1,end-start)*(width-left-12),y=v=>180-(v-min)/range*145;
 let path='',pen=false;
 points.forEach((p,i)=>{
  if(p.breakBefore&&i){plot.append(svg('rect',{x:x(points[i-1].time),y:20,width:Math.max(1,x(p.time)-x(points[i-1].time)),height:165,class:'gap'}));pen=false;}
  if(p.value===null){plot.append(svg('rect',{x:x(p.time)-2,y:185,width:4,height:7,class:'missing'}));pen=false;return;}
  path+=`${pen?'L':'M'}${x(p.time).toFixed(2)},${y(p.value).toFixed(2)} `;pen=true;
 });
 plot.append(svg('path',{d:path}));
 const last=points.at(-1);if(last.value!==null)plot.append(svg('circle',{cx:x(last.time),cy:y(last.value),r:4,fill:'#ffd383'}));
 for(const [value,xx,yy,anchor] of [[Number(max).toPrecision(5),left-8,25,'end'],[Number(min).toPrecision(5),left-8,182,'end'],[new Date(start).toISOString().slice(11,23)+' UTC',3,212,'start'],[new Date(end).toISOString().slice(11,23)+' UTC',width-3,212,'end']]){const t=svg('text',{x:xx,y:yy,'text-anchor':anchor});t.textContent=value;plot.append(t);}
 $('chart').replaceChildren(plot);
}
function render(){
 if(!data)return;
 const sensor=Number($('sensor').value),state=rowState(data.rows,index,sensor),row=state.row;
 $('position').value=index;$('position').setAttribute('aria-valuetext',`${index+1}행`);
 $('current-time').textContent=`원본 ${index+1} / ${data.rows.length}행 · Num ${row[0]} · ${row[1]} · cycle ${row[21]}`;
 const parts=[state.missing?'선택 센서 결측 — 보간하지 않음':'선택 센서 값 있음'];
 if(state.anySensorMissing)parts.push('다른 센서를 포함해 결측 있음');
 if(state.gap)parts.push(`시간 공백: 직전 기록과 ${state.gap.toFixed(3)}초 차이`);
 if(state.cycleDecrease)parts.push('cycle 번호 감소 — 독립 세션으로 확정하지 않음');
 const quality=parts.join(' / ');
 if($('current-quality').textContent!==quality)$('current-quality').textContent=quality;
 $('recorded-events').replaceChildren(text('p',`Robot_ProtectiveStop: ${recorded(state.protectiveStop)}`),text('p',`grip_lost: ${recorded(state.gripLost)}`));
 $('sensor-values').replaceChildren(...SENSOR_INDICES.map(i=>{const tr=document.createElement('tr'),th=text('th',COLUMNS[i]);th.scope='row';tr.append(th,text('td',fmt(row[i])));return tr;}));
 draw(tracePoints(data.rows,index,sensor),sensor);
 $('previous').disabled=index===0;$('next').disabled=index===data.rows.length-1;
}
function move(next){if(!data)return;pause();index=Math.max(0,Math.min(data.rows.length-1,next));render();}
$('play').addEventListener('click',()=>{
 if(!data||timer)return;
 if(index===data.rows.length-1){pause('기록 끝 · 처음으로 버튼으로 돌아갈 수 있습니다.');return;}
 $('play-status').textContent='기록 재생 중 · 1행/초';
 timer=setInterval(()=>{
  index++;render();
  if(rowState(data.rows,index,Number($('sensor').value)).gap)pause(`시간 공백 직후 자동 일시정지 · 표시 기준 ${GAP_SECONDS}초 초과`);
  else if(index===data.rows.length-1)pause('기록 끝 · 일시정지');
 },1000);
});
$('pause').addEventListener('click',()=>pause());$('reset').addEventListener('click',()=>move(0));
$('previous').addEventListener('click',()=>move(index-1));$('next').addEventListener('click',()=>move(index+1));
$('position').addEventListener('input',()=>move(Number($('position').value)));
$('sensor').addEventListener('change',()=>{pause();render();});
document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{
 if(!data)return;const next=nextRecord(data.rows,index,button.dataset.jump);
 if(next===null){pause('이후 해당 기록 없음 · 정상이나 고장 없음 판정이 아닙니다.');return;}move(next);
}));
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)pause('동작 줄이기 설정 변경 · 일시정지');});
window.addEventListener('pagehide',()=>pause());
async function load(){
 try{
  const response=await fetch(new URL('./data.json',import.meta.url));if(!response.ok)throw Error(`데이터 파일을 읽지 못했습니다 (HTTP ${response.status}).`);
  const bytes=await response.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw Error('파일 크기 제한 초과');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==DATA_SHA256)throw Error('데이터 해시 불일치 — 손상된 파일을 표시하지 않습니다.');
  data=validateDataset(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  $('data-hash').textContent=`화면 JSON SHA-256 ${hash} · 배포 JSON이 빌드 기록 해시와 일치 (원본 ZIP/XLSX 결속은 빌더·CI에서 별도 확인, 수집 장비 인증은 아님)`;
  const a=data.audit;
  $('quality-summary').replaceChildren(text('p',`${a.rows.toLocaleString('ko-KR')}행 · ${a.columns}열 · 중앙 기록 간격 ${a.median_interval_s}초 · 센서 결측 ${a.sensor_missing_rows}행 · 시간 공백 ${a.gaps.length}곳`),text('p',`cycle 고유 값 ${a.cycle_unique_values}개 / 반복 행 ${a.cycle_repeat_rows}개 / 감소 ${a.cycle_decreases.length}곳. 반복 cycle은 삭제하지 않습니다.`),text('p',`보호 정지 True ${a.recorded_protective_stop_true_rows}행 / 그립 손실 True ${a.recorded_grip_lost_true_rows}행 — 이벤트 건수·예측 결과 아님`));
  $('quality-summary').hidden=false;
  for(const i of SENSOR_INDICES){const option=text('option',COLUMNS[i]);option.value=i;$('sensor').append(option);}
  document.querySelectorAll('main button,main select,main input').forEach(e=>e.disabled=false);
  $('load-status').textContent='저장된 UR3 기록 확인 완료 · 예측 성능 미평가';$('load-status').dataset.status='ready';
  pause();render();
 }catch(error){
  data=null;pause('데이터 표시 보류');$('quality-summary').hidden=true;$('chart').replaceChildren();$('chart-quality').textContent='';$('sensor-values').replaceChildren();
  document.querySelectorAll('main button,main select,main input').forEach(e=>e.disabled=true);
  $('load-status').textContent='데이터 표시 보류 · 값 없음은 정상 판정이 아닙니다.';$('load-status').dataset.status='withheld';
  $('load-error').hidden=false;$('load-error').textContent=`파일 누락·손상·형식 오류를 확인하세요. ${error.message}`;
 }
}
load();
