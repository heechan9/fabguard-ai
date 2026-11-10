/* Read-only presentation of existing SECOM records. No simulation, telemetry,
   model inference, state mutation or mapping of anonymous features to equipment. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (en, ko, english) => english ? en : ko;
export const stages = Object.freeze([
  {id:'wafer-in', en:'Wafer in', ko:'웨이퍼 투입', description:['The starting point of this simplified manufacturing illustration. No wafer or lot tracking is connected.', '단순화한 제조 공정도의 시작점입니다. 실제 웨이퍼·로트 추적은 연결되어 있지 않습니다.']},
  {id:'lithography', en:'Lithography', ko:'노광', description:['A conceptual patterning step, not a measured lithography tool. SECOM variables are not mapped to this equipment.', '패턴을 형성하는 개념적 단계이며 실측 노광 장비가 아닙니다. SECOM 변수와 이 설비는 매핑되지 않았습니다.']},
  {id:'etch', en:'Etch', ko:'식각', description:['A conceptual material-removal step. No chamber pressure, temperature or equipment health is available.', '필요한 부분을 남기고 재료를 제거하는 개념적 단계입니다. 챔버 압력·온도·장비 건강 상태는 제공되지 않습니다.']},
  {id:'deposition', en:'Deposition', ko:'증착', description:['A conceptual thin-film deposition step. The illustration does not represent a connected tool or its status.', '박막을 형성하는 개념적 단계입니다. 연결된 실제 장비나 장비 상태를 나타내지 않습니다.']},
  {id:'inspection', en:'Inspection', ko:'검사', description:['Open the saved SECOM priority queue to review historical samples. Risk scores do not establish a defect or physical cause.', '저장된 SECOM 점검 목록에서 과거 생산 건을 검토합니다. 위험점수는 불량 확정이나 물리적 원인을 뜻하지 않습니다.']},
  {id:'test', en:'Test', ko:'테스트', description:['A conceptual test step. Historical SECOM labels are separate from this illustration; no live test result is available.', '개념적 테스트 단계입니다. 과거 SECOM 라벨은 이 공정도와 별개이며 실시간 검사 결과는 없습니다.']},
]);

export function commandCenterData(summary, risks) {
  if (!summary || !Array.isArray(risks) || risks.length !== 50) throw new Error('Saved queue unavailable');
  const ids = new Set();
  risks.forEach((row, index) => {
    if (row.rank !== index + 1 || typeof row.sample_id !== 'string' || !/^secom_\d+$/.test(row.sample_id) || ids.has(row.sample_id)
      || !Number.isFinite(row.risk_score) || row.risk_score < 0 || row.risk_score > 1
      || (index > 0 && row.risk_score > risks[index - 1].risk_score)
      || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.timestamp)
      || ![0, 1].includes(row.label)) throw new Error('Invalid saved queue');
    ids.add(row.sample_id);
  });
  const budgets = summary.top_k;
  if (!Array.isArray(budgets) || budgets.length !== 3 || budgets.some(row =>
    !Number.isFinite(row.k_fraction) || row.k_fraction <= 0 || row.k_fraction > 1 ||
    !Number.isInteger(row.inspection_count) || row.inspection_count < 1 ||
    !Number.isInteger(row.captured_fail) || row.captured_fail < 0 ||
    !Number.isInteger(row.total_fail) || row.total_fail < 1 || row.captured_fail > row.total_fail ||
    !Number.isFinite(row.fail_capture_rate) || Math.abs(row.fail_capture_rate - row.captured_fail / row.total_fail) > 1e-10)) throw new Error('Invalid saved metrics');
  return {
    priority: risks.slice(0, 5).map(row => ({...row})),
    recent: [...risks].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 3).map(row => ({...row})),
    scores: risks.map(row => row.risk_score),
    budgets: budgets.map(row => ({...row})),
  };
}

export function scorePath(scores) {
  if (scores.length < 2 || scores.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new Error('Invalid scores');
  // Fixed 0–1 vertical scale. The x axis is rank, never time.
  return scores.map((value, index) => `${index ? 'L' : 'M'}${(index * 600 / (scores.length - 1)).toFixed(2)},${(88 - value * 80).toFixed(2)}`).join(' ');
}

export function renderCommandCenter(summary, risks, language = 'ko') {
  const english = language === 'en';
  const t = (en, ko) => text(en, ko, english);
  const data = commandCenterData(summary, risks);
  const label = t('CONCEPT', '개념도');
  return `<section class="cc-dashboard" aria-labelledby="cc-title">
    <div class="cc-heading"><div><p>FAB OPERATIONS OVERVIEW</p><h1 id="cc-title">${t('Fab operations overview', '팹 운영 개요')}</h1></div><span class="cc-heading-rule" aria-hidden="true"></span><span class="cc-mode">${t('SAVED RECORDS', '저장된 분석 기록')}</span></div>
    <p class="cc-boundary"><span aria-hidden="true">◇</span> ${t('Offline SECOM analysis · conceptual process illustration · no live equipment connection', 'SECOM 오프라인 분석 · 공정도는 개념 설명 · 실시간 장비 연결 없음')}</p>
    <div class="cc-top-grid">
      <section class="cc-panel cc-flow" aria-labelledby="cc-flow-title">
        <div class="cc-panel-head"><h2 id="cc-flow-title">SEMICONDUCTOR MANUFACTURING FLOW</h2><span>${t('ILLUSTRATION', '설명용')}</span></div>
        <div class="cc-flow-body">
          <p class="cc-flow-intro">${t('Explore a process. Review the evidence separately.', '공정은 한눈에, 판단은 근거로.')}</p>
          <ol class="cc-stages">${stages.map((stage, index) => `<li><button class="cc-stage${index === 4 ? ' is-selected' : ''}" type="button" data-stage="${stage.id}" aria-pressed="${index === 4}" aria-controls="cc-stage-detail"><span class="cc-stage-number">0${index + 1}</span><img src="/assets/command-center/${stage.id}.svg" alt="" width="160" height="120"><strong>${escape(stage.en.toUpperCase())}</strong><small>${english ? label : escape(stage.ko)}</small></button><span class="cc-concept-label">${label}</span></li>`).join('')}</ol>
          <div class="cc-stage-detail" id="cc-stage-detail" aria-live="polite"><span class="cc-selected-name">${t('INSPECTION', '검사')}</span><p>${escape(stages[4].description[english ? 0 : 1])}</p><a href="#risks">${t('Open queue', '점검 목록')} <span aria-hidden="true">↗</span></a></div>
        </div>
        <div class="cc-panel-foot">${t('Simplified sequence · not an actual process route or equipment-health display', '단순화한 공정 순서 · 실제 생산 경로나 설비 정상 여부를 나타내지 않습니다')}</div>
      </section>
      <section class="cc-panel cc-priority" aria-labelledby="cc-priority-title">
        <div class="cc-panel-head"><h2 id="cc-priority-title">INSPECTION PRIORITY</h2><span>TOP 05</span></div>
        <p class="cc-panel-note">${t('Saved risk ranking · not defect certainty', '저장된 위험순위 · 불량 확정 아님')}</p>
        <ol class="cc-queue">${data.priority.map((row, index) => `<li><a href="#detail/${encodeURIComponent(row.sample_id)}" class="${index === 0 ? 'cc-first' : ''}"><span class="cc-rank">${row.rank}</span><span><strong>${escape(row.sample_id.toUpperCase())}</strong><small>${t('RISK SCORE', '위험점수')} <b>${row.risk_score.toFixed(3)}</b></small></span><span class="cc-queue-arrow" aria-hidden="true">↗</span></a></li>`).join('')}</ol>
        <a class="cc-panel-link" href="#risks">${t('View all 50 saved samples', '저장된 생산 건 50개 모두 보기')} <span aria-hidden="true">→</span></a>
      </section>
    </div>
    <div class="cc-bottom-grid">
      <section class="cc-panel cc-evidence" aria-labelledby="cc-evidence-title">
        <div class="cc-panel-head"><h2 id="cc-evidence-title">RECORDED ANALYSIS</h2><span>SECOM / OFFLINE</span></div>
        <div class="cc-chart-row"><div><h3>${t('Risk by rank', '순위별 위험점수')}</h3><p>${t('50 saved samples', '저장된 생산 건 50개')}</p><span class="cc-record-label">${t('NOT A TIME SERIES', '시간 추세 아님')}</span></div>
          <div class="cc-chart"><svg viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label="${t('Risk scores for ranks 1 to 50 on a fixed zero-to-one scale. Exact values are available in the inspection queue.', '순위 1~50의 저장된 위험점수. 세로축은 0~1 고정이며 정확한 값은 점검 목록에서 확인합니다.')}" class="cc-score-chart"><path class="cc-grid-lines" d="M0,8H600 M0,48H600 M0,88H600 M0,8V88 M120,8V88 M240,8V88 M360,8V88 M480,8V88 M600,8V88"/><path class="cc-score-line" d="${scorePath(data.scores)}"/></svg><div class="cc-chart-axis"><span>1.0 → 0.0</span><span>${t('Rank 1 → 50', '순위 1 → 50')}</span></div></div>
        </div>
        <div class="cc-capture-rows">${data.budgets.map(row => `<div><span>TOP ${Math.round(row.k_fraction * 100)}% <small>${row.inspection_count}${t(' reviewed', '건 점검')}</small></span><div class="cc-capture-track" role="img" aria-label="${t('Historical Fail capture', '과거 Fail 포착')} ${(row.fail_capture_rate * 100).toFixed(1)}%"><i style="width:${row.fail_capture_rate * 100}%"></i></div><strong>${row.captured_fail} / ${row.total_fail}<small> Fail</small></strong></div>`).join('')}</div>
        <div class="cc-panel-foot">${t('Historical held-out results · not live sensors or verified yield improvement', '과거 시간순 검증구간 결과 · 실시간 센서나 검증된 수율 개선이 아닙니다')}</div>
      </section>
      <section class="cc-panel cc-records" aria-labelledby="cc-records-title">
        <div class="cc-panel-head"><h2 id="cc-records-title">RECENT SOURCE RECORDS</h2><span>${t('HISTORICAL', '과거 기록')}</span></div>
        <p class="cc-panel-note">${t('Latest measurement times within the saved top 50', '저장된 상위 50건 중 측정 시각이 최근인 기록')}</p>
        <ol>${data.recent.map(row => `<li><a href="#detail/${encodeURIComponent(row.sample_id)}"><span class="cc-record-icon" aria-hidden="true">▤</span><span><strong>${escape(row.sample_id.toUpperCase())}</strong><small>${t('Stored risk score', '저장된 위험점수')} ${row.risk_score.toFixed(3)}</small></span><time datetime="${row.timestamp.replace(' ', 'T')}">${row.timestamp.slice(0, 10)}<small>${row.timestamp.slice(11, 16)}</small></time></a></li>`).join('')}</ol>
        <a class="cc-panel-link" href="#limitations">${t('Evidence and interpretation limits', '분석 근거와 해석 한계')} <span aria-hidden="true">→</span></a>
      </section>
    </div>
    <div class="cc-bottom-line"><span>AI PRIORITIZES. ENGINEERS DECIDE.</span><a href="/smt/${english ? '?lang=en' : ''}">${t('Explore the separate synthetic 3D lab', '별도 합성 3D 공정 체험')} ↗</a></div>
  </section>`;
}

export function mountCommandCenter(root, state, language) {
  root.innerHTML = renderCommandCenter(state.summary, state.risks, language);
  const english = language === 'en';
  root.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => {
    const stage = stages.find(item => item.id === button.dataset.stage);
    if (!stage) return;
    root.querySelectorAll('[data-stage]').forEach(item => {
      const active = item === button;
      item.setAttribute('aria-pressed', String(active));
      item.classList.toggle('is-selected', active);
    });
    const detail = root.querySelector('#cc-stage-detail');
    detail.querySelector('.cc-selected-name').textContent = english ? stage.en.toUpperCase() : stage.ko;
    detail.querySelector('p').textContent = stage.description[english ? 0 : 1];
    detail.querySelector('a').hidden = stage.id !== 'inspection';
  }));
}
