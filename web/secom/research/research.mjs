// Renders the frozen #170 outputs. Every number comes from data.mjs (generated); none typed by hand.
import {RESEARCH as D} from './data.mjs';
import {FAMILY_LABEL, contrasts, bottomLine, foldsFor, slotsFor} from './model.mjs';

const $ = id => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v); }
  for (const c of children.flat()) if (c !== null && c !== undefined) n.append(c instanceof Node ? c : String(c));
  return n;
}
const svg = (tag, attrs = {}, text) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; };
const f6 = v => v.toFixed(6);
const pct = v => `${(v * 100).toFixed(2)}%`;
const signed = (v, d) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;
const fact = (dt, dd) => el('div', {}, el('dt', {text: dt}), el('dd', {}, dd));

$('head-short').textContent = D.provenance.head.slice(0, 8);

// Horizontally scrollable tables must be reachable by keyboard (WCAG 2.1.1).
function labelScrollRegions() {
  document.querySelectorAll('.table-wrap').forEach(wrap => {
    const caption = wrap.querySelector('caption');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', caption ? `${caption.textContent} (가로 스크롤 가능)` : '표 (가로 스크롤 가능)');
  });
}

// bottom line
const bl = bottomLine(D);
$('bottom-line').replaceChildren(
  el('p', {}, el('b', {text: '결론: '}), bl.anyIncrease ? '행 결측 수 특징이 일부 모델에서 포착을 늘렸으나 개발 실험 근거일 뿐입니다.'
    : '새로 넣은 행 결측 수 특징은 어떤 고정 모델에서도 포착 불량 수를 늘리지 않았습니다.'),
  el('ul', {}, bl.rowMissing.map(c => el('li', {text: `${FAMILY_LABEL[c.family]}: 포착 ${c.capBefore} → ${c.capAfter} / ${bl.denominator}, 평균 AP ${signed(c.dAP, 6)}`}))),
  el('p', {text: `후보 선정·승격·전체 학습 재적합 없음 · 이후 시험 구간 사용 ${D.manifest.test_rows_parsed_or_scored}행 · 운영·데모 모델 변경 없음`}));

// design
const m = D.manifest;
$('design-facts').replaceChildren(
  fact('사용 자료', `UCI SECOM 학습 구간 ${m.training_rows.toLocaleString('ko-KR')}행 (불량 ${m.training_fail}) · 이후 시험 구간은 읽거나 점수 내지 않음`),
  fact('폴드', '학습 구간의 고유 날짜를 연속 4블록으로 나누고, 첫 블록으로 시작해 확장형 3폴드 (같은 날짜는 같은 쪽)'),
  fact('후보', `결측 처리 ${m.feature_modes.length}가지 × 고정 모델 3개 + Dummy 1 = 13 후보 × 3폴드 = ${m.fits} 적합`),
  fact('고정 조건', `seed ${m.seed} · 하이퍼파라미터 탐색 없음 · 후보 선정 ${m.candidate_selection} · 최종 재적합 ${m.final_model_fit ? '있음' : '없음'}`),
  fact('전처리', '열 선택·중앙값·지시변수·스케일링을 폴드마다 학습 구간에서만 새로 적합'));
$('fold-table').tBodies[0].replaceChildren(...D.fold_windows.map(f => el('tr', {},
  el('th', {scope: 'row', text: String(f.fold)}), el('td', {text: `${f.fit_rows} / ${f.fit_fail}`}),
  el('td', {text: `${f.validation_rows} / ${f.validation_fail}`}),
  el('td', {text: `${f.validation_start.slice(0, 10)} ~ ${f.validation_end.slice(0, 10)}`}),
  el('td', {text: String(slotsFor(f.validation_rows))}))));

// summary table + chart
function renderSummary(filter) {
  const rows = D.summary.filter(r => filter === 'all' || r.family === filter);
  $('summary-table').tBodies[0].replaceChildren(...rows.map(r => el('tr', {class: r.family === 'dummy' ? 'dummy-row' : ''},
    el('th', {scope: 'row', text: FAMILY_LABEL[r.family]}), el('td', {}, el('code', {text: r.mode})),
    el('td', {text: `${f6(r.average_precision_mean)} ± ${f6(r.average_precision_std)}`}),
    el('td', {text: `${r.average_precision_min.toFixed(4)} – ${r.average_precision_max.toFixed(4)}`}),
    el('td', {text: `${r.captured_fail_sum} / ${r.validation_fail_sum}`}),
    el('td', {text: foldsFor(D, r.family, r.mode).map(f => `${f.captured_fail}/${f.validation_fail}`).join(' · ')}),
    el('td', {text: pct(r.pooled_fold_budget_capture_rate)}))));
  renderChart(rows);
}
function renderChart(rows) {
  const s = $('capture-chart'), left = 270, right = 60, top = 14, bar = 20, gap = 6;
  const height = top + rows.length * (bar + gap) + 30, width = 760, denom = D.summary[0].validation_fail_sum;
  s.setAttribute('viewBox', `0 0 ${width} ${height}`);
  s.setAttribute('aria-label', `후보별 포착 불량 수, 분모 ${denom}: ` + rows.map(r => `${FAMILY_LABEL[r.family]} ${r.mode} ${r.captured_fail_sum}`).join(', '));
  const scale = v => (width - left - right) * v / denom;
  const kids = [];
  rows.forEach((r, i) => {
    const y = top + i * (bar + gap);
    kids.push(svg('text', {x: left - 8, y: y + bar * .72, 'text-anchor': 'end', class: 'c-label'}, `${FAMILY_LABEL[r.family]} · ${r.mode}`));
    kids.push(svg('rect', {x: left, y, width: Math.max(scale(r.captured_fail_sum), 1), height: bar, class: `c-bar c-${r.family}`}));
    kids.push(svg('text', {x: left + scale(r.captured_fail_sum) + 6, y: y + bar * .72, class: 'c-value'}, `${r.captured_fail_sum}/${denom}`));
  });
  const axisY = top + rows.length * (bar + gap) + 4;
  kids.push(svg('line', {x1: left, x2: width - right, y1: axisY, y2: axisY, class: 'c-axis'}));
  kids.push(svg('text', {x: left, y: axisY + 18, class: 'c-value'}, '0'));
  kids.push(svg('text', {x: width - right, y: axisY + 18, 'text-anchor': 'end', class: 'c-value'}, `${denom} (전체 검증 불량)`));
  s.replaceChildren(...kids);
}
$('family-filter').addEventListener('change', e => renderSummary(e.target.value));
renderSummary('all');
const dummy = D.summary.find(r => r.family === 'dummy');
$('dummy-note').textContent = `Dummy: 표시 포착 ${dummy.captured_fail_sum}/${dummy.validation_fail_sum}은 sample ID 순 정렬의 결과입니다. 동점 경계 때문에 가능한 범위는 ${dummy.tie_capture_min_sum}–${dummy.tie_capture_max_sum}건이고 무작위 동점 처리 기대값은 약 ${dummy.tie_capture_expected_sum.toFixed(3)}건입니다. 최적화된 분류기가 아닙니다.`;

// contrasts
$('contrast-table').tBodies[0].replaceChildren(...contrasts(D).map(c => el('tr', {},
  el('th', {scope: 'row', text: FAMILY_LABEL[c.family]}), el('td', {text: c.label}),
  el('td', {text: signed(c.dAP, 6)}), el('td', {text: `${c.capBefore} → ${c.capAfter} (${c.dCap > 0 ? '+' : ''}${c.dCap})`}),
  el('td', {text: c.reading}))));

// provenance
$('provenance').replaceChildren(
  fact('출처', el('span', {}, `PR #${D.provenance.pr} (${D.provenance.status}) · head `, el('code', {text: D.provenance.head}))),
  ...Object.entries(D.provenance.files).map(([path, sha]) => fact(path.split('/').pop(), el('code', {class: 'hash', text: sha}))),
  fact('실행 환경 (PR 기록)', Object.entries(m.environment).map(([k, v]) => `${k} ${v}`).join(' · ')),
  fact('학습 분할 SHA-256', el('code', {class: 'hash', text: m.train_split_sha256})),
  fact('PR 기록 한계 (원문)', el('ul', {}, m.limitations.map(t => el('li', {text: t})))));

labelScrollRegions();
