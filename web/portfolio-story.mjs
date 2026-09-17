// Presentation only: consume the existing V1 snapshot; never rerun or tune a model.
const repo = 'https://github.com/heechan9/fabguard-ai/blob/main/';

export function storyEvidence(summary) {
  const test = summary?.test?.find(row => row.candidate === summary.selected_model);
  const top = summary?.top_k?.find(row => Math.abs(row.k_fraction - 0.1) < 0.000001);
  if (summary?.status !== 'provisional' || !test || !top) throw new Error('포트폴리오 결과의 잠정 상태와 근거를 확인할 수 없습니다.');
  const counts = [test.tp, test.fp, test.tn, test.fn, top.inspection_count, top.captured_fail, top.total_fail, top.false_inspections];
  if (!counts.every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('포트폴리오 결과 건수가 올바르지 않습니다.');
  const total = test.tp + test.fp + test.tn + test.fn;
  const expectedLift = (top.captured_fail / top.inspection_count) / (top.total_fail / total);
  if (!total || !top.total_fail || !top.inspection_count || top.total_fail !== test.tp + test.fn || top.captured_fail > top.total_fail || top.captured_fail > top.inspection_count || top.inspection_count > total || top.false_inspections !== top.inspection_count - top.captured_fail || !Number.isFinite(top.lift) || Math.abs(top.lift - expectedLift) > 1e-12) throw new Error('포트폴리오 결과의 분모 또는 계산값이 일치하지 않습니다.');
  return { total, inspected: top.inspection_count, captured: top.captured_fail, failures: top.total_fail, missed: top.total_fail - top.captured_fail, passed: top.false_inspections, lift: top.lift };
}

export function renderHeroEvidence(summary) {
  const e = storyEvidence(summary);
  return `<div class="portfolio-result" aria-label="잠정 평가 결과와 한계">
    <p><strong>${e.inspected}건 우선점검 → 불량 ${e.captured}건 포착</strong></p>
    <p>검증 ${e.total}건 · 전체 불량 ${e.failures}건 중 ${e.missed}건은 점검 범위 밖</p>
    <small>공개 데이터의 잠정 결과 · 홀드아웃 사전 노출 · 현장 효과 미검증</small>
    <a href="${repo}results/v1/RESULTS_SUMMARY.md">결과 원문</a> · <a href="${repo}docs/TEST_EXPOSURE.md">잠정 판정 이유</a>
  </div>`;
}

export function renderPortfolioStory(summary) {
  const e = storyEvidence(summary);
  return `<section class="portfolio-story" id="process" aria-labelledby="process-title">
    <div class="section-heading"><div><p class="kicker">문제 · 선택 · 검증</p><h2 id="process-title">점검 순서를 정하고,<br>판단의 근거를 남깁니다.</h2></div><p>공정·품질·스마트제조 관점에서 확인할 수 있는 세 가지 증거입니다.</p></div>
    <div class="portfolio-cards">
      <article><span class="portfolio-tag">오프라인 평가</span><h3>점검할 여력이 한정된다면?</h3><p>생산 기록을 위험도 순으로 정렬하고, 먼저 살펴볼 범위를 정했습니다.</p><p><b>${e.inspected}건 중 불량 ${e.captured}건 · 정상 ${e.passed}건.</b> 점검 범위 밖의 불량 ${e.missed}건까지 함께 공개합니다.</p><a href="#risks">우선점검 목록 열기 →</a><a href="${repo}results/v1/top_k_test.csv">점검 범위별 원자료</a></article>
      <article><span class="portfolio-tag">가상 공정 체험</span><h3>어디서 사람이 판단해야 할까?</h3><p>SMT 공정과 이상 시나리오를 조작하며 확인할 위치와 판단 경계를 살펴봅니다.</p><p>합성 시나리오입니다. 실제 설비 제어·물리 해석이나 SECOM 모델의 SMT 성능을 증명하지 않습니다.</p><a href="/smt/">가상 공정 체험 열기 →</a><a href="${repo}docs/SMT_INSPECTION_SCENARIOS.md">시나리오와 검증 범위</a></article>
      <article><span class="portfolio-tag">데이터 연결 검증</span><h3>출처가 다른 값을 함께 다룬다면?</h3><p>관측·추정·기준·합성 값을 구분하고, 형식·단위·시간·출처를 확인하는 계약을 구현했습니다.</p><p>태양광 자료의 연결 검증입니다. 반도체 모델의 외부 성능이나 제조 효과로 해석하지 않습니다.</p><a href="#global">출처별 검증 결과 열기 →</a><a href="${repo}results/README.md">국가별 증거 목록</a></article>
    </div>
    <div class="portfolio-proof-flow" aria-label="결과에서 검토 요청까지의 증거 흐름">
      <article><span>01 · 결과</span><h3>${e.inspected}건 우선점검 → 불량 ${e.captured}건</h3><p>전체 ${e.total}건에서 정한 점검 예산의 잠정 결과입니다.</p></article>
      <article><span>02 · 원자료</span><h3>분자와 분모 확인</h3><p>불량 ${e.failures}건 중 ${e.captured}건 포착, ${e.missed}건 누락, 정상 ${e.passed}건 점검.</p><a href="${repo}results/v1/top_k_test.csv">Top-K CSV</a></article>
      <article><span>03 · 계산 검증</span><h3>집중도 ${e.lift.toFixed(2)}배</h3><p>(${e.captured} ÷ ${e.inspected}) ÷ (${e.failures} ÷ ${e.total}) = ${e.lift.toFixed(2)}. 전후 개선율이나 인과효과가 아닙니다.</p></article>
      <article><span>04 · 검토 요청</span><h3>근거의 오류를 알려주세요</h3><p>재현 불일치, 누락된 한계, 화면과 원자료의 차이를 이슈로 남길 수 있습니다.</p><a href="https://github.com/heechan9/fabguard-ai/issues">GitHub 이슈 열기 →</a></article>
    </div>
    <details class="portfolio-decisions"><summary>제작 과정 · 사람과 AI의 역할, 검증에서 드러난 한계</summary>
      <div class="portfolio-process-grid">
        <article><h3>사람이 정한 방향</h3><p>최희찬: 반도체 생산 건 우선점검 문제, 프로젝트 범위와 사용자 관점, 결과의 주장 경계를 결정하고 검토합니다.</p><a href="${repo}docs/governance/CONTRIBUTIONS.md">기여 기록 확인</a></article>
        <article><h3>AI에게 맡긴 구현</h3><p>Codex가 실험·평가 코드, 웹 화면, 기술 문서와 테스트의 대부분을 작성했습니다. 이를 사용자의 단독 직접 코딩 성과로 표시하지 않습니다.</p><a href="${repo}docs/governance/AI_USAGE.md">AI 활용 기록 확인</a></article>
        <article><h3>확인하고 공개한 문제</h3><p>고정 임계값에서 불량을 포착하지 못한 결과와 홀드아웃 사전 노출을 기록했습니다. 자동 불량 판정 성능을 주장하지 않고 잠정 결과로 관리합니다.</p><a href="${repo}docs/TEST_EXPOSURE.md">노출과 변경 이력 확인</a></article>
        <article><h3>아직 필요한 증거</h3><p>독립 제조 데이터와 실제 점검·품질 기록이 필요합니다. 익명 변수의 원인성, 수율 개선, 비용 절감은 입증하지 못했습니다.</p><a href="${repo}docs/INDEPENDENT_DATA_VALIDATION.md">다음 검증 조건 확인</a></article>
      </div>
      <p class="portfolio-credit">역할 설명은 저장소의 기여·AI 활용 기록에 근거합니다. 개별 오류를 사용자가 직접 발견했다는 이력은 추가하지 않았습니다.</p>
    </details>
    <p class="portfolio-question"><b>검토 질문</b> 왜 정확도보다 점검 범위별 포착·누락을 봤을까요? <a href="${repo}docs/validation/EXPERIMENT_CONTRACT.md">평가 기준</a>와 <a href="${repo}docs/validation/REPRODUCIBILITY.md">재현 방법</a>에서 확인할 수 있습니다.</p>
  </section>`;
}
