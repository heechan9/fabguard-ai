/** Anonymous feature evidence: scope is explicit; unknown evidence fails closed. */
export function explanationScope(scope) {
  if (scope === 'global_model_importance') return {
    label: '전체 모델 중요도', title: 'RF 전체 모델의 중요 변수 상위 5개', showFeatures: true,
    description: '모든 생산 건에 동일한 목록입니다. 이 건의 개별 예측 설명이나 위험 원인을 나타내지 않습니다. 익명 변수의 중요도는 실제 센서 원인·인과관계가 아닙니다.'
  };
  if (scope === 'local_linear_contribution') return {
    label: '개별 선형 기여도', title: '이 건의 선형 모델 기여 변수', showFeatures: true,
    description: '변환된 입력과 계수의 곱에 따른 로짓 기여도입니다. 기준값과 전처리에 의존하며, 실제 센서 원인·인과관계를 설명하지 않습니다.'
  };
  return {label: '설명 범위 미확인', title: '변수 설명을 확인할 수 없습니다', showFeatures: false,
    description: '근거 범위를 확인하기 전에는 이 건의 설명으로 해석하지 않습니다.'};
}
