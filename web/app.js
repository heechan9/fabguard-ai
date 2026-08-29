const app = document.querySelector("#app");
let state = { summary: null, risks: null };

const pct = value => `${(Number(value) * 100).toFixed(1)}%`;
const num = (value, digits = 3) => Number(value).toFixed(digits);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

async function load() {
  try {
    const [summaryResponse, riskResponse] = await Promise.all([
      fetch("/data/summary.json"),
      fetch("/data/priority_top50.json"),
    ]);
    if (!summaryResponse.ok || !riskResponse.ok) throw new Error("결과 파일 응답이 올바르지 않습니다.");
    state.summary = await summaryResponse.json();
    state.risks = await riskResponse.json();
    route();
  } catch (error) {
    app.innerHTML = `<section class="state"><h2>결과를 불러오지 못했습니다.</h2><p>${esc(error.message)}</p><button class="button" onclick="location.reload()">다시 시도</button></section>`;
  }
}

function selectedTest() {
  return state.summary.test.find(row => row.candidate === state.summary.selected_model);
}

function top10() {
  return state.summary.top_k.find(row => Math.abs(row.k_fraction - 0.1) < 0.001);
}

function summaryView() {
  const test = selectedTest();
  const ten = top10();
  app.innerHTML = `
    <div class="hero">
      <div class="status"><span class="status-dot"></span> V1 잠정 결과</div>
      <p class="eyebrow">Semiconductor manufacturing decision support</p>
      <h1>한정된 점검 자원,<br><span>위험도가 높은 생산 건부터.</span></h1>
      <p class="lead">UCI SECOM의 590개 익명 측정변수를 누출 방지 파이프라인으로 분석해, 엔지니어가 먼저 확인할 생산 건을 위험도 순으로 제시합니다.</p>
    </div>
    <div class="notice"><strong>해석 시 주의</strong><span>시간순 홀드아웃에서 성능이 낮아졌습니다. 아래 수치는 운영 성과가 아닌 의사결정 지원 가능성을 확인한 잠정 실험 결과입니다.</span></div>
    <div class="grid">
      <article class="card metric-card"><span class="label">시간순 홀드아웃 PR-AUC</span><div class="metric">${num(test.pr_auc_average_precision)}</div><span class="meta">학습 구간에서 선택한 모델의 미래 구간 성능</span></article>
      <article class="card metric-card"><span class="label">상위 10% 점검 시 Fail 포착</span><div class="metric">${ten.captured_fail}<small> / ${ten.total_fail}건</small></div><span class="meta">40건을 확인해 전체 Fail의 ${pct(ten.fail_capture_rate)} 포착</span></article>
      <article class="card metric-card"><span class="label">상위 10% 점검 효율</span><div class="metric">${num(ten.lift, 2)}<small>배</small></div><span class="meta">무작위 점검 대비 Fail 발견 효율</span></article>
    </div>
    <section class="section"><div class="section-head"><div><p class="eyebrow">Inspection budget</p><h2>점검 범위별 Fail 포착률</h2></div><p class="section-copy">위험도 상위 생산 건부터 확인할 때의 결과입니다.</p></div><div class="grid">${state.summary.top_k.map(row => `<article class="card budget-card"><div class="label">위험도 상위 ${pct(row.k_fraction)} 점검</div><div class="metric">${pct(row.fail_capture_rate)}</div><div class="bar"><span style="width:${row.fail_capture_rate * 100}%"></span></div><p class="meta">${row.inspection_count}건 점검 · Fail ${row.captured_fail}건 포착</p></article>`).join("")}</div></section>
  `;
}

function risksView() {
  if (!state.risks.length) {
    app.innerHTML = `<section class="state"><h2>표시할 위험 생산 건이 없습니다.</h2><p>priority table 생성 여부를 확인해 주세요.</p></section>`;
    return;
  }
  app.innerHTML = `
    <p class="eyebrow">Priority table</p><h1>우선점검 생산 건</h1>
    <p class="lead">모델이 산출한 위험도 상위 50건입니다. 생산 건을 선택하면 우선 확인할 익명 측정변수와 해석 한계를 볼 수 있습니다.</p>
    <div class="table-wrap section"><table><thead><tr><th>순위</th><th>생산 건</th><th>측정 시각</th><th>위험도</th><th>실제 라벨</th><th>근거 범위</th></tr></thead><tbody>
      ${state.risks.map(row => `<tr data-id="${esc(row.sample_id)}"><td>${row.rank}</td><td>${esc(row.sample_id)}</td><td>${esc(row.timestamp)}</td><td class="risk">${pct(row.risk_score)}</td><td>${row.label === 1 ? "Fail" : "Pass"}</td><td>${esc(row.evidence_scope)}</td></tr>`).join("")}
    </tbody></table></div>`;
  document.querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", () => location.hash = `detail/${row.dataset.id}`));
}

function detailView(id) {
  const row = state.risks.find(item => item.sample_id === id);
  if (!row) {
    app.innerHTML = `<section class="state"><h2>생산 건을 찾을 수 없습니다.</h2><p>목록에서 다시 선택해 주세요.</p><a class="button" href="#risks">목록으로</a></section>`;
    return;
  }
  const features = String(row.suggested_features).split(";");
  app.innerHTML = `
    <p class="eyebrow">Production instance detail</p><h1>생산 건 ${esc(row.sample_id)}</h1>
    <p class="lead">${esc(row.timestamp)} · 위험순위 ${row.rank}위</p>
    <div class="grid"><article class="card metric-card"><span class="label">모델 위험도</span><div class="metric">${pct(row.risk_score)}</div></article><article class="card metric-card"><span class="label">0.5 임계값 예측</span><div class="metric">${row.prediction === 1 ? "Fail" : "Pass"}</div></article><article class="card metric-card"><span class="label">데이터 실제 라벨</span><div class="metric">${row.label === 1 ? "Fail" : "Pass"}</div></article></div>
    <section class="card section"><h2>우선 확인할 익명 변수</h2><div class="features">${features.map(feature => `<span class="pill">${esc(feature)}</span>`).join("")}</div><p class="meta">근거 범위: ${esc(row.evidence_scope)}</p></section>
    <div class="notice">${esc(row.limitation)}</div><a class="button" href="#risks">목록으로 돌아가기</a>`;
}

function limitationsView() {
  app.innerHTML = `<p class="eyebrow">Experiment boundary</p><h1>실험 범위와 한계</h1><p class="lead">FabGuard AI V1의 결과를 과장하지 않기 위해 검증 방식과 주장하지 않는 범위를 명확히 구분했습니다.</p><div class="grid"><article class="card info-card"><span class="card-index">01</span><h2>검증 설계</h2><p class="meta">학습 데이터 내부의 5×5 반복 층화 교차검증과 마지막 25% 시간순 홀드아웃을 분리했습니다. 전처리는 각 학습 폴드에만 적합했습니다.</p></article><article class="card info-card"><span class="card-index">02</span><h2>주장하지 않는 것</h2><p class="meta">익명 변수의 물리적 의미나 불량 원인, 실제 수율 개선, SPC·FDC·APC 시스템 구축 효과를 주장하지 않습니다.</p></article><article class="card info-card"><span class="card-index">03</span><h2>잠정 결과</h2><p class="meta">개발 스모크 과정에서 홀드아웃이 먼저 노출되어 결과를 잠정 상태로 표시합니다. 확정 성능을 주장하려면 독립 데이터 검증이 필요합니다.</p></article></div><div class="notice"><strong>핵심 해석</strong><span>선택 모델은 0.5 임계값에서 Fail을 분류하지 못했습니다. 따라서 이 데모의 초점은 자동 판정이 아니라 제한된 점검 예산에서의 위험순위화입니다.</span></div>`;
}

function route() {
  if (!state.summary) return;
  const hash = location.hash.replace(/^#/, "") || "summary";
  if (hash === "summary") summaryView();
  else if (hash === "risks") risksView();
  else if (hash === "limitations") limitationsView();
  else if (hash.startsWith("detail/")) detailView(decodeURIComponent(hash.slice(7)));
  else app.innerHTML = `<section class="state"><h2>화면을 찾을 수 없습니다.</h2><a class="button" href="#summary">평가 요약으로</a></section>`;
}

window.addEventListener("hashchange", route);
load();
