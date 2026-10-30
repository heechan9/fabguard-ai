import {contextReview} from './context-review-model.mjs';
// Build text nodes, not markup from data. Update only when disclosed context changes.
export function mountContextReview(root){
 let previous='';
 return board=>{
  const context=contextReview(board),key=JSON.stringify(context);
  if(key===previous)return;previous=key;root.replaceChildren();
  const add=(tag,text,parent=root)=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
  add('h3',`${context.boardId} · 변경 이력과 검토 가설`);
  add('p','설명용 합성 이력·가설입니다. 실제 레시피 값·정비 기록·원인 진단이 아니며 SECOM과 연결되지 않습니다.');
  const state=add('p',context.reasons.length?'HOLD · '+context.reasons.map(r=>r.label).join(' / '):board.stage<2?'측정 전 · 검토 근거 대기':'추가 HOLD 사유 없음 · 실제 품질 승인 아님');state.className='context-hold';state.dataset.state=context.reasons.length?'hold':board.stage<2?'waiting':'clear';
  add('h4','선택 기판의 변경 이력 · 시뮬레이션 시간');
  if(!context.events.length)add('p',board.stage<2?'측정 단계에 도착하면 이력을 공개합니다.':'이 기판에 주입한 변경 이력이 없습니다.');
  else{const timeline=add('ol','');for(const event of context.events){const item=add('li','',timeline);add('b',`${event.time}초 · ${event.kind}`,item);add('p',`변경 전: ${event.before}`,item);add('p',`변경 후: ${event.after}`,item);}}
  add('h4','후보 가설 → 다음 확인');
  if(!context.hypotheses.length)add('p','관측 전에는 가설을 제시하지 않습니다.');
  else{add('p','가능한 확인 방향을 나열한 예시이며, 순위·확률·확정 원인이 아닙니다. 비교 결과나 정비 효과도 계산하지 않습니다.');const list=add('div','');list.className='context-hypotheses';for(const h of context.hypotheses){const article=add('article','',list);add('h4',h.category+' · 후보 가설',article);add('p',h.candidate,article);add('p','다음 확인 · '+h.next,article);}}
 };
}
