import {esc,FEATURES,ASSET_ROOT,sourceLink,distributionData,renderFeature,renderSensitivity} from './distribution-model.mjs';
const root=document.querySelector('#distribution-content');
async function init() {
  try {
    const responses=await Promise.all(['summary.json','monthly_summary.csv','feature_475_sensitivity.json'].map(file=>fetch(ASSET_ROOT+file)));
    if(responses.some(r=>!r.ok)) throw new Error('근거 파일 읽기 실패');
    const [summary,monthly,sensitivity]=await Promise.all([responses[0].json(),responses[1].text(),responses[2].json()]);
    const data=distributionData(summary,monthly,sensitivity);
    root.innerHTML=`<p>고정 학습 기록 <b>${summary.train_n}건 (Pass ${summary.train_pass} · Fail ${summary.train_fail})</b>만 설명합니다. 시험 392건의 통계·점수, 기존 모델·임계값은 바꾸지 않았습니다. 기존 중요도 상위 5개 순서를 유지하며 새 차이로 변수를 재선택하지 않았습니다.</p><p class="evidence-note"><b>관측값 EDA ≠ 모델 입력</b><br>이 표와 그림은 결측을 대치하지 않은 observed-only 기술통계입니다. 기존 모델은 학습 폴드에만 적합한 품질 필터·중앙값 대치·결측 indicator를 사용합니다(로지스틱 경로는 추가 표준화). 대치값은 관측값으로 세지 않으며 여기서 새 fit은 하지 않습니다.</p><p class="evidence-note evidence-warning">전체 평균 차이가 양수여도 feature_065는 월별 음/양/음, feature_475는 양/음/양으로 뒤집힙니다. feature_247/519는 9월 Fail 관측 7 / 전체 15건입니다. 관측 연관성은 추가 검증 가설이지 원인 확정이 아닙니다.</p><label class="distribution-selector" for="distribution-feature">살펴볼 익명 변수<select id="distribution-feature">${FEATURES.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></label><p id="distribution-period" class="evidence-muted">학습 구간: ${esc(summary.train_start)} ~ ${esc(summary.train_end)} (원자료 시간대 미표기). 월별 표는 새 모델 분할이 아니며 7월·9월은 완전한 달이 아닙니다. 9월은 29일 11:13까지입니다. 표본 독립성·정상 안정성을 가정하지 않습니다.</p><div id="distribution-feature-content" aria-live="polite" aria-atomic="true"></div><details class="evidence-details"><summary>선택 사항 · feature_475 극단값 민감도 보기</summary><p>38.2143은 <b>Fail군 최대</b>이며 전체 최대는 Pass군 39.3528입니다. 한 그룹의 최대 한 건만 별도 복사본에서 제외한 저장 결과를 비교합니다. 두 시나리오를 동시에 적용하지 않습니다.</p>${renderSensitivity(sensitivity)}<p>Fail 최대 한 건 제외 시 차이가 +0.562853 → +0.140649로 작아집니다. 오류·삭제 필요성·성능 개선의 증거가 아닙니다. 원본 삭제·winsorization·재학습·임계값 변경은 하지 않았습니다.</p></details><p class="evidence-note">익명 변수의 실제 센서명·물리 단위·공정 매핑은 미확인입니다. 학습 자료를 다시 설명한 탐색 결과이며 독립 검증·새 성능이 아닙니다. <a href="/smt/">별도 합성 3D 체험</a>의 검사·보류 상태는 이 SECOM 통계에서 계산하지 않습니다.</p><div class="evidence-links"><a href="${sourceLink('SECOM_DISTRIBUTION_EVIDENCE.md')}">고정 버전의 해석·계산 계약 ↗</a><a href="${ASSET_ROOT}manifest.json">원본 버전·복사본 SHA-256</a><a href="${ASSET_ROOT}summary.json" download>학습 요약 JSON ↓</a><a href="${ASSET_ROOT}monthly_summary.csv" download>월별 원표 CSV ↓</a><a href="${ASSET_ROOT}feature_475_sensitivity.json" download>민감도 JSON ↓</a></div>`;
    const select=document.querySelector('#distribution-feature'),output=document.querySelector('#distribution-feature-content');
    const update=()=>{output.innerHTML=renderFeature(data,select.value);};
    select.addEventListener('change',update); update();
  } catch {
    root.innerHTML=`<p class="evidence-error" role="alert">학습 분포 근거를 불러오지 못했습니다. 기존 성능 결과와는 별도입니다. 새로고침하거나 <a href="${sourceLink('SECOM_DISTRIBUTION_EVIDENCE.md')}">고정 버전 근거 문서</a>를 확인해 주세요.</p>`;
  }
}
init();
