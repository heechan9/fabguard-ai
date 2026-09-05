const app = document.querySelector("#app");
let state = { summary: null, risks: null, phase1: null };

const pct = value => `${(Number(value) * 100).toFixed(1)}%`;
const num = (value, digits = 3) => Number(value).toFixed(digits);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const shortTimestamp = value => {
  const match = String(value ?? "").match(/^\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : String(value ?? "");
};

function validateSummaryDataset(ds) {
  if (!ds || typeof ds !== "object") throw new Error("데이터셋 메타데이터(summary.dataset)가 존재하지 않습니다.");
  const { samples, measurement_features, pass_count, fail_count } = ds;
  if (!Number.isFinite(samples) || samples <= 0) throw new Error("dataset.samples 데이터 계약이 올바르지 않습니다.");
  if (!Number.isFinite(measurement_features) || measurement_features <= 0) throw new Error("dataset.measurement_features 데이터 계약이 올바르지 않습니다.");
  if (!Number.isFinite(pass_count) || pass_count < 0) throw new Error("dataset.pass_count 데이터 계약이 올바르지 않습니다.");
  if (!Number.isFinite(fail_count) || fail_count < 0) throw new Error("dataset.fail_count 데이터 계약이 올바르지 않습니다.");
  if (pass_count + fail_count !== samples) throw new Error("pass_count + fail_count !== samples 데이터 계약 불일치입니다.");
}

function validatePhase1(phase1) {
  if (!phase1 || phase1.status !== "scenario_and_provisional_validation") throw new Error("Phase 1 검증 상태가 올바르지 않습니다.");
  const values = [phase1.ece?.before, phase1.ece?.after, phase1.top10_capture?.low, phase1.top10_capture?.high, phase1.walk_forward?.min, phase1.walk_forward?.max];
  if (!values.every(Number.isFinite)) throw new Error("Phase 1 수치 데이터 계약이 올바르지 않습니다.");
  if (phase1.ece.after > phase1.ece.before) throw new Error("Phase 1 확률 보정 수치가 원본 증거와 일치하지 않습니다.");
  if (phase1.top10_capture.low > phase1.top10_capture.high) throw new Error("Phase 1 신뢰구간 순서가 올바르지 않습니다.");
  if (!Number.isInteger(phase1.walk_forward.folds) || phase1.walk_forward.folds <= 0) throw new Error("Phase 1 walk-forward 구간 수가 올바르지 않습니다.");
}

async function load() {
  try {
    const [summaryResponse, riskResponse, phase1Response] = await Promise.all([fetch("/data/summary.json"), fetch("/data/priority_top50.json"), fetch("/data/phase1_summary.json")]);
    if (!summaryResponse.ok || !riskResponse.ok || !phase1Response.ok) throw new Error("결과 파일 응답이 올바르지 않습니다.");
    state.summary = await summaryResponse.json();
    state.risks = await riskResponse.json();
    state.phase1 = await phase1Response.json();
    validateSummaryDataset(state.summary?.dataset);
    validatePhase1(state.phase1);
    route();
  } catch (error) {
    app.innerHTML = `<section class="state"><p class="kicker">SYSTEM ERROR</p><h2>결과를 불러오지 못했습니다.</h2><p>${esc(error.message)}</p><button class="button" onclick="location.reload()">다시 시도</button></section>`;
  }
}

const selectedTest = () => state.summary.test.find(row => row.candidate === state.summary.selected_model);
const top10 = () => state.summary.top_k.find(row => Math.abs(row.k_fraction - 0.1) < 0.001);

function waferVisual(featCount) {
  return `<figure class="hero-visual"><img src="/assets/fabguard-dusk-hero-v3.jpg" alt="노을에서 야간으로 이어지는 대형 반도체 팹과 엔지니어의 데이터 기반 위험 검토를 표현한 FabGuard 콘셉트 이미지"><div class="visual-shade"></div><figcaption>독자 제작 콘셉트 이미지 · 실제 공장 또는 현장 배포 사진이 아닙니다.</figcaption><div class="visual-stat"><span>분석 입력</span><strong>${featCount}</strong><small>익명 측정변수</small></div><div class="visual-status"><i></i> HUMAN REVIEW REQUIRED</div></figure>`;
}

function summaryView() {
  const test = selectedTest();
  const ten = top10();
  const baseline = state.summary.test.find(row => row.family === "dummy");
  const ds = state.summary.dataset;
  const queueSize = state.risks.length;
  app.innerHTML = `
    <section class="hero"><div class="hero-copy"><div class="status-chip"><i></i> 공개 반도체 데이터 · 오프라인 데모</div><p class="kicker">FABGUARD AI</p><h1>모두 볼 수 없다면,<br><span>위험한 것부터.</span></h1><p class="hero-ko">반도체 생산 기록의 위험도를 정렬해<br><strong>엔지니어의 첫 점검 대상을 제안합니다.</strong></p><p class="lead">AI가 불량을 확정하거나 공정을 제어하지 않습니다. 제한된 점검 시간을 어디에 먼저 쓸지 보여주고, 최종 판단은 엔지니어가 합니다.</p><div class="hero-actions"><a class="button" href="#risks">점검 목록 직접 보기 <span>→</span></a><a class="text-link" href="#result">현재 결과 30초 확인</a></div></div>${waferVisual(ds.measurement_features)}</section>
    <section class="answer-strip" aria-label="FabGuard 핵심 요약"><article><span>문제</span><strong>모든 생산 건을<br>동시에 볼 수 없음</strong></article><article class="active"><span>FabGuard</span><strong>위험도 순으로<br>점검 대상을 추천</strong></article><article><span>사람의 역할</span><strong>엔지니어가 확인하고<br>최종 조치를 결정</strong></article><article class="boundary"><span>현재 경계</span><strong>공개데이터 실험<br>현장 효과는 미검증</strong></article></section>
    <section class="plain-guide" aria-label="FabGuard 작동 방식"><div><span>01 · 데이터 입력</span><strong>생산 과정의 측정값</strong><p>공개 데이터에 포함된 ${ds.samples.toLocaleString()}건의 생산 기록과 ${ds.measurement_features}개 익명 변수를 사용합니다.</p></div><div><span>02 · AI 분석</span><strong>위험도가 높은 순서로 정렬</strong><p>모든 생산 건을 판정하지 않고, 제한된 점검 시간을 어디에 먼저 쓸지 제안합니다.</p></div><div><span>03 · 사람의 판단</span><strong>엔지니어가 확인하고 결정</strong><p>실제 센서·설비·공정 이력을 대조한 뒤 재검사와 설비점검 여부를 결정합니다.</p></div></section>
    <section class="data-strip" aria-label="프로젝트 데이터 요약"><div><span>01</span><strong>${ds.samples.toLocaleString()}</strong><small>분석한 생산 기록</small></div><div><span>02</span><strong>${ds.measurement_features}</strong><small>익명 측정변수</small></div><div><span>03</span><strong>${ten.total_fail}</strong><small>검증구간 실제 불량</small></div><div><span>04</span><strong>${queueSize}</strong><small>우선점검 생산 건</small></div></section>
    <section class="story-section" id="result"><div class="section-intro"><p class="kicker">현재 결과</p><h2>${ten.inspection_count}건을 먼저 봤을 때<br>불량 ${ten.captured_fail}건을 찾았습니다.</h2><p>전체 검증구간을 무작정 확인하는 대신 AI 위험도가 높은 상위 10%를 먼저 살펴본 결과입니다. 아직 독립 현장 데이터에서 다시 검증해야 하는 잠정 결과입니다.</p></div><div class="command-panel"><div class="panel-head"><span>검증 결과 요약</span><span class="live"><i></i> 잠정 결과</span></div><div class="metrics-grid"><article><span>위험순위 품질 지표</span><strong>${num(test.pr_auc_average_precision)}</strong><small>PR-AUC · 높을수록 불량 순위화가 좋음</small></article><article><span>먼저 찾은 불량</span><strong>${ten.captured_fail}<em> / ${ten.total_fail}</em></strong><small>${ten.inspection_count}건 점검으로 전체 불량의 ${pct(ten.fail_capture_rate)} 포착</small></article><article><span>무작위 점검 대비 효율</span><strong>${num(ten.lift, 2)}<em>배</em></strong><small>같은 수를 무작위로 점검했을 때와 비교</small></article></div><div class="caution"><span>꼭 확인하세요</span><p>실제 공장 성과나 불량 원인을 입증한 결과가 아닙니다. 공개 데이터에서 우선점검 방식의 가능성을 시험한 결과입니다.</p></div></div></section>
    <section class="advanced-evidence"><div class="section-heading"><div><p class="kicker">PHASE 1 / 고급 검증</p><h2>점추정치보다<br>변동성과 불확실성을 봅니다.</h2></div><p>같은 시간순 테스트 구간을 유지한 추가 검증입니다. 비용은 실제 금액이 아니라 점검 전략을 비교하기 위한 가정값입니다.</p></div><div class="evidence-cards"><article><span>확률 보정 · ECE</span><strong>${state.phase1.ece.before.toFixed(3)} <i>→</i> ${state.phase1.ece.after.toFixed(3)}</strong><p>예측 확률과 실제 결과의 차이가 감소했습니다. 단, ${state.phase1.ece.bins}개 구간 중 표본이 존재한 구간은 ${state.phase1.ece.populated_bins}개입니다.</p></article><article><span>비용 시나리오 내 최저</span><strong>상위 ${pct(state.phase1.best_cost.k_fraction)}</strong><p>${num(state.phase1.best_cost.total_cost, 0)}점 · 무점검 ${num(state.phase1.best_cost.no_review_cost, 0)}점 대비 ${num(state.phase1.best_cost.reduction, 0)}점 감소</p></article><article><span>${state.phase1.walk_forward.folds}구간 Walk-forward PR-AUC</span><strong>${state.phase1.walk_forward.min.toFixed(3)}–${state.phase1.walk_forward.max.toFixed(3)}</strong><p>구간별 변동이 커서 단일 홀드아웃 수치를 대표 성능으로 볼 수 없습니다.</p></article></div><div class="uncertainty-note"><b>${Math.round(state.phase1.top10_capture.confidence * 100)}% 부트스트랩 구간</b><p>상위 10% 불량 포착률은 ${pct(state.phase1.top10_capture.low)}–${pct(state.phase1.top10_capture.high)}로 넓습니다(${state.phase1.top10_capture.bootstrap_replicates.toLocaleString()}회). 희소 불량 표본이 작아 실제 현장 성능으로 확대 해석할 수 없습니다.</p></div></section>
    <section class="pipeline-section"><div class="section-heading"><div><p class="kicker">SYSTEM / 02</p><h2>누출을 막고, 위험을 정렬하다.</h2></div><p>모든 전처리는 학습 폴드에만 적합하고 마지막 25% 구간은 시간순 홀드아웃으로 분리했습니다.</p></div><div class="pipeline"><article><span>01</span><i>DATA</i><h3>SECOM 입력</h3><p>${ds.samples.toLocaleString()}건 · ${ds.measurement_features}변수</p></article><article><span>02</span><i>GUARD</i><h3>누출 방지 전처리</h3><p>학습 폴드 내부 적합</p></article><article><span>03</span><i>MODEL</i><h3>위험도 산출</h3><p>비교·선택·홀드아웃</p></article><article><span>04</span><i>ACTION</i><h3>우선점검 큐</h3><p>Top-k 의사결정 지원</p></article></div></section>
    <section class="budget-section"><div class="section-heading"><div><p class="kicker">EVIDENCE / 03</p><h2>점검 범위별 Fail 포착률</h2></div><p>위험도가 높은 생산 건부터 확인했을 때의 시간순 홀드아웃 결과입니다.</p></div><div class="budget-grid">${state.summary.top_k.map((row, index) => `<article><div class="budget-top"><span>TOP ${pct(row.k_fraction)}</span><b>0${index + 1}</b></div><strong>${pct(row.fail_capture_rate)}</strong><div class="bar"><i style="width:${row.fail_capture_rate * 100}%"></i></div><p>${row.inspection_count}건 점검 <span>·</span> Fail ${row.captured_fail}건 포착</p></article>`).join("")}</div></section>
    <section class="decision-section"><div class="section-heading"><div><p class="kicker">HUMAN-IN-THE-LOOP / 04</p><h2>확률은 신호로,<br>판단은 현장으로.</h2></div><p>FabGuard는 AI가 품질을 확정하거나 조치를 자동 실행하지 않습니다. 위험점수와 점검예산을 연결해 엔지니어의 검토 순서를 만듭니다.</p></div><div class="decision-flow"><article><b>01</b><i>RISK SIGNAL</i><h3>위험도 정렬</h3><p>연속 위험점수로 생산 건의 검토 순서를 제시합니다.</p></article><article><b>02</b><i>BUDGET GUARDRAIL</i><h3>점검범위 선택</h3><p>현장 여력에 맞춰 상위 5%·10%·20%를 선택합니다.</p></article><article><b>03</b><i>CONTEXT CHECK</i><h3>4M·변동점 대조</h3><p>익명 변수의 실제 매핑과 품질·공정 이력을 확인합니다.</p></article><article><b>04</b><i>HUMAN DECISION</i><h3>엔지니어 승인</h3><p>재검사·설비점검 여부는 사람이 판단하고 기록합니다.</p></article></div><div class="design-boundary"><span>DESIGN BOUNDARY</span><p>중요 익명변수는 원인이 아닌 점검 후보입니다. SECOM만으로 4M 범주, 실제 센서, 수율 개선 또는 비용 절감 효과를 규명하지 않습니다.</p></div></section>
    <section class="integration-section"><div class="section-heading"><div><p class="kicker">SMART FACTORY FIT / 05</p><h2>현장 데이터와<br>판단 사이의 한 층.</h2></div><p>실제 확장 시 MES·FDC·검사시스템의 생산 이력을 점검 큐로 바꾸고, 엔지니어 판단과 후속 결과를 다시 추적합니다.</p></div><div class="integration-flow"><article><span>SOURCE</span><h3>설비·검사 데이터</h3><p>Lot·설비·공정·시간 식별자</p></article><article><span>CONTEXT</span><h3>MES · FDC</h3><p>추적 가능한 생산 이력</p></article><article class="active"><span>V1 IMPLEMENTED</span><h3>FabGuard</h3><p>위험점수 · Top-K 점검 큐</p></article><article><span>AUTHORITY</span><h3>엔지니어 검토</h3><p>재검사·설비점검 판단</p></article><article><span>FEEDBACK</span><h3>결과 기록</h3><p>조치·최종 품질·감사 로그</p></article></div><div class="implementation-note"><b>CURRENT BOUNDARY</b><p>V1은 공개 SECOM 데이터의 오프라인 위험순위화만 구현했습니다. 실시간 수집, MES/FDC 연동, 생산 제어와 피드백 저장은 목표 구조이며 구현 완료 기능이 아닙니다.</p></div></section>`;
}

function risksView() {
  if (!state.risks.length) { app.innerHTML = `<section class="state"><h2>표시할 우선점검 생산 건이 없습니다.</h2></section>`; return; }
  app.innerHTML = `<section class="page-hero"><div><p class="kicker">우선점검 목록</p><h1>먼저 확인할<br><span>생산 건 50개</span></h1><p class="lead">AI가 위험 신호가 큰 순서로 정렬한 목록입니다. 위험점수는 불량 확정값이 아니며, 행을 선택하면 엔지니어가 우선 확인할 익명 측정변수와 해석 한계를 볼 수 있습니다.</p></div><div class="queue-stat"><span>점검 후보</span><strong>${state.risks.length}</strong><small>위험도 순으로 정렬</small></div></section><section class="table-shell"><div class="panel-head"><span>시간순 검증구간 · 위험도 상위 목록</span><span class="live"><i></i> 데이터 준비됨</span></div><div class="scroll-hint">← 좌우로 밀어 전체 열 보기 →</div><div class="table-wrap"><table><thead><tr><th>순위</th><th>생산 건 ID</th><th>측정 시각</th><th>위험점수</th><th>실제 결과</th><th>근거 범위</th></tr></thead><tbody>${state.risks.map(row => `<tr data-id="${esc(row.sample_id)}"><td><b>#${String(row.rank).padStart(2, "0")}</b></td><td>${esc(row.sample_id)}</td><td><span class="timestamp-full">${esc(row.timestamp)}</span><span class="timestamp-short">${esc(shortTimestamp(row.timestamp))}</span></td><td class="risk"><span>${pct(row.risk_score)}</span></td><td><i class="label-dot ${row.label === 1 ? "fail" : "pass"}"></i>${row.label === 1 ? "불량" : "정상"}</td><td>${esc(row.evidence_scope)}</td></tr>`).join("")}</tbody></table></div></section>`;
  document.querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", () => location.hash = `detail/${row.dataset.id}`));
}

function detailView(id) {
  const row = state.risks.find(item => item.sample_id === id);
  if (!row) { app.innerHTML = `<section class="state"><h2>생산 건을 찾을 수 없습니다.</h2><a class="button" href="#risks">목록으로</a></section>`; return; }
  const features = String(row.suggested_features).split(";");
  app.innerHTML = `<section class="page-hero detail-hero"><div><p class="kicker">우선순위 ${String(row.rank).padStart(2, "0")}</p><h1>${esc(row.sample_id)}</h1><p class="lead">${esc(row.timestamp)} · 시간순 검증구간의 생산 건</p></div><a class="text-link" href="#risks">← 우선점검 목록</a></section><section class="detail-grid"><article><span>AI 위험점수</span><strong>${pct(row.risk_score)}</strong></article><article><span>고정 기준 예측</span><strong>${row.prediction === 1 ? "불량" : "정상"}</strong></article><article><span>데이터의 실제 결과</span><strong>${row.label === 1 ? "불량" : "정상"}</strong></article></section><section class="evidence-panel"><div><p class="kicker">점검 제안</p><h2>우선 확인할 익명 변수</h2><p>이 변수들은 불량 원인이 아니라 후속 점검을 시작할 후보입니다.</p></div><div class="features">${features.map((feature, index) => `<span><b>0${index + 1}</b>${esc(feature)}</span>`).join("")}</div></section><section class="review-prompt"><span>엔지니어 확인</span><p><b>다음 단계:</b> 익명 변수의 실제 센서·공정 매핑 → 4M 및 변동점 기록 → 품질 이력 대조 → 재검사·설비점검 여부를 사람이 결정합니다.</p></section><div class="caution full"><span>해석할 때 주의</span><p>${esc(row.limitation)}</p></div>`;
}

function limitationsView() {
  app.innerHTML = `<section class="page-hero"><div><p class="kicker">검증과 한계</p><h1>어떻게 검증했고,<br><span>무엇을 말하지 않는가</span></h1><p class="lead">결과를 과장하지 않기 위해 검증 방식과 주장하지 않는 범위를 누구나 확인할 수 있게 공개합니다.</p></div><div class="validation-seal"><span>V1</span><small>잠정 모델<br>독립 검증 필요</small></div></section>
    <section class="validation-grid"><article><b>01</b><p class="kicker">VALIDATION DESIGN</p><h2>시간순 검증</h2><p>학습 데이터 내부 5×5 반복 층화 교차검증과 마지막 25% 시간순 홀드아웃을 분리했습니다. 전처리는 각 학습 폴드에만 적합했습니다.</p></article><article><b>02</b><p class="kicker">MODEL SELECTION</p><h2>선택 기준</h2><p>Random Forest는 학습 구간 CV의 PR-AUC가 가장 높아 선택했습니다. 0.5 임계값의 Fail recall은 0이었지만, 목표가 자동 판정이 아닌 위험순위화이므로 연속 위험점수의 Top-k 성능을 별도로 평가했습니다.</p></article><article><b>03</b><p class="kicker">RESULT STATUS</p><h2>잠정 결과</h2><p>개발 스모크 과정에서 홀드아웃이 먼저 노출됐습니다. 익명 변수의 원인성이나 실제 수율 개선을 주장하지 않으며, 확정 성능에는 독립 데이터 재검증이 필요합니다.</p></article></section>
    <section class="principles-note"><div><p class="kicker">OPERATING PRINCIPLES / 04</p><h2>확률모델 위에<br>가드레일을 둡니다.</h2></div><div class="principles-list"><p><b>PROBABILISTIC SIGNAL</b> 위험점수는 확정 판정이 아니라 검토 순서를 만드는 신호입니다.</p><p><b>DETERMINISTIC GUARDRAIL</b> 점검예산·표시형식·익명변수 한계·인간 승인을 고정합니다.</p><p><b>HUMAN AUTHORITY</b> 재검사·설비점검·공정조치는 엔지니어가 결정합니다.</p></div><small>Industrial AI·생산기술·생산관리·스마트제조 자료는 운영 설계에만 참고했으며 학습 데이터, 성능 증거 또는 반도체 공정 원인 근거로 사용하지 않았습니다.</small></section>
    <section class="evidence-ladder"><div><p class="kicker">EVIDENCE LADDER / 05</p><h2>측정한 것과<br>검증할 것을 분리합니다.</h2><p>스마트제조 연구에서 사용하는 성과지표를 향후 검증 항목으로 참고하되, FabGuard V1의 효과로 전용하지 않습니다.</p></div><div class="evidence-levels"><article class="measured"><span>MEASURED</span><h3>모델·운영 시뮬레이션</h3><p>PR-AUC · Top-K 포착률 · Lift · 점검 건수</p></article><article><span>FIELD VALIDATION</span><h3>제조 운영 KPI</h3><p>불량률 · 가동률 · 리드타임 · 의사결정시간</p></article><article><span>NOT CLAIMED</span><h3>사업 성과</h3><p>수율 · 제조원가 · 비용절감 · 매출</p></article></div><div class="implementation-note"><b>CLAIM BOUNDARY</b><p>현재 측정값은 고정 공개데이터의 오프라인 실험 결과입니다. 제조·사업 KPI에는 실제 시스템 연동, 작업 기록과 전후 또는 대조 검증이 필요합니다.</p></div></section>
    <section><div class="section-heading"><div><p class="kicker">FIELD EFFECT / 06</p><h2>도입 전후가 아니라,<br>반사실과 비교합니다.</h2></div><p>현장 KPI가 변해도 곧바로 FabGuard의 효과라고 결론내리지 않습니다. 실제 도입 전 처리·비교조건과 주요 지표를 먼저 고정합니다.</p></div><div class="validation-grid"><article><b>01</b><p class="kicker">CONTROLLED PILOT</p><h2>무작위·단계적 도입</h2><p>가능하면 shift·라인·기간 블록을 배정해 FabGuard 점검 큐 제공군과 기존 절차군을 비교합니다. 전면 도입 시에는 도입 순서를 나눈 단계적 시험을 검토합니다.</p></article><article><b>02</b><p class="kicker">QUASI-EXPERIMENT</p><h2>이중차분·컷오프</h2><p>유사한 미도입 라인과 변화 차이를 비교하거나, 고정된 점검 cutoff가 실제 배정을 결정할 때만 경계 주변의 국소 효과를 검토합니다.</p></article><article><b>03</b><p class="kicker">VALIDITY CHECKS</p><h2>가정·라벨·교란 기록</h2><p>평행추세, cutoff 조작, 동시 공정 변경과 함께 점검된 건에만 결과가 남는 선택적 라벨 편향 및 인간 override를 감사합니다.</p></article></div><div class="implementation-note"><b>PROPOSED PROTOCOL</b><p>위 내용은 향후 현장검증 계획이며 완료된 실험이 아닙니다. 현재 FabGuard가 증명한 범위는 공개데이터의 오프라인 모델·Top-K 결과뿐입니다.</p></div></section>
    <section class="research-note"><div class="research-note-heading"><b class="sequence-number">07</b><p class="kicker">EXTERNAL CONTEXT</p><h2>유사한 실패 양상,<br>직접 비교는 아님.</h2></div><div><p>최근 공개된 독립 벤치마크(Patel, 2026)에서도 SECOM 데이터에 무작위 층화 80/20 분할을 적용한 Random Forest의 F1이 0%로 보고되어, FabGuard가 시간순 25% 홀드아웃에서 관찰한 고정 임계값 분류 실패와 유사한 양상을 보였습니다.</p><p>분할 방식과 평가 지표가 달라 직접 비교할 수는 없지만, 이 사례는 SECOM의 극심한 클래스 불균형에서 고정 임계값 기반 이진 분류가 실패할 수 있음을 보여주는 제한적인 외부 근거입니다.</p><a class="text-link" href="https://arxiv.org/abs/2606.24173" target="_blank" rel="noreferrer">독립 벤치마크 확인 ↗</a></div></section>
    <section class="boundary-quote"><span>THE HONEST RESULT</span><blockquote>“0.5 임계값에서는 Fail을 분류하지 못했습니다.<br>그래서 자동 판정이 아닌 <em>위험순위화</em>에 집중했습니다.”</blockquote><p>실패한 성능을 감추지 않고, 제한된 점검 예산에서 활용 가능한 의사결정 근거로 재정의했습니다.</p></section>`;
}

function route() {
  if (!state.summary) return;
  const hash = location.hash.replace(/^#/, "") || "summary";
  if (hash === "summary") summaryView(); else if (hash === "result") summaryView(); else if (hash === "risks") risksView(); else if (hash === "limitations") limitationsView(); else if (hash.startsWith("detail/")) detailView(decodeURIComponent(hash.slice(7))); else app.innerHTML = `<section class="state"><h2>화면을 찾을 수 없습니다.</h2><a class="button" href="#summary">처음으로</a></section>`;
  if (hash === "result") document.querySelector(".story-section")?.scrollIntoView({ behavior: "smooth" });
  else window.scrollTo({ top: 0, behavior: "instant" });
}

window.addEventListener("hashchange", route);
load();
