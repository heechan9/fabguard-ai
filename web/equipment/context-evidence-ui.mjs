import {buildContextEvidenceCard, followupFields} from './context-evidence-card.mjs';

const gapLabels = {
  signal_class_not_declared: '신호 종류 미확인', measurement_time_not_declared: '계측 시각 미확인',
  measurement_after_review_cutoff: '추가 근거의 계측 시각이 판단 정보 시점보다 늦어 당시 근거로 사용할 수 없음',
  availability_time_not_declared: '조회 가능 시각 미확인', availability_before_measurement: '조회 가능 시각이 계측보다 앞섬 · 기록 확인 필요',
  unavailable_at_review_cutoff: '판단 정보 시점 뒤에야 조회 가능 · 당시 근거로 사용할 수 없음',
  causal_effect_not_established: '원인·정비 효과는 입증되지 않음', wafer_uniformity_not_established: '전면 균일도는 입증되지 않음',
  single_site_cannot_establish_uniformity: '한 위치 측정으로 전면 균일도를 입증할 수 없음',
  measurement_missing: '원본 측정값 없음', history_coverage_unverified: '이력 범위·완전성 미확인',
  change_inside_baseline: '기준 구간 안에 조건 변경', change_after_baseline: '기준 구간 뒤 조건 변경',
  statistical_baseline_requires_review: '통계 기준선 재확인 필요',
};
// Optional annotation UI. Never writes into the original decision package.
export function createEvidencePanel(getSource, doc = document) {
  const $ = id => doc.getElementById(id);
  const fields = ['signal', 'measured', 'available', 'sites', 'claim', 'hypotheses', ...followupFields];
  let token = 0, card = null;
  function invalidate() {
    token++; card = null; $('evidence-export').disabled = true;
    $('evidence-gaps').replaceChildren();
    $('evidence-status').textContent = '미확인 · 조치 판단 안 함. 입력 내용을 정리하려면 버튼을 누르세요.';
  }
  function reset(visible) {
    invalidate(); $('evidence-panel').hidden = !visible;
    for (const field of fields) $(`evidence-${field}`).value = field === 'signal' ? 'unknown' : field === 'claim' ? 'observation' : '';
  }
  for (const field of fields) {
    $(`evidence-${field}`).addEventListener('input', invalidate);
    $(`evidence-${field}`).addEventListener('change', invalidate);
  }
  $('evidence-build').addEventListener('click', async () => {
    invalidate(); const started = token;
    try {
      const source = getSource();
      if (!source.raw) throw Error('먼저 검토 묶음을 여세요.');
      const annotation = {
        signal_class: $('evidence-signal').value,
        claim: $('evidence-claim').value,
        hypotheses: $('evidence-hypotheses').value.split('\n').map(x => x.trim()).filter(Boolean),
      };
      if ($('evidence-measured').value.trim()) annotation.measured_at = $('evidence-measured').value.trim();
      if ($('evidence-available').value.trim()) annotation.available_at = $('evidence-available').value.trim();
      const sites = $('evidence-sites');
      const siteCount = sites.value;
      if (sites.validity?.badInput || (siteCount !== '' && (!/^[0-9]+$/.test(siteCount) ||
          !Number.isSafeInteger(Number(siteCount)) || Number(siteCount) < 1))) {
        throw Error('측정 위치 수는 1 이상의 정수를 숫자(0–9)만 사용해 입력하세요.');
      }
      if (siteCount !== '') annotation.measurement_sites = Number(siteCount);
      for (const field of followupFields) {
        const value = $(`evidence-${field}`).value.trim();
        if (value) annotation[field] = value;
      }
      const result = await buildContextEvidenceCard(source.raw, source.reviewId, annotation);
      if (started !== token) return;
      card = result; $('evidence-export').disabled = false;
      $('evidence-status').textContent = `자기기재 정리 완료 · 근거 검증 안 함 · 조치 판단 안 함 · 원본 상태 ${result.source_context_state}`;
      for (const reason of result.blockers) {
        const item = doc.createElement('li'); item.textContent = gapLabels[reason] || reason; $('evidence-gaps').append(item);
      }
    } catch (error) {
      if (started !== token) return;
      $('evidence-status').textContent = `정리 보류: ${error.message}`;
    }
  });
  $('evidence-export').addEventListener('click', () => {
    if (!card) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(card, null, 2) + '\n'], {type:'application/json'}));
    const a = doc.createElement('a'); a.href = url; a.download = 'context-evidence-annotation.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return {reset};
}
