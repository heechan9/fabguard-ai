import {secomEvidence, scenarioCost, sourceUrl} from '/smt/evidence-model.mjs';
const root = document.querySelector('#secom-evidence');
const esc = value => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pct = value => `${(value*100).toFixed(1)}%`;
const num = value => Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2});
async function init() {
  try {
    const response = await fetch('/data/evidence_snapshot.json');
    if(!response.ok) throw new Error('자료를 읽지 못했습니다.');
    const snapshot = await response.json(), d = secomEvidence(snapshot);
    root.innerHTML = `<p class="eyebrow">SEMICONDUCTOR · OFFLINE MODEL EVALUATION</p><h1>SECOM 반도체 분석</h1><span class="evidence-tag">구현된 예측모델의 과거 평가 · 잠정 결과</span>
      <p class="evidence-intro">반도체 생산 기록의 점검 우선순위를 평가한 연구입니다. 이 화면은 저장된 평가 결과를 읽으며 새로운 예측을 실행하지 않습니다. SMT의 납 도포량·온도·PCB 데이터를 모델 입력으로 사용하지 않습니다.</p>
      <p class="evidence-note evidence-warning"><b>독립적인 확증 결과로 해석할 수 없습니다.</b><br>최종 평가 전 엔지니어링 시험에서 테스트셋을 먼저 확인한 이력이 있습니다. 이후 시간대의 평가 성능도 낮아졌으며, 실제 현장 적용에는 독립 제조 데이터 검증이 필요합니다.</p>
      <dl class="evidence-facts"><div><dt>전체 생산 기록</dt><dd>${num(d.audit.samples)}<small>익명 측정 변수 ${d.audit.measurement_features}개</small></dd></div><div><dt>학습 / 시간순 평가</dt><dd>${num(d.manifest.config.train_size)} / ${num(d.manifest.config.test_size)}<small>기존 시간 분할 유지</small></dd></div><div><dt>학습 교차검증 AP</dt><dd>${d.cv.pr_auc_average_precision_mean.toFixed(4)}<small>표준편차 ${d.cv.pr_auc_average_precision_std.toFixed(4)} · 5×5 반복 검증</small></dd></div><div><dt>후기 테스트 AP</dt><dd>${d.test.pr_auc_average_precision.toFixed(4)}<small>Average Precision · 정확도와 다른 지표</small></dd></div></dl>
      <p class="evidence-note">확보 자료 시각: ${esc(d.audit.timestamp_min.replace('T',' '))} → ${esc(d.audit.timestamp_max.replace('T',' '))}. 원자료 시간대 미표기.<br>결측 셀 ${num(d.audit.missing_cells)}개 (${pct(d.audit.missing_rate)}), 시간 파싱 실패 ${d.audit.timestamp_parse_failures}개. 익명 변수를 실제 장비 센서명이나 불량 원인으로 바꾸어 해석하지 않습니다.</p>
      <article class="evidence-card"><h2>고정 임계값에서의 실제 평가</h2><p class="evidence-scope">선택 모델 ${esc(d.test.candidate)} · 임계값 ${d.test.threshold}</p><p class="evidence-note evidence-warning">실제 Fail ${d.test.tp+d.test.fn}건 중 탐지 ${d.test.tp}건, 누락 ${d.test.fn}건. 이 결과로 운영용 정상/불량 판정을 주장할 수 없습니다.</p><div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">TP · Fail 탐지</th><th scope="col">FN · Fail 누락</th><th scope="col">FP · 오경보</th><th scope="col">TN · Pass 유지</th></tr></thead><tbody><tr><td>${d.test.tp}</td><td>${d.test.fn}</td><td>${d.test.fp}</td><td>${d.test.tn}</td></tr></tbody></table></div></article>
      <article class="evidence-card"><h2>점검 우선순위 평가 · V1</h2><p class="evidence-scope">모델 점수순으로 제한된 수의 기록을 검토했을 때, 과거 테스트셋에서 잡힌 Fail 수입니다.</p><div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">점검 예산</th><th scope="col">점검 기록</th><th scope="col">Fail 포착</th><th scope="col">Fail 포착률</th><th scope="col">점검 정밀도</th></tr></thead><tbody>${d.topK.map(row=>`<tr><th scope="row">상위 ${pct(row.k_fraction)}</th><td>${row.inspection_count} / ${d.manifest.config.test_size}</td><td>${row.captured_fail} / ${row.total_fail}</td><td>${pct(row.fail_capture_rate)}</td><td>${pct(row.precision)}</td></tr>`).join('')}</tbody></table></div><p class="evidence-muted">V1 정본 결과 기준. 후속 보정 실험과 모델 출력·포착 수를 섞지 않습니다.</p></article>
      <details class="evidence-details"><summary>후속 검증과 비용 시나리오 · Phase 1</summary><p>동일 시간 분할을 유지한 별도 후속 실험입니다. 보정은 학습 기간 마지막 20%에서 학습했습니다. ECE ${d.phase1.ece.before.toFixed(4)} → ${d.phase1.ece.after.toFixed(4)}, 시간 창별 AP ${d.phase1.walk_forward.min.toFixed(3)}–${d.phase1.walk_forward.max.toFixed(3)}. Top-10% Fail 포착률의 95% 부트스트랩 구간은 ${pct(d.phase1.top10_capture.low)}–${pct(d.phase1.top10_capture.high)}로 넓습니다.</p>
      <div class="evidence-scenario"><h3 class="evidence-subhead">비용 가정을 바꿔 계산</h3><p><b>시나리오 · 미래 비용 예측 아님.</b> Phase 1에 저장된 점검 수·Fail 누락 수를 고정하고 비용 가정만 바꿉니다. 단위는 가상 비용이며 화폐나 실측 절감액이 아닙니다.</p><div class="evidence-form"><label>기록 1개 점검 비용<input id="inspection-cost" type="number" min="0" max="1000000" step="any" value="1"></label><label>Fail 1개 누락 비용<input id="missed-cost" type="number" min="0" max="1000000" step="any" value="20"></label></div><p>총비용 = 점검 수 × 점검 비용 + Fail 누락 수 × 누락 비용<br>무점검 비용 = 전체 Fail 24건 × 누락 비용</p><div id="cost-result" aria-live="polite"></div><p class="evidence-muted">초기 1:20 가정의 상위 20%: 79×1 + 16×20 = 399, 무점검 24×20 = 480. 해당 Phase 1 실행의 Fail 포착은 8건으로, 위 V1의 7건과 별도입니다.</p></div></details>
      <div class="evidence-links">${[['results/v1/RESULTS_SUMMARY.md','V1 정본 해석'],['results/v1/test_metrics.csv','평가 수치'],['results/v1/top_k_test.csv','점검 예산별 결과'],['results/phase1/README.md','Phase 1 검증'],['docs/TEST_EXPOSURE.md','테스트 노출 기록']].map(([path,label])=>`<a href="${sourceUrl(snapshot,path)}" target="_blank" rel="noopener">${label} ↗</a>`).join('')}<a href="/data/evidence_snapshot.json" download="fabguard-evidence-snapshot.json">표시 근거 JSON 저장 ↓</a></div><p class="evidence-muted">${snapshot.checked_at} 확인한 FabGuard 저장본. 독립 평가 실행기는 구현되어 있지만 실제 독립 제조 데이터 평가 결과는 이번 근거에 포함되지 않았습니다.</p>`;
    const update = () => {
      const result = document.querySelector('#cost-result');
      try {
        const inputs = ['inspection-cost','missed-cost'].map(id=>document.getElementById(id));
        if(inputs.some(input=>input.value.trim()==='')) throw new Error();
        const [inspection, missed] = inputs.map(input=>input.valueAsNumber);
        const rows = d.costs.map(row=>({...row,...scenarioCost(row,inspection,missed)}));
        result.innerHTML=`<div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">점검 예산</th><th scope="col">점검 수 / 누락 Fail</th><th scope="col">가정 총비용</th><th scope="col">무점검 비용</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">상위 ${pct(row.k_fraction)}</th><td>${row.inspection_count} / ${row.missed_fail}</td><td>${num(row.total)}</td><td>${num(row.baseline)}</td></tr>`).join('')}</tbody></table></div>`;
      } catch {result.textContent='두 비용을 모두 0~1,000,000 사이의 숫자로 입력해 주세요.';}
    };
    document.querySelector('#inspection-cost').addEventListener('input',update);
    document.querySelector('#missed-cost').addEventListener('input',update);
    update();
  } catch {root.innerHTML='<p class="evidence-error" role="alert">분석 근거를 불러오지 못했습니다. 새로고침해서 다시 시도해 주세요.</p>';}
}
init();
