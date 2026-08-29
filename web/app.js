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
    <p class="eyebrow">Semiconductor manufacturing decision support</p>
    <h1>먼저 확인할 생산 건을<br>위험순으로 정렬합니다.</h1>
    <p class="lead">SECOM의 590개 익명 측정변수를 누출 방지 파이프라인으로 처리해 제한된 점검 자원을 어디에 배치할지 보여주는 재현 가능한 실험입니다.</p>
    <div class="notice"><strong>Provisional result.</strong> ${esc(state.summary.warning)}</div>
    <div class="grid">
      <article class="card"><span class="label">시간 Test PR-AUC</span><div class="metric">${num(test.pr_auc_average_precision)}</div><span class="meta">Train CV에서 선택한 모델의 미래구간 성능</span></article>
      <article class="card"><span class="label">Top-10% Fail 포착</span><div class="metric">${ten.captured_fail}/${ten.total_fail}</div><span class="meta">40건 점검으로 ${pct(ten.fail_capture_rate)} 포착</span></article>
      <article class="card"><span class="label">Top-10% Lift</span><div class="metric">${num(ten.lift, 2)}×</div><span class="meta">무작위 점검 대비 정밀도 비율</span></article>
    </div>
    <section class="section"><h2>점검 예산별 포착률</h2><div class="grid">${state.summary.top_k.map(row => `<article class="card"><div class="label">상위 ${pct(row.k_fraction)}</div><div class="metric">${pct(row.fail_capture_rate)}</div><div class="bar"><span style="width:${row.fail_capture_rate * 100}%"></span></div><p class="meta">${row.inspection_count}건 점검 · Fail ${row.captured_fail}건</p></article>`).join("")}</div></section>
  `;
}

function risksView() {
  if (!state.risks.length) {
    app.innerHTML = `<section class="state"><h2>표시할 위험 생산 건이 없습니다.</h2><p>priority table 생성 여부를 확인해 주세요.</p></section>`;
    return;
  }
  app.innerHTML = `
    <p class="eyebrow">Priority table</p><h1>위험 생산 건 목록</h1>
    <p class="lead">상위 50건을 위험도 순으로 표시합니다. 행을 선택하면 익명 측정변수 근거와 한계를 확인할 수 있습니다.</p>
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
    <p class="eyebrow">Production instance detail</p><h1>${esc(row.sample_id)}</h1>
    <p class="lead">${esc(row.timestamp)} · 위험순위 ${row.rank}위</p>
    <div class="grid"><article class="card"><span class="label">위험도</span><div class="metric">${pct(row.risk_score)}</div></article><article class="card"><span class="label">0.5 기준 예측</span><div class="metric">${row.prediction === 1 ? "Fail" : "Pass"}</div></article><article class="card"><span class="label">실제 라벨</span><div class="metric">${row.label === 1 ? "Fail" : "Pass"}</div></article></div>
    <section class="card section"><h2>우선 확인할 익명 변수</h2><div class="features">${features.map(feature => `<span class="pill">${esc(feature)}</span>`).join("")}</div><p class="meta">근거 범위: ${esc(row.evidence_scope)}</p></section>
    <div class="notice">${esc(row.limitation)}</div><a class="button" href="#risks">목록으로 돌아가기</a>`;
}

function limitationsView() {
  app.innerHTML = `<p class="eyebrow">Experiment boundary</p><h1>실험·한계</h1><div class="grid"><article class="card"><h2>검증</h2><p class="meta">Train 내부 5×5 반복 층화 CV와 마지막 25% 시간 holdout을 분리했습니다. 모든 전처리는 학습 폴드에만 적합합니다.</p></article><article class="card"><h2>비목적</h2><p class="meta">실제 불량 원인, 센서 의미, 수율개선, SPC·FDC·APC 구축을 주장하지 않습니다.</p></article><article class="card"><h2>결과 상태</h2><p class="meta">개발 스모크에서 holdout이 먼저 노출돼 결과를 provisional로 표기합니다. 독립 데이터 검증이 필요합니다.</p></article></div><div class="notice">0.5 임계값에서 선택 모델은 Fail을 분류하지 못했습니다. 따라서 본 데모의 핵심은 분류 자동화가 아니라 제한된 점검 예산에서의 위험순위화입니다.</div>`;
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

