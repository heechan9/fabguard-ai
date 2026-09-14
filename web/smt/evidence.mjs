import {DATASETS, datasetEvidence, sourceUrl} from './evidence-model.mjs';
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num = value => Number(value).toLocaleString('ko-KR');
const score = value => Number(value).toFixed(4);
const yesNo = value => value === true ? '있음' : value === false ? '없음' : '미기록';
function renderCard(root, snapshot, id) {
  const d = datasetEvidence(snapshot,id), {meta,audit,report,sdt} = d;
  const warnings = [];
  if(id === 'dkasc') warnings.push(`정규화 전 ${num(audit.input_rows_in_range)}행 → ${num(d.rows)}개 슬롯. 누락 시각 ${audit.missing_timestamp_slots}개, 남은 결측 전력 ${audit.remaining_missing_power}개, SDT 전용 음수→0 변환 ${num(audit.negative_values_clipped_for_sdt)}개. kW 단위는 추정 상태입니다.`);
  if(id === 'pvlive') warnings.push('전력망 집계 추정값입니다. SDT의 클리핑·용량 변화 신호를 개별 인버터 고장으로 해석할 수 없습니다.');
  if(id === 'pvgis') warnings.push(`입력 가정: PVGIS-SARAH3, 설비 ${audit.request_params.peakpower} kWp, 손실 ${audit.request_params.loss}%. 해당 좌표·과거 기상 조건의 기준 계산이며 실제 공장 발전량이나 미래 예측이 아닙니다.`);
  if(id === 'enedis') warnings.push(`수집 감사의 품질 경고 있음: 에너지 결측 ${audit.missing_energy_rows}개를 0으로 채우지 않고 보존했습니다. SDT 자체의 품질 경고가 '${yesNo(sdt['data quality warning'])}'이어도 이 수집 경고는 유지합니다.`);
  if(id === 'meteo') warnings.push('Frictionless 통과는 저장소 웹 요약에 기록되어 있습니다. 동봉된 개별 감사는 자원 계약·변환·해시를 담고 있으며, 별도 SDT 보고서는 없습니다.');
  if(sdt?.['data quality warning']) warnings.push('SDT 품질 경고가 기록되어 있습니다. 구조검사 통과가 모든 관측값의 정확성을 보장하지는 않습니다.');
  const takeaways = {
    dkasc:'실제로 측정한 태양광 자료입니다. 비어 있는 값과 추정된 단위를 확인해야 해요.',
    pvlive:'영국 전체 태양광 발전을 추정한 자료입니다. 개별 설비를 직접 측정한 값은 아니에요.',
    pvgis:'특정 위치와 설비 조건을 넣어 계산한 기준 자료입니다. 실제 발전량이나 미래 예측이 아니에요.',
    enedis:'프랑스 배전망의 태양광 집계 추정값입니다. 에너지 값이 없는 기록 207개가 남아 있어요.',
    meteo:'파리의 한 관측소에서 측정한 날씨 자료입니다. 태양광 발전량 자료는 아니에요.'
  };
  root.querySelector('#dataset-card').innerHTML = `
    <div class="evidence-head"><h3>${esc(meta.title)}</h3><span class="evidence-tag">${esc(meta.kind)}</span></div>
    <p class="plain-takeaway">${esc(takeaways[id])}</p>${sdt?.['data quality warning'] || audit.data_quality_warning ? '<p class="plain-quality">주의 · 원본 보고서에 자료 품질 경고가 있어요. 파일 형식 검사 통과와는 별개입니다.</p>' : ''}<p class="evidence-scope">${esc(meta.scope)}</p>
    <p class="evidence-note"><b>확보 자료의 기간</b><br>${esc(meta.period)}<br>${esc(meta.periodNote)}</p>
    <dl class="evidence-facts"><div><dt>검사용으로 정리한 기록</dt><dd>${num(d.rows)}<small>${num(d.interval)}분 간격 · 원자료 전체가 아닌 저장된 감사 기준</small></dd></div>
    <div><dt>파일 형식 검사</dt><dd>${d.frictionless === true ? '통과' : '확인 필요'}<small>${report ? '개별 분석 보고서에 기록' : '웹 요약에 기록 · 개별 보고서 미동봉'}</small></dd></div>
    <div><dt>${sdt ? '자료 품질 점수' : '분석 범위'}</dt><dd>${sdt ? score(sdt['quality score']) : '기상 계약 검증'}<small>${sdt ? 'SDT의 0–1 점수 · 예측 정확도나 불량률 아님' : 'SDT 발전 분석 · 미래 예측 없음'}</small></dd></div></dl>
    <details class="evidence-details"><summary>자료를 읽을 때 주의할 점 · ${warnings.length}개</summary>${warnings.map(w=>`<p class="evidence-note evidence-warning">${esc(w)}</p>`).join('')}</details>
    ${sdt ? `<details class="evidence-details"><summary>품질 분석의 세부 수치 보기 · SDT</summary><div class="evidence-table-wrap"><table class="evidence-table"><caption class="evidence-muted">과거 자료의 알고리즘 진단값 · 설비 이상 확정이나 국가 성능 비교에 사용하지 않음</caption><tbody>
    <tr><th scope="row">Clearness score</th><td>${score(sdt['clearness score'])}</td></tr><tr><th scope="row">Clipped fraction</th><td>${score(sdt['clipped fraction'])}</td></tr><tr><th scope="row">클리핑 신호</th><td>${yesNo(sdt['inverter clipping'])}</td></tr><tr><th scope="row">용량 변화 신호</th><td>${yesNo(sdt['capacity change'])}</td></tr><tr><th scope="row">SDT 품질 경고</th><td>${yesNo(sdt['data quality warning'])}</td></tr></tbody></table></div><p>SDT ${esc(report.runtime.solar_data_tools_version)} · ${esc(report.runtime.solver)}. 집계·모델 기준 자료에서도 신호가 발생할 수 있습니다.</p></details>` : ''}
    <details class="evidence-details"><summary>단위·검증 상태·출처 확인</summary><p>${esc(meta.unit)}</p><p>저장된 상태: ${esc(report?.status ?? audit.status)}<br>기록된 수집·분석 시점: ${esc(audit.retrieved_at ?? report?.source.observed_at ?? audit.source_accessed_at)}</p><p>감사와 ${report ? '분석 보고서' : '웹 요약'}의 행 수·SHA-256 선언: <b>${d.lineageMatches ? '일치' : '불일치 · 확인 필요'}</b>. 원본 CSV를 다시 해시하거나 분석을 재실행한 검증은 아닙니다.</p><code class="evidence-hash">${esc(d.hash)}</code></details>
    <div class="evidence-links"><a href="${sourceUrl(snapshot,d.auditPath)}" target="_blank" rel="noopener">${id === 'dkasc' ? '정규화 감사' : '수집 감사'} ↗</a><a href="${sourceUrl(snapshot,d.reportPath)}" target="_blank" rel="noopener">${report ? '원본 분석 보고서' : '저장소 웹 요약'} ↗</a></div>`;
  for(const button of root.querySelectorAll('[data-evidence-source]')) button.setAttribute('aria-pressed',String(button.dataset.evidenceSource === id));
}
export async function mountEvidence(root = document.querySelector('#country-evidence')) {
  if (!root) return;
  try {
    const response = await fetch('/data/evidence_snapshot.json');
    if(!response.ok) throw new Error('저장된 자료를 읽지 못했습니다.');
    const snapshot = await response.json();
    root.innerHTML = `<div class="evidence-head"><div><p class="eyebrow">실제로 확보한 자료</p><h2>어느 자료를 분석했나요?</h2></div><span class="evidence-tag">저장된 분석 결과 · 실시간 연결 아님</span></div>
      <p class="evidence-intro">국가를 선택하면 확보한 기간과 검사 결과를 볼 수 있어요. 태양광·날씨 자료를 정리한 화면이며, SMT 기판의 불량을 예측하는 자료는 아닙니다. 연도와 조건이 달라 국가별 순위는 매기지 않아요.</p>
      <div class="reading-key"><span><b>관측값</b> 실제로 측정</span><span><b>추정값</b> 여러 자료로 추산</span><span><b>기준값</b> 가정을 넣어 계산</span></div><div class="evidence-picks" aria-label="분석 자료 선택">${DATASETS.map(d=>`<button type="button" data-evidence-source="${d.id}" aria-pressed="false" aria-controls="dataset-card">${esc(d.label)}<small>${d.year}</small></button>`).join('')}</div>
      <article id="dataset-card" class="evidence-card" aria-live="polite" aria-atomic="true"></article>
      <p class="evidence-note"><b>프랑스 RTE 자료는 아직 연결 대기 중이에요.</b><br>2024년 연간 보고서와 수집 기록이 저장소에 함께 등록되면 확인 후 표시합니다.</p>
      <details class="evidence-details"><summary>SMT에 지금 연결되는 것과 추가로 필요한 것</summary><div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">항목</th><th scope="col">현재 연결</th><th scope="col">실제 SMT 적용에 필요한 자료</th></tr></thead><tbody>
      <tr><th scope="row">국가별 PV·기상</th><td>저장된 품질검사·분석 근거 열람</td><td>공장 위치·동일 기간·계량기·설비 부하가 있어야 에너지 분석과 연결 가능</td></tr>
      <tr><th scope="row">SECOM 예측모델</th><td><a href="/secom/">별도 반도체 분석 화면</a>에서 과거 평가 열람</td><td>SMT용 모델 별도 학습·시간 분리 평가·독립 검증. SECOM의 익명 590개 변수와 SPI 값은 호환되지 않음</td></tr>
      <tr><th scope="row">실제 공정 이력·센서</th><td>가상 PCB·규칙 유지</td><td>board_id, 공정, 이벤트 시각, 단위가 있는 SPI·리플로우·AOI 내보내기와 Fledge 연결 계약</td></tr>
      <tr><th scope="row">불량·설비 고장 예측</th><td>검증된 SMT 예측 없음</td><td>PCB별 검사 라벨·재작업·고장 이력, 누락 처리, 시간 누수 차단, 보정·오경보 검증</td></tr>
      <tr><th scope="row">생산량·전력비 예상</th><td>실측 기반 결과 없음</td><td>실제 사이클·정지·불량·부하·요금 자료와 명시적 시나리오 가정</td></tr></tbody></table></div></details>
      <details class="evidence-details"><summary>SMT 3D 시나리오의 가정과 계산 근거</summary><p>고정 난수 시드 42로 가상 측정값을 만듭니다. r은 0 이상 1 미만의 의사난수이며 각 측정에 다음 난수를 사용합니다. 실제 장비 규격이나 물리 예측 모델은 포함하지 않습니다.</p><div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">시나리오</th><th scope="col">값 생성</th><th scope="col">표시 규칙</th></tr></thead><tbody>
      <tr><th scope="row">기본 PCB</th><td>납 round(94 + 12r)%<br>최고 온도 round(239 + 8r)°C</td><td>SPI·리플로우 측정 시점 이후 공개</td></tr><tr><th scope="row">납 부족</th><td>round(58 + 9r)%</td><td>80% 미만이면 검토 · AOI에서 가상 NG</td></tr><tr><th scope="row">과열</th><td>round(264 + 8r)°C</td><td>250°C 초과이면 검토 · AOI에서 가상 NG</td></tr><tr><th scope="row">센서 누락</th><td>SPI 값 null</td><td>AOI OK여도 데이터 검토 유지</td></tr><tr><th scope="row">배치 시간</th><td>11공정 체류 합 42초 + (12−1)×4초 = 86초</td><td>시뮬레이션 시간 · 실제 생산성 계산 아님</td></tr></tbody></table></div><p>AOI도 같은 규칙으로 생성되므로 독립적인 정답 검증이나 예측 정확도를 계산할 수 없습니다. 상단의 범위 표시는 데모 설정이며 구현된 이상은 납 하한·온도 상한·누락에 한정됩니다.</p><a href="/smt/simulation.mjs" target="_blank" rel="noopener">시나리오 계산 코드 ↗</a></details>
      <div class="evidence-links"><a href="/data/evidence_snapshot.json" download="fabguard-evidence-snapshot.json">표시 근거 JSON 저장 ↓</a><a href="${sourceUrl(snapshot,'results/catalog.json')}" target="_blank" rel="noopener">FabGuard 자료 목록 ↗</a><a href="/secom/">SECOM 반도체 분석 →</a></div><p class="evidence-muted">${snapshot.checked_at} 저장소 확인 · 자료 목록 갱신 ${snapshot.files['results/catalog.json'].updated_at}. 자동 갱신·실 API 호출 없이 동일한 저장본을 표시합니다.</p>`;
    for(const button of root.querySelectorAll('[data-evidence-source]')) button.addEventListener('click',()=>renderCard(root,snapshot,button.dataset.evidenceSource));
    renderCard(root,snapshot,'dkasc');
  } catch(error) {
    root.replaceChildren();
    const p = document.createElement('p'); p.className='evidence-error'; p.setAttribute('role','alert');
    p.textContent='분석 근거를 불러오지 못했습니다. 새로고침해서 다시 시도해 주세요. 기존 3D 시나리오는 별도로 동작합니다.'; root.append(p);
  }
}
mountEvidence();
