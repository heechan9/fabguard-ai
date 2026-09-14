import {CASES,InspectionSession} from './inspection-model.mjs';

export function mountInspection(root){
  const session=new InspectionSession();
  root.innerHTML=`
    <div class="inspection-heading"><div><p class="eyebrow">추가 검사실 · 가상 시나리오</p><h2 id="inspection-title">겉보기 검사만으로 충분할까요?</h2></div><span class="status-chip">실제 분석·AI 예측 아님</span></div>
    <p>같은 기판도 검사 방법에 따라 다른 문제를 확인할 수 있어요. 아래 사례는 직접 정한 가정이며, 위 SMT 공정에서 계산한 결과가 아닙니다.</p>
    <div class="inspection-controls"><p>체험 대상 <strong id="inspection-board">—</strong><small>위의 기판 선택과 연결 · 기판을 바꾸면 체험 초기화</small></p><label>1. 어떤 사례를 살펴볼까요?<select id="inspection-case"><option value="">사례를 선택하세요</option></select></label></div>
    <p id="inspection-assumption" class="inspection-assumption">아직 사례를 선택하지 않았어요. 납 부족·과열을 이 검사 결과와 자동으로 연결하지 않습니다.</p>
    <div class="inspection-cards">
      <article class="inspection-card" data-method="xray"><h3>2. 내부 살펴보기 · X-ray</h3><p>부품 안쪽의 빈 공간을 표시한 개념도입니다.</p>
        <div class="inspection-drawing" data-visual="idle" role="img" aria-label="아직 검사하지 않은 X-ray 개념도">
          <svg viewBox="0 0 320 130" aria-hidden="true"><rect class="drawing-board" x="20" y="15" width="280" height="100" rx="10"/><rect class="drawing-component" x="105" y="30" width="110" height="70" rx="8"/><circle class="drawing-void" cx="161" cy="61" r="14"/><path class="drawing-leads" d="M60 45h40m-40 20h40m-40 20h40m120-40h40m-40 20h40m-40 20h40"/></svg>
          <span class="drawing-placeholder">검사 전</span><small>설명용 도식 · 실제 X-ray 영상 아님</small>
        </div><button type="button" data-inspect="xray" disabled>가상 내부 검사 실행</button><div class="inspection-result" aria-live="polite"><strong>아직 검사하지 않았어요</strong><p>사례를 선택하고 실행해 주세요.</p></div>
        <details><summary>참고 장비와 판정 근거</summary><p>학교 소개의 XSCAN-9860A를 참고했습니다. 실제 영상 재구성·검출 알고리즘은 구현하지 않았습니다. 빈 공간이 지정된 사례는 검토 필요로 표시하며 크기·면적률·합격 임계값을 추정하지 않습니다.</p><a href="https://cec.tukorea.ac.kr/equ/equInfo/equInfoDetail.hs?equCode=1248" target="_blank" rel="noopener noreferrer">학교 3D X-ray 장비 소개 ↗</a></details>
      </article>
      <article class="inspection-card" data-method="electrical"><h3>3. 연결 확인하기 · 전기검사</h3><p>이어질 곳과 분리될 곳의 가상 연결 상태를 비교해요.</p>
        <div class="inspection-drawing" data-visual="idle" role="img" aria-label="아직 검사하지 않은 회로 연결 개념도">
          <svg viewBox="0 0 320 130" aria-hidden="true"><rect class="drawing-board" x="20" y="15" width="280" height="100" rx="10"/><path class="drawing-wire" d="M50 45h90m40 0h90M50 85h220"/><path class="drawing-connection" d="M140 45h40"/><path class="drawing-short" d="M220 45v40"/><circle class="drawing-terminal" cx="50" cy="45" r="5"/><circle class="drawing-terminal" cx="270" cy="45" r="5"/><circle class="drawing-terminal" cx="50" cy="85" r="5"/><circle class="drawing-terminal" cx="270" cy="85" r="5"/></svg>
          <span class="drawing-placeholder">검사 전</span><small>설명용 도식 · 실제 전압·저항 계산 아님</small>
        </div><button type="button" data-inspect="electrical" disabled>가상 전기검사 실행</button><div class="inspection-result" aria-live="polite"><strong>아직 검사하지 않았어요</strong><p>사례를 선택하고 실행해 주세요.</p></div>
        <details><summary>참고 장비와 판정 근거</summary><p>학교 소개의 FA1282-01을 참고했습니다. 이 체험은 회로 연결 상태를 지정해 Open/Short를 설명합니다. 장비의 실제 시험 조건·측정 정확도·판정 로직을 재현하지 않습니다.</p><a href="https://cec.tukorea.ac.kr/equ/equInfo/equInfoDetail.hs?equCode=1148" target="_blank" rel="noopener noreferrer">학교 PCB 전기검사 장비 소개 ↗</a></details>
      </article>
    </div><p class="inspection-takeaway" id="inspection-takeaway" role="status">두 검사를 실행하면 결과를 함께 읽는 방법이 나타나요.</p>
    <details class="inspection-limits"><summary>실제 기록을 연결하려면 무엇이 필요할까요?</summary><p>같은 기판·부품 위치의 검사 자료, 시간, 장비 조건, 판정 기준이 필요합니다. X-ray 원본 영상과 전문가 판정, 전기검사 지점·측정값·Open/Short 기록의 제공 가능 여부를 먼저 확인해야 합니다. 장비 소개는 데이터 이용 허가나 연동 가능성을 의미하지 않습니다.</p><p>현재는 별도 검사 체험입니다. 11단계 생산라인, 가상 불량 건수, 공정 기록 내보내기, SECOM·국가별 분석 결과를 변경하지 않습니다.</p></details>`;
  const select=root.querySelector('#inspection-case');
  for(const [id,sample] of Object.entries(CASES)){const option=document.createElement('option');option.value=id;option.textContent=sample.label;select.append(option);}
  function render(){
    root.querySelector('#inspection-board').textContent=session.boardId||'—';
    select.value=session.caseId||'';
    root.querySelector('#inspection-assumption').textContent=session.caseId?`이 사례의 가정: ${CASES[session.caseId].assumption}`:'아직 사례를 선택하지 않았어요. 납 부족·과열을 이 검사 결과와 자동으로 연결하지 않습니다.';
    for(const card of root.querySelectorAll('[data-method]')){
      const result=session.results[card.dataset.method];
      card.querySelector('button').disabled=!session.caseId||!session.boardId;
      card.querySelector('.inspection-result strong').textContent=result?.title||'아직 검사하지 않았어요';
      card.querySelector('.inspection-result p').textContent=result?.reason||'사례를 선택하고 실행해 주세요.';
      card.dataset.status=result?.status||'idle';
      const drawing=card.querySelector('.inspection-drawing');drawing.dataset.visual=result?.visual||'idle';
      drawing.setAttribute('aria-label',`가상 검사 개념도: ${result?.title||'검사 전'}`);
      drawing.querySelector('.drawing-placeholder').textContent=result?.visual==='missing'?'자료 없음':'검사 전';
    }
    const complete=Object.keys(session.results).length===2;
    root.querySelector('#inspection-takeaway').textContent=!complete?'두 검사를 실행하면 결과를 함께 읽는 방법이 나타나요.':session.caseId==='void'?'내부에 빈 공간이 있어도 연결은 유지될 수 있어요. 한 검사에서 이상이 없다고 다른 검사까지 통과한 것은 아닙니다.':session.caseId==='missing'?'자료가 없으면 판단을 보류합니다. 미측정을 정상으로 처리하지 않아요.':session.caseId==='clear'?'설정한 두 검사 항목에서만 이상이 없는 사례예요. 실제 제품의 품질이나 수명을 보증하지 않습니다.':'전기적 연결 이상을 설정한 사례예요. X-ray 자료 없이 결함의 외형이나 원인을 추정하지 않습니다.';
  }
  select.addEventListener('change',()=>{if(select.value)session.selectCase(select.value);else {const board=session.boardId;session.reset();session.selectBoard(board);}render();});
  root.querySelectorAll('[data-inspect]').forEach(button=>button.addEventListener('click',()=>{session.run(button.dataset.inspect);render();}));
  render();
  return {selectBoard(id){if(id!==session.boardId){session.selectBoard(id);render();}},reset(){session.reset();render();}};
}
