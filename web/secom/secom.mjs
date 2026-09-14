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
    const top10 = d.topK.find(row => row.k_fraction === 0.1);
    root.innerHTML = `<p class="eyebrow">실제 반도체 생산 기록으로 해 본 분석</p><h1>먼저 살펴볼 기록을<br>AI가 골라봤습니다.</h1><span class="evidence-tag">과거 자료의 분석 결과 · 현장 적용 전</span>
      <p class="evidence-intro">공개된 반도체 생산 자료(SECOM)로, 문제가 있을 만한 기록을 먼저 고르는 실험을 했어요. 아래는 과거 기록에서 확인한 결과입니다. 현재 SMT 기판의 불량을 예측하는 기능은 아닙니다.</p>
      <p class="evidence-note evidence-warning"><b>아직 실제 공장에서 검증한 성능은 아니에요.</b><br>개발 중 평가 자료를 먼저 확인한 이력이 있고, 이후 기간의 성능도 낮아졌습니다. 별도의 제조 데이터로 다시 검증해야 합니다.</p>
      <section class="plain-result" aria-label="상위 10% 점검 결과"><h2>결과를 숫자 세 개로 보면</h2><p>평가 기록 ${d.manifest.config.test_size}개 중 AI 점수가 높은 상위 10%를 살펴봤을 때</p><div class="result-numbers"><div><span>살펴본 기록</span><strong>${top10.inspection_count}<small>개</small></strong></div><div><span>그중 발견한 불량</span><strong>${top10.captured_fail}<small>개</small></strong></div><div><span>전체 불량 중 찾은 비율</span><strong>${pct(top10.fail_capture_rate)}</strong></div></div><p>전체 불량 ${top10.total_fail}개 중 ${top10.total_fail-top10.captured_fail}개는 이 점검 범위에서 찾지 못했어요. 모든 불량을 찾아내는 자동 검사 기능은 아닙니다.</p></section><details class="evidence-details"><summary>사용한 자료와 성능 점수 자세히 보기</summary><p>AP는 불량 기록을 얼마나 앞쪽에 배치했는지 평가하는 지표입니다. 일반적인 정답률(정확도)과 다릅니다.</p><dl class="evidence-facts"><div><dt>전체 생산 기록</dt><dd>${num(d.audit.samples)}<small>익명 측정 변수 ${d.audit.measurement_features}개</small></dd></div><div><dt>학습 / 시간순 평가</dt><dd>${num(d.manifest.config.train_size)} / ${num(d.manifest.config.test_size)}<small>기존 시간 분할 유지</small></dd></div><div><dt>학습 교차검증 AP</dt><dd>${d.cv.pr_auc_average_precision_mean.toFixed(4)}<small>표준편차 ${d.cv.pr_auc_average_precision_std.toFixed(4)} · 5×5 반복 검증</small></dd></div><div><dt>후기 테스트 AP</dt><dd>${d.test.pr_auc_average_precision.toFixed(4)}<small>Average Precision · 정확도와 다른 지표</small></dd></div></dl>
      <p class="evidence-note">확보 자료 시각: ${esc(d.audit.timestamp_min.replace('T',' '))} → ${esc(d.audit.timestamp_max.replace('T',' '))}. 원자료 시간대 미표기.<br>결측 셀 ${num(d.audit.missing_cells)}개 (${pct(d.audit.missing_rate)}), 시간 파싱 실패 ${d.audit.timestamp_parse_failures}개. 익명 변수를 실제 장비 센서명이나 불량 원인으로 바꾸어 해석하지 않습니다.</p></details>
      <article class="evidence-card"><h2>자동으로 정상·불량을 나누면 어땠나요?</h2><p class="evidence-scope">모델 점수 ${d.test.threshold}를 기준으로 정상과 불량을 나눈 결과예요.</p><p class="evidence-note evidence-warning">실제 불량 ${d.test.tp+d.test.fn}개 중 ${d.test.tp}개를 찾았고, ${d.test.fn}개를 놓쳤어요. 그래서 이 모델을 자동 불량 판정에 쓸 수 있다고 말하지 않습니다.</p><div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">찾은 불량</th><th scope="col">놓친 불량</th><th scope="col">정상을 불량으로 판단</th><th scope="col">정상을 정상으로 판단</th></tr></thead><tbody><tr><td>${d.test.tp}</td><td>${d.test.fn}</td><td>${d.test.fp}</td><td>${d.test.tn}</td></tr></tbody></table></div></article>
      <article class="evidence-card"><h2>조금 더 많이 살펴보면?</h2><p class="evidence-scope">같은 평가 자료에서, AI 점수가 높은 순서로 살펴볼 기록 수를 늘렸을 때의 결과예요.</p><div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th scope="col">살펴볼 범위</th><th scope="col">살펴본 기록</th><th scope="col">찾은 불량 / 전체 불량</th><th scope="col">전체 불량 중 찾은 비율</th><th scope="col">점검한 기록 중 불량 비율</th></tr></thead><tbody>${d.topK.map(row=>`<tr><th scope="row">상위 ${pct(row.k_fraction)}</th><td>${row.inspection_count} / ${d.manifest.config.test_size}</td><td>${row.captured_fail} / ${row.total_fail}</td><td>${pct(row.fail_capture_rate)}</td><td>${pct(row.precision)}</td></tr>`).join('')}</tbody></table></div><p class="evidence-muted">V1 정본 결과 기준. 후속 보정 실험과 모델 출력·포착 수를 섞지 않습니다.</p></article>
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
