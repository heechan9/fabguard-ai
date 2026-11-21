import {runSyntheticReceiptAudit} from './synthetic-receipt-audit.mjs';

const headings = {
  MATCH: '예제 대조 일치',
  BLOCKED: '검토 보류',
  MISSING: '검토 필요',
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

function receiptReason(result) {
  if (result.status === 'BLOCKED') {
    const record = result.lateEvents.find(event => result.lateOnlyIds.includes(event.id));
    const seconds = record ? (Date.parse(record.receivedAt) - Date.parse(result.cutoff)) / 1000 : 0;
    if (result.lateOnlyIds.length === 1 && seconds > 0) return `필수 기록이 마감보다 ${seconds}초 늦게 도착했어요.`;
    return '마감 전 접수되지 않은 필수 기록이 있어요.';
  }
  if (result.status === 'MISSING') return `접수는 됐지만 점수 기록 ${result.missingScoredIds.length}건이 빠졌어요.`;
  return result.lateCount
    ? '늦게 온 기록은 제외했지만 필요한 기록은 모두 마감 시각까지 접수됐어요.'
    : '기대 기록, 마감 내 접수, 점수 기록의 건수가 모두 일치해요.';
}

const panel = document.querySelector('#synthetic-receipt');
if (panel) {
  const output = panel.querySelector('#receipt-scenario-output');
  const detail = panel.querySelector('#receipt-detail');
  const status = panel.querySelector('#receipt-scenario-status');
  const reason = panel.querySelector('#receipt-scenario-reason');
  const rawCount = panel.querySelector('#receipt-raw-count');
  const admittedCount = panel.querySelector('#receipt-admitted-count');
  const scoredCount = panel.querySelector('#receipt-scored-count');
  const meta = panel.querySelector('#receipt-scenario-meta');
  const eventsList = panel.querySelector('#receipt-scenario-events');
  const rows = panel.querySelector('#receipt-count-rows');
  const totals = panel.querySelector('#receipt-count-total');
  const buttons = [...panel.querySelectorAll('[data-receipt-case]')];
  let selectedCase = null;

  function show(selected) {
    for (const button of buttons) button.setAttribute('aria-pressed', 'false');
    output.hidden = true;
    detail.hidden = true;
    panel.removeAttribute('data-receipt-result');
    selectedCase = null;
    try {
      const result = runSyntheticReceiptAudit(selected.dataset.receiptCase);
      if (!Object.hasOwn(headings, result.status)) throw new Error('Unexpected status');
      const explanation = receiptReason(result);
      reason.textContent = explanation;
      rawCount.textContent = countCell(result.totals.raw);
      admittedCount.textContent = countCell(result.totals.admitted);
      scoredCount.textContent = countCell(result.totals.scored);
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
      panel.setAttribute('data-receipt-result', result.status);
      selected.setAttribute('aria-pressed', 'true');
      selectedCase = selected.dataset.receiptCase;
      output.hidden = false;
      detail.hidden = false;
      const label = document.createElement('span');
      label.textContent = headings[result.status];
      const announcement = document.createElement('span');
      announcement.setAttribute('class', 'receipt-status-announcement');
      announcement.textContent = `. ${explanation} 기대 기록 ${rawCount.textContent}건, 마감 내 접수 ${admittedCount.textContent}건, 점수 기록 ${scoredCount.textContent}${result.totals.scored === null ? '' : '건'}. 운영 판정 없음.`;
      status.replaceChildren(label, announcement);
    } catch {
      status.textContent = '합성 예제를 실행하지 못했습니다. 이전 결과는 표시하지 않습니다.';
    }
  }

  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', () => show(button));
  }

  function enterFromAnchor() {
    if (window.location.hash !== '#synthetic-receipt') return;
    const example = buttons.find(button => button.dataset.receiptCase === 'late-only');
    if (!selectedCase && example) show(example);
    panel.focus({preventScroll: true});
    panel.scrollIntoView({block: 'start', behavior: 'instant'});
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', enterFromAnchor);
    // site-shell.mjs sets the actual scroll offset after measuring the sticky header.
    window.requestAnimationFrame(enterFromAnchor);
  }
}
