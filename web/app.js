const app = document.querySelector("#app");
let state = { summary: null, risks: null };

const pct = value => `${(Number(value) * 100).toFixed(1)}%`;
const num = (value, digits = 3) => Number(value).toFixed(digits);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const shortTimestamp = value => {
  const match = String(value ?? "").match(/^\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : String(value ?? "");
};

async function load() {
  try {
    const [summaryResponse, riskResponse] = await Promise.all([fetch("/data/summary.json"), fetch("/data/priority_top50.json")]);
    if (!summaryResponse.ok || !riskResponse.ok) throw new Error("결과 파일 응답이 올바르지 않습니다.");
    state.summary = await summaryResponse.json();
    state.risks = await riskResponse.json();
    route();
  } catch (error) {
    app.innerHTML = `<section class="state"><p class="kicker">SYSTEM ERROR</p><h2>결과를 불러오지 못했습니다.</h2><p>${esc(error.message)}</p><button class="button" onclick="location.reload()">다시 시도</button></section>`;
  }
}

const selectedTest = () => state.summary.test.find(row => row.candidate === state.summary.selected_model);
const top10 = () => state.summary.top_k.find(row => Math.abs(row.k_fraction - 0.1) < 0.001);

function waferVisual() {
  return `<div class="wafer-stage" aria-hidden="true"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="wafer"><div class="wafer-grid"></div><div class="wafer-core"><span>590</span><small>ANONYMOUS<br>VARIABLES</small></div></div><span class="signal signal-a">INGEST_01</span><span class="signal signal-b">RISK_SCORE</span><span class="signal signal-c">QUEUE_READY</span></div>`;
}

function summaryView() {
  const test = selectedTest();
  const ten = top10();
  const baseline = state.summary.test.find(row => row.family === "dummy");
  app.innerHTML = `
    <section class="hero"><div class="hero-copy"><div class="status-chip"><i></i> MANUFACTURING RISK INTELLIGENCE · WEB V2</div><p class="kicker">SEMICONDUCTOR DECISION SUPPORT</p><h1>See the risk.<br><span>Before the line does.</span></h1><p class="hero-ko">한정된 점검 자원을<br><strong>위험도가 높은 생산 건부터.</strong></p><p class="lead">UCI SECOM의 590개 익명 측정변수를 누출 방지 파이프라인으로 분석해 엔지니어의 우선점검 순서를 제시합니다.</p><div class="hero-actions"><a class="button" href="#risks">우선점검 큐 열기 <span>↗</span></a><a class="text-link" href="#limitations">검증 범위 확인 →</a></div></div>${waferVisual()}</section>
    <section class="data-strip" aria-label="프로젝트 데이터 요약"><div><span>01</span><strong>1,567</strong><small>PRODUCTION RUNS</small></div><div><span>02</span><strong>590</strong><small>ANONYMOUS VARIABLES</small></div><div><span>03</span><strong>24</strong><small>FAILS IN HOLDOUT</small></div><div><span>04</span><strong>50</strong><small>PRIORITY QUEUE</small></div></section>
    <section class="story-section"><div class="section-intro"><p class="kicker">MISSION / 01</p><h2>모든 생산 건을<br>동시에 볼 수 없다면.</h2><p>FabGuard는 자동 판정을 주장하지 않습니다. 제한된 엔지니어링 시간을 어디에 먼저 배치할지 제안합니다.</p></div><div class="command-panel"><div class="panel-head"><span>LIVE EVALUATION</span><span class="live"><i></i> PROVISIONAL</span></div><div class="metrics-grid"><article><span>시간순 홀드아웃 PR-AUC</span><strong>${num(test.pr_auc_average_precision)}</strong><small>Dummy 기준 ${num(baseline.pr_auc_average_precision)} 대비</small></article><article><span>상위 10% Fail 포착</span><strong>${ten.captured_fail}<em> / ${ten.total_fail}</em></strong><small>40건 점검 · ${pct(ten.fail_capture_rate)} 포착</small></article><article><span>무작위 대비 점검 효율</span><strong>${num(ten.lift, 2)}<em>×</em></strong><small>상위 10% 기준 Lift</small></article></div><div class="caution"><span>RESULT BOUNDARY</span><p>시간순 홀드아웃에서 성능이 낮아졌습니다. 운영 성과가 아닌 의사결정 지원 가능성을 확인한 잠정 결과입니다.</p></div></div></section>
    <section class="pipeline-section"><div class="section-heading"><div><p class="kicker">SYSTEM / 02</p><h2>누출을 막고, 위험을 정렬하다.</h2></div><p>모든 전처리는 학습 폴드에만 적합하고 마지막 25% 구간은 시간순 홀드아웃으로 분리했습니다.</p></div><div class="pipeline"><article><span>01</span><i>DATA</i><h3>SECOM 입력</h3><p>1,567건 · 590변수</p></article><article><span>02</span><i>GUARD</i><h3>누출 방지 전처리</h3><p>학습 폴드 내부 적합</p></article><article><span>03</span><i>MODEL</i><h3>위험도 산출</h3><p>비교·선택·홀드아웃</p></article><article><span>04</span><i>ACTION</i><h3>우선점검 큐</h3><p>Top-k 의사결정 지원</p></article></div></section>
    <section class="budget-section"><div class="section-heading"><div><p class="kicker">EVIDENCE / 03</p><h2>점검 범위별 Fail 포착률</h2></div><p>위험도가 높은 생산 건부터 확인했을 때의 시간순 홀드아웃 결과입니다.</p></div><div class="budget-grid">${state.summary.top_k.map((row, index) => `<article><div class="budget-top"><span>TOP ${pct(row.k_fraction)}</span><b>0${index + 1}</b></div><strong>${pct(row.fail_capture_rate)}</strong><div class="bar"><i style="width:${row.fail_capture_rate * 100}%"></i></div><p>${row.inspection_count}건 점검 <span>·</span> Fail ${row.captured_fail}건 포착</p></article>`).join("")}</div></section>`;
}

function risksView() {
  if (!state.risks.length) { app.innerHTML = `<section class="state"><h2>표시할 우선점검 생산 건이 없습니다.</h2></section>`; return; }
  app.innerHTML = `<section class="page-hero"><div><p class="kicker">PRIORITY QUEUE</p><h1>Risk-ranked<br><span>production runs.</span></h1><p class="lead">모델 위험도 상위 50건입니다. 행을 선택하면 우선 확인할 익명 측정변수와 해석 한계를 확인할 수 있습니다.</p></div><div class="queue-stat"><span>QUEUE SIZE</span><strong>${state.risks.length}</strong><small>RANKED INSTANCES</small></div></section><section class="table-shell"><div class="panel-head"><span>PRIORITY QUEUE / TEMPORAL HOLDOUT</span><span class="live"><i></i> DATA READY</span></div><div class="scroll-hint">← 좌우로 밀어 전체 열 보기 →</div><div class="table-wrap"><table><thead><tr><th>RANK</th><th>PRODUCTION RUN</th><th>TIMESTAMP</th><th>RISK SCORE</th><th>ACTUAL</th><th>EVIDENCE</th></tr></thead><tbody>${state.risks.map(row => `<tr data-id="${esc(row.sample_id)}"><td><b>#${String(row.rank).padStart(2, "0")}</b></td><td>${esc(row.sample_id)}</td><td><span class="timestamp-full">${esc(row.timestamp)}</span><span class="timestamp-short">${esc(shortTimestamp(row.timestamp))}</span></td><td class="risk"><span>${pct(row.risk_score)}</span></td><td><i class="label-dot ${row.label === 1 ? "fail" : "pass"}"></i>${row.label === 1 ? "FAIL" : "PASS"}</td><td>${esc(row.evidence_scope)}</td></tr>`).join("")}</tbody></table></div></section>`;
  document.querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", () => location.hash = `detail/${row.dataset.id}`));
}

function detailView(id) {
  const row = state.risks.find(item => item.sample_id === id);
  if (!row) { app.innerHTML = `<section class="state"><h2>생산 건을 찾을 수 없습니다.</h2><a class="button" href="#risks">목록으로</a></section>`; return; }
  const features = String(row.suggested_features).split(";");
  app.innerHTML = `<section class="page-hero detail-hero"><div><p class="kicker">INSTANCE / RANK ${String(row.rank).padStart(2, "0")}</p><h1>${esc(row.sample_id)}</h1><p class="lead">${esc(row.timestamp)} · 시간순 홀드아웃 생산 건</p></div><a class="text-link" href="#risks">← PRIORITY QUEUE</a></section><section class="detail-grid"><article><span>MODEL RISK SCORE</span><strong>${pct(row.risk_score)}</strong></article><article><span>0.5 THRESHOLD</span><strong>${row.prediction === 1 ? "FAIL" : "PASS"}</strong></article><article><span>ACTUAL LABEL</span><strong>${row.label === 1 ? "FAIL" : "PASS"}</strong></article></section><section class="evidence-panel"><div><p class="kicker">SUGGESTED INSPECTION</p><h2>우선 확인할 익명 변수</h2><p>이 변수들은 원인 규명이 아닌 후속 점검 후보입니다.</p></div><div class="features">${features.map((feature, index) => `<span><b>0${index + 1}</b>${esc(feature)}</span>`).join("")}</div></section><div class="caution full"><span>INTERPRETATION LIMIT</span><p>${esc(row.limitation)}</p></div>`;
}

function limitationsView() {
  app.innerHTML = `<section class="page-hero"><div><p class="kicker">VALIDATION & BOUNDARIES</p><h1>Evidence first.<br><span>Claims second.</span></h1><p class="lead">결과를 과장하지 않기 위해 검증 방식과 주장하지 않는 범위를 명확하게 공개합니다.</p></div><div class="validation-seal"><span>V1</span><small>PROVISIONAL<br>MODEL</small></div></section><section class="validation-grid"><article><b>01</b><p class="kicker">VALIDATION DESIGN</p><h2>시간순 검증</h2><p>학습 데이터 내부 5×5 반복 층화 교차검증과 마지막 25% 시간순 홀드아웃을 분리했습니다. 전처리는 각 학습 폴드에만 적합했습니다.</p></article><article><b>02</b><p class="kicker">MODEL SELECTION</p><h2>선택 기준</h2><p>Random Forest는 학습 구간 CV의 PR-AUC가 가장 높아 선택했습니다. 0.5 임계값의 Fail recall은 0이었지만, 목표가 자동 판정이 아닌 위험순위화이므로 연속 위험점수의 Top-k 성능을 별도로 평가했습니다.</p></article><article><b>03</b><p class="kicker">RESULT STATUS</p><h2>잠정 결과</h2><p>개발 스모크 과정에서 홀드아웃이 먼저 노출됐습니다. 익명 변수의 원인성이나 실제 수율 개선을 주장하지 않으며, 확정 성능에는 독립 데이터 재검증이 필요합니다.</p></article></section><section class="boundary-quote"><span>THE HONEST RESULT</span><blockquote>“0.5 임계값에서는 Fail을 분류하지 못했습니다.<br>그래서 자동 판정이 아닌 <em>위험순위화</em>에 집중했습니다.”</blockquote><p>실패한 성능을 감추지 않고, 제한된 점검 예산에서 활용 가능한 의사결정 근거로 재정의했습니다.</p></section>`;
}

function route() {
  if (!state.summary) return;
  const hash = location.hash.replace(/^#/, "") || "summary";
  if (hash === "summary") summaryView(); else if (hash === "risks") risksView(); else if (hash === "limitations") limitationsView(); else if (hash.startsWith("detail/")) detailView(decodeURIComponent(hash.slice(7))); else app.innerHTML = `<section class="state"><h2>화면을 찾을 수 없습니다.</h2><a class="button" href="#summary">Overview</a></section>`;
  window.scrollTo({ top: 0, behavior: "instant" });
}

window.addEventListener("hashchange", route);
load();
