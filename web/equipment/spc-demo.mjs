import {individuals,scenario} from './spc-model.mjs';
const root=document.getElementById('spc-demo');
const names={within_limits:'관리한계 안',above_limit:'위쪽 이탈',below_limit:'아래쪽 이탈',unknown:'측정 없음 · 판단 보류',baseline_review_required:'기준 구간 검토 필요'};
function render(kind){
  const values=scenario(kind), report=individuals(values);
  root.querySelectorAll('[data-spc]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spc===kind)));
  root.querySelector('#spc-output').hidden=false;
  root.querySelector('#spc-summary').textContent=`고정 관리한계 ${report.lcl.toFixed(2)}–${report.ucl.toFixed(2)} · 중심선 ${report.center.toFixed(2)} · 이후 4건 중 이탈 ${report.statuses.filter(s=>s.endsWith('_limit')).length}건 · 판단 보류 ${report.statuses.filter(s=>s==='unknown').length}건`;
  const svg=root.querySelector('svg');svg.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  function el(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;}
  const x=i=>65+i*45,y=v=>260-(v-85)/30*220;
  el('title',{},'합성 측정값과 고정 관리한계. 1–10번은 기준, 11–14번은 이후 측정.');
  el('rect',{x:45,y:25,width:450,height:240,fill:'#152f38'});
  for(const [v,label] of [[report.ucl,'상한'],[report.center,'중심'],[report.lcl,'하한']]){
    el('line',{x1:45,x2:690,y1:y(v),y2:y(v),stroke:'#e5b855','stroke-dasharray':'6 5'});
    el('text',{x:690,y:y(v)-7,fill:'#e5b855','text-anchor':'end','font-size':14},`${label} ${v.toFixed(2)}`);
  }
  for(let i=1;i<values.length;i++)if(values[i]!==null&&values[i-1]!==null)el('line',{x1:x(i-1),x2:x(i),y1:y(values[i-1]),y2:y(values[i]),stroke:'#8ab8c4','stroke-width':2});
  values.forEach((v,i)=>{
    const status=i<10?'baseline':report.statuses[i-10];
    if(v===null)el('text',{x:x(i),y:258,fill:'#e5b855','text-anchor':'middle','font-size':18},'?');
    else el('circle',{cx:x(i),cy:y(v),r:5,fill:status.endsWith('_limit')?'#ff7a70':'#39d5c4'});
    el('text',{x:x(i),y:282,fill:'#c7d6db','text-anchor':'middle','font-size':13},String(i+1));
  });
  el('text',{x:65,y:18,fill:'#c7d6db','font-size':14},'기준 10건 (고정)');
  el('text',{x:505,y:18,fill:'#c7d6db','font-size':14},'이후 측정 4건');
  const body=root.querySelector('tbody');body.replaceChildren();
  values.slice(10).forEach((v,i)=>{const tr=document.createElement('tr');for(const text of [String(i+11),v===null?'자료 없음':String(v),names[report.statuses[i]]]){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);});
}
root.querySelectorAll('[data-spc]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.spc)));
