// Pure derivations from the generated #170 data. No new modelling, no network.
export const FAMILY_LABEL = Object.freeze({l1_logistic: 'L1 로지스틱', random_forest: '랜덤 포레스트', hist_gradient_boosting: 'HistGradientBoosting', dummy: 'Dummy (prior)'});
export const CONTRASTS = Object.freeze([
  ['filter_only', 'impute_only', '필터 적용 (filter_only − impute_only)'],
  ['current', 'filter_only', '결측 지시변수 추가 (current − filter_only)'],
  ['current_plus_row_missing', 'current', '행 결측 수 추가 (current_plus_row_missing − current)'],
]);

export const slotsFor = rows => Math.ceil(rows * 0.10);
export const key = r => `${r.family}/${r.mode}`;

export function foldsFor(data, family, mode) {
  return data.folds.filter(f => f.family === family && f.mode === mode).sort((a, b) => a.fold - b.fold);
}

export function contrasts(data) {
  const byKey = new Map(data.summary.map(r => [key(r), r]));
  const out = [];
  for (const family of ['l1_logistic', 'random_forest', 'hist_gradient_boosting']) {
    for (const [after, before, label] of CONTRASTS) {
      const a = byKey.get(`${family}/${after}`), b = byKey.get(`${family}/${before}`);
      const dAP = a.average_precision_mean - b.average_precision_mean;
      const dCap = a.captured_fail_sum - b.captured_fail_sum;
      out.push({family, label, after, before, dAP, dCap, capBefore: b.captured_fail_sum, capAfter: a.captured_fail_sum,
        reading: reading(dAP, dCap)});
    }
  }
  return out;
}

function reading(dAP, dCap) {
  const ap = Math.abs(dAP) < 1e-3 ? 'AP 거의 같음' : dAP > 0 ? 'AP 상승' : 'AP 하락';
  const cap = dCap === 0 ? '포착 같음' : dCap > 0 ? `포착 +${dCap}` : `포착 ${dCap}`;
  const disagree = (dAP > 1e-3 && dCap < 0) || (dAP < -1e-3 && dCap > 0);
  return `${ap} · ${cap}${disagree ? ' — AP와 고정 예산 포착이 반대 방향' : ''}`;
}

export function bottomLine(data) {
  const rowMissing = contrasts(data).filter(c => c.after === 'current_plus_row_missing');
  const increased = rowMissing.filter(c => c.dCap > 0);
  return {rowMissing, anyIncrease: increased.length > 0,
    denominator: data.summary[0].validation_fail_sum, inspections: data.summary[0].inspection_count_sum};
}
