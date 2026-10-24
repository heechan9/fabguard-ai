// Display model for alarm-activity results. Pure (no DOM).
// Rule: something that was not evaluated is never shown as "no alarm" or 0%.
// null, undefined, NaN and 0 are kept distinct; only a recorded integer 0 means "0 raw alarms".

export const NOT_EVALUATED = '평가 불가';
const REASON_TEXT = {
  unavailable_calibration_failed: 'calibration 실패: 사전 고정 grid에서 경보 예산을 만족하는 임계값이 없음 (grid 확장 안 함)',
  result_missing: '결과 없음',
  result_field_invalid: '결과 필드가 비었거나 숫자가 아님',
};

const isCount = v => Number.isInteger(v) && v >= 0;

/** Text for a numeric value: null/undefined/NaN/±Inf -> 'null', never 'NaN'. */
export function showNumber(v, digits = 4) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'null';
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}
export function showPercent(v) {
  return typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : 'null';
}

/** One table row for one detection method on one evaluation file. */
export function methodRow(method, result) {
  const notEvaluated = reasonCode => ({
    method, evaluated: false, reasonCode, reason: REASON_TEXT[reasonCode] || reasonCode,
    rawAlarms: null, episodes: null, anyAlarm: null, activity: null, resets: null,
    cells: [NOT_EVALUATED, NOT_EVALUATED, `${NOT_EVALUATED} (보류)`, 'null', `${NOT_EVALUATED} · ${REASON_TEXT[reasonCode] || reasonCode}`],
  });
  if (!result || typeof result !== 'object') return notEvaluated('result_missing');
  if (result.status !== 'alarm_activity_recorded') return notEvaluated(result.status || 'result_missing');
  const {raw_alarms: raw, episodes, alarm_activity_per_evaluable_window: activity} = result;
  if (!isCount(raw) || !isCount(episodes) || !(activity === null || (typeof activity === 'number' && Number.isFinite(activity)))) {
    return notEvaluated('result_field_invalid');
  }
  const resets = Object.entries(result.resets || {}).map(([k, v]) => `${k} ${v}`).join(', ') || '없음';
  return {
    method, evaluated: true, reasonCode: null, reason: null, rawAlarms: raw, episodes, anyAlarm: raw > 0, activity, resets,
    cells: [String(raw), String(episodes), raw > 0 ? '있음' : '없음 (raw alarm 0건)',
      activity === null ? 'null (평가 가능 창 0개)' : showPercent(activity), resets],
  };
}

/** Calibration status text for the reference/calibration table. */
export function calibrationStatus(cal) {
  if (cal?.status === 'calibrated' && typeof cal.threshold === 'number') return `보정됨 · 임계값 ${cal.threshold}`;
  return '보정 실패 — 이 방법은 평가 불가 (grid 확장 안 함)';
}

/** Caption for the alarm-position chart, which marks one method's raw alarms. */
export function alarmChartCaption(method, result) {
  return methodRow(method, result).evaluated
    ? `삼각형: ${method.toUpperCase()} raw alarm 창. 연속된 raw alarm은 episode 하나로 셉니다. 경보는 원인·고장 진단이 아닙니다.`
    : `${method.toUpperCase()}는 ${NOT_EVALUATED}이므로 경보 위치를 표시하지 않습니다. 경보가 없다는 뜻이 아닙니다.`;
}
