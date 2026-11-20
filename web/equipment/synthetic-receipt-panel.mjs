import {runSyntheticReceiptAudit} from './synthetic-receipt-audit.mjs';

const headings = {
  MATCH: '예제 대조 일치 (MATCH)',
  BLOCKED: '검토 보류 (BLOCKED): 마감 이후에만 도착한 필수 기록',
  MISSING: '검토 필요 (MISSING): 접수됐지만 점수 기록 누락',
};

const countCell = value => value === null ? '미실행' : String(value);
function row(label, values) {
  const line = document.createElement('tr');
  const header = document.createElement('th');
  header.scope = 'row';
  header.textContent = label;
  line.append(header);
  for (const value of [values.raw, values.admitted, values.scored]) {
    const cell = document.createElement('td');
    cell.textContent = countCell(value);
    line.append(cell);
  }
  return line;
}

const panel = document.querySelector('#synthetic-receipt');
if (panel) {
  const output = panel.querySelector('#receipt-scenario-output');
  const status = panel.querySelector('#receipt-scenario-status');
  const meta = panel.querySelector('#receipt-scenario-meta');
  const eventsList = panel.querySelector('#receipt-scenario-events');
  const rows = panel.querySelector('#receipt-count-rows');
  const totals = panel.querySelector('#receipt-count-total');
  const buttons = [...panel.querySelectorAll('[data-receipt-case]')];

  function show(selected) {
    for (const button of buttons) button.setAttribute('aria-pressed', 'false');
    output.hidden = true;
    try {
      const result = runSyntheticReceiptAudit(selected.dataset.receiptCase);
      if (!Object.hasOwn(headings, result.status)) throw new Error('Unexpected status');
      selected.setAttribute('aria-pressed', 'true');
      meta.textContent = `합성 예제 ${result.fixtureVersion} · 마감 ${result.cutoff} · 운영 판정 없음`;
      const remarks = [`마감 이후 도착: ${result.lateCount}건. 모두 이번 접수에서 제외.`];
      for (const item of result.lateEvents ?? []) {
        remarks.push(`지연 기록: ${item.id} · 도착 ${item.receivedAt}`);
      }
      if (result.lateOnlyIds.length) remarks.push(`늦게만 도착한 필수 기록: ${result.lateOnlyIds.join(', ')}`);
      if (result.missingScoredIds.length) remarks.push(`점수 기록이 없는 입력: ${result.missingScoredIds.join(', ')}`);
      eventsList.replaceChildren(...remarks.map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
      rows.replaceChildren(...result.groups.map(group => row(`${group.lot} · ${group.tool}`, group)));
      totals.replaceChildren(row('합계', result.totals));
      output.hidden = false;
      status.textContent = `${headings[result.status]}. 마감 이후 도착 ${result.lateCount}건. 운영 판정 없음.`;
    } catch {
      status.textContent = '합성 예제를 실행하지 못했습니다. 이전 결과는 표시하지 않습니다.';
    }
  }

  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', () => show(button));
  }
}
