import {budgetView} from './review-budget-core.mjs';
// Separate optional presentation control: failure must not stop existing routes.
let budget=50;
const evidence=fetch('/data/priority_top50.json').then(r=>{if(!r.ok)throw Error('Saved evidence unavailable');return r.json();}).then(r=>{budgetView(r,50);return {records:r};}).catch(()=>({records:null}));
function mount(){
 const app=document.querySelector('#app'),table=app?.querySelector('.table-shell table');
 if(!table || app.querySelector('#review-budget-panel'))return;
 const en=document.documentElement.lang==='en';
 const panel=document.createElement('section');panel.id='review-budget-panel';panel.className='review-budget-panel';
 panel.innerHTML=`<h2>${en?'Choose a review budget':'점검할 건수를 골라보세요'}</h2><label for="review-budget">${en?'Records to show from the saved top50':'저장된 상위 50건에서 볼 건수'}</label> <select id="review-budget" disabled><option value="20">20</option><option value="40">40</option><option value="50">50</option></select> <button id="review-budget-reset" type="button" disabled>${en?'Show all 50':'50건 전체 보기'}</button><p id="review-budget-status" role="status">${en?'Checking saved evidence…':'저장 근거 확인 중…'}</p><p>${en?'Changes only the displayed review scope. Labels are known historical outcomes, not new detections. This does not change scores, the 0.5 prediction threshold or canonical evaluation. Top20/40 correspond to the existing 5%/10% budgets of 392 records; 50 is the displayed list, not a new evaluation budget. No field inspection capacity or performance improvement is established.':'화면에 표시할 점검 범위만 바꿉니다. 정상·불량은 이미 알려진 과거 결과이며 새 탐지 결과가 아닙니다. 점수·0.5 판정 임계값·정본 평가는 바꾸지 않습니다. 20·40건은 기존 392건 평가의 5%·10% 예산이고, 50건은 표시 목록이며 새 평가 예산이 아닙니다. 실제 점검 여력이나 성능 향상을 입증하지 않습니다.'}</p>`;
 table.closest('.table-shell').before(panel);
 const select=panel.querySelector('select'),reset=panel.querySelector('button'),status=panel.querySelector('[role=status]');
 evidence.then(({records})=>{
  if(!panel.isConnected)return;
  const rows=[...table.querySelectorAll('tbody tr[data-id]')];
  if(!records||rows.length!==50||rows.some((row,i)=>row.dataset.id!==records[i].sample_id)){
   status.textContent=en?'Budget display withheld: saved evidence and table could not be matched. The existing list is unchanged.':'범위 표시 보류: 저장 근거와 표의 일치를 확인하지 못했습니다. 기존 목록은 그대로 유지합니다.';return;
  }
  const render=()=>{const view=budgetView(records,budget);rows.forEach((row,i)=>row.hidden=i>=budget);select.value=String(budget);status.textContent=en?`${view.reviewed} shown · historical Fail ${view.failures} / Pass ${view.normal} · ${view.hidden} hidden from this 50-record list. Hidden does not mean safe or reviewed.`:`${view.reviewed}건 표시 · 과거 불량 ${view.failures} / 정상 ${view.normal} · 50건 중 ${view.hidden}건 숨김. 숨긴 기록을 정상·검토 완료로 처리하지 않습니다.`;};
  select.disabled=false;reset.disabled=false;select.value=String(budget);select.addEventListener('change',()=>{budget=Number(select.value);render();});reset.addEventListener('click',()=>{budget=50;render();});render();
 });
}
const app=document.querySelector('#app');if(app){new MutationObserver(mount).observe(app,{childList:true,subtree:true});mount();}
