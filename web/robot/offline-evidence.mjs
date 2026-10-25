// Read-only projection of a pinned, previously executed Python report. No fitting or control.
export const REPORT_SHA256 = '9baf554ecf58ccde92747633ac39942aeacd7ebe6a7d4adca358f88d7724b9dc';
export const METHODS = ['shewhart', 'ewma', 'cusum'];
const metrics = ['detection_delay', 'anomaly_recall', 'miss_rate', 'false_alarm_rate'];
const count = value => Number.isSafeInteger(value) && value >= 0;
const requireValue = condition => { if (!condition) throw Error('보고서 계약 불일치 — 결과를 표시하지 않습니다.'); };

export function summarizeOfflineReport(report) {
  requireValue(report?.run_status === 'exploratory_alarm_activity_only');
  requireValue(report.flags?.includes('reused_development_data') && report.flags.includes('stability_unverified'));
  requireValue(metrics.every(key => report.performance?.[key] === null));
  requireValue(Array.isArray(report.evaluation_files) && report.evaluation_files.length > 0);
  const ids = new Set(), groups = new Set();
  const rows = report.evaluation_files.map(file => {
    requireValue(typeof file.file_id === 'string' && !ids.has(file.file_id)); ids.add(file.file_id);
    requireValue(typeof file.recording_group === 'string'); groups.add(file.recording_group);
    requireValue(file.file_status === 'valid' && count(file.windows_complete) && count(file.windows_evaluable)
      && file.windows_evaluable <= file.windows_complete && count(file.n_gaps));
    requireValue(file.windows_excluded && typeof file.windows_excluded === 'object'
      && Object.values(file.windows_excluded).every(count));
    const alarms = METHODS.map(method => {
      const result = file.methods?.[method];
      requireValue(result?.status === 'alarm_activity_recorded' && count(result.raw_alarms)
        && count(result.episodes) && result.episodes <= result.raw_alarms
        && result.raw_alarms <= file.windows_evaluable);
      return result.raw_alarms;
    });
    return {id: file.file_id, group: file.recording_group, complete: file.windows_complete,
      evaluable: file.windows_evaluable, excluded: file.windows_complete - file.windows_evaluable,
      reasons: Object.entries(file.windows_excluded), gaps: file.n_gaps, alarms};
  });
  return {rows, groups: groups.size, complete: rows.reduce((s, r) => s + r.complete, 0),
    evaluable: rows.reduce((s, r) => s + r.evaluable, 0),
    alarms: METHODS.map((_, i) => rows.reduce((s, r) => s + r.alarms[i], 0)),
    performance: Object.fromEntries(metrics.map(key => [key, null]))};
}

const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
export async function renderOfflineEvidence(root) {
  root.replaceChildren(node('p', '저장된 보고서를 확인 중…'));
  try {
    // A missing report module must not prevent the CSV demo from starting.
    const {REPORT_TEXT} = await import('./offline-report-data.mjs');
    const bytes = new TextEncoder().encode(REPORT_TEXT);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(v => v.toString(16).padStart(2, '0')).join('');
    if (hash !== REPORT_SHA256) throw Error('보고서 SHA-256 불일치 — 결과를 표시하지 않습니다.');
    const summary = summarizeOfflineReport(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)));
    const facts = node('p', `${summary.rows.length}파일 · ${summary.groups}기록 그룹 · 완전 창 ${summary.complete} / 평가 가능 ${summary.evaluable} · raw alarm ${summary.alarms.join(' · ')}건 (Shewhart / EWMA / CUSUM)`);
    const wrap = node('div', ''); wrap.className = 'table-wrap'; wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '저장된 실제 분석 결과 표 (가로 스크롤 가능)');
    const table = node('table', ''); table.append(node('caption', '입력 품질과 경보 활동 — 서로 다른 항목입니다'));
    const head = node('thead', ''), tr = node('tr', '');
    for (const title of ['파일 / 기록 그룹', '입력 품질: 평가 가능 / 완전 창', '입력 품질: 제외 창·gap', 'Shewhart 경보', 'EWMA 경보', 'CUSUM 경보']) {
      const th = node('th', title); th.scope = 'col'; tr.append(th);
    }
    head.append(tr); table.append(head); const body = node('tbody', '');
    for (const row of summary.rows) {
      const line = node('tr', ''), title = node('th', `${row.id} / ${row.group}`); title.scope = 'row'; line.append(title);
      const reasons = row.reasons.map(([key, n]) => `${key}: ${n}`).join(', ');
      for (const text of [`${row.evaluable} / ${row.complete}`, `${row.excluded}개 · gap ${row.gaps}건${reasons ? ' · ' + reasons : ''}`, ...row.alarms.map(String)]) line.append(node('td', text));
      body.append(line);
    }
    table.append(body); wrap.append(table);
    root.replaceChildren(facts, wrap,
      node('p', '입력 품질 제외 0건은 센서 건전성·무고장 인증이 아닙니다. 부분 창은 계산에서 제외됩니다. 센서 변화나 경보는 고장 원인 확정이 아닙니다.'),
      node('p', '탐지 지연 · 재현율 · 놓침률 · 오탐률: 모두 null (이상 시작/종료 라벨과 안정 정상 근거 없음). EWMA 0건은 탐지 성공을 뜻하지 않습니다.'),
      node('p', `보고서 SHA-256: ${hash}`));
    root.dataset.status = 'verified';
  } catch (error) {
    root.replaceChildren(node('p', `보고서 표시 보류: 보고서 파일 누락·형식 오류·해시 불일치 여부를 확인하세요. ${error.message} 경보 0건이나 정상으로 해석하지 마세요.`));
    root.dataset.status = 'withheld';
  }
}
