// Robot extension demo UI. Browser-only; no fetch, no upload, no equipment I/O.
import {decodeCSVBytes, parseCSV} from '../equipment/contract.mjs';
import * as core from './window-core.mjs';
import {syntheticFiles, toCSV, SYNTHETIC_CONFIG} from './synthetic.mjs';
import {createLoader} from './load-session.mjs';
import {methodRow, calibrationStatus, alarmChartCaption, showNumber, showPercent} from './report-view.mjs';

const $ = id => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const state = {config: null, files: [], synthetic: false};

const REASONS = {
  timestamp_gap: '시각 공백(gap)', insufficient_samples: '표본 부족', nonfinite_value: 'NaN·무한대 값',
  time_not_strictly_increasing: '시각 역전 또는 중복', time_nonfinite_or_nonnumeric: '시각이 숫자가 아님',
  cadence_mismatch: '표본 간격이 선언값과 다름', shape_invalid: '행이 2개 미만이거나 축 길이가 다름',
  column_schema_mismatch: '열 이름이 Time, A_x [g], A_y [g], A_z [g]와 다름',
  duplicate_source_sha256: '같은 바이트의 파일이 두 번 들어옴', source_verification_failed: '출처 해시 대조 실패',
  reference_windows_insufficient: 'reference 평가 가능 창이 10개 미만', reference_scale_invalid: 'reference 척도가 0 또는 비유한',
  reference_file_invalid: 'reference 파일이 무효', calibration_file_invalid: 'calibration 파일이 무효',
  nominal_period_s_must_be_decimal_string: '공칭 표본 간격을 10진수로 적어야 함',
  min_samples_exceeds_nominal_window_capacity: '최소 표본 수가 창 하나의 공칭 표본 수보다 큼',
  cadence_rel_tolerance_invalid: 'cadence 허용 오차는 0 초과 1 이하', gap_factor_invalid: 'gap 배수는 1 초과',
  min_samples_invalid: '최소 표본 수는 1 이상의 정수',
  value_out_of_range: `|값| > ${core.MAX_ABS_SAMPLE_G.toLocaleString('ko-KR')} g (overflow 방지 상한, 센서 규격 아님)`,
  reference_scale_below_floor: `reference 척도가 ${core.MIN_REFERENCE_SCALE_G} g 미만`,
  detector_statistic_nonfinite: '탐지 통계가 비유한 — 결과 대신 중단',
  decode_failed: '디코딩 실패',
  time_span_exceeds_window_index_limit: `시간 범위가 너무 커서 창 번호를 정확히 표현할 수 없음 (완전 창 ${Number.MAX_SAFE_INTEGER.toLocaleString('ko-KR')}개 초과)`,
};
const STATUS = {
  exploratory_alarm_activity_only: '탐색용 경보 활동만 기록 (성능·안정성 결과 아님)',
  invalid_config: '계약 값 오류 — 중단', invalid_manifest: '그룹·역할 배정 오류 — 중단',
  source_verification_failed: '출처 해시 대조 실패 — 중단', reference_invalid: 'reference 실패 — 중단',
  calibration_failed: 'calibration 실패 — 중단 (grid 확장 없음)',
  numeric_failure: '수치 계산 불가 — 중단 (결과를 만들지 않음)',
};
const label = code => {
  const [head, ...rest] = String(code).split(':');
  const text = REASONS[head] || REASONS[code];
  return text ? `${text}${rest.length ? ` (${rest.join(':')})` : ''} · ${code}` : code;
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c instanceof Node ? c : String(c));
  return node;
}
function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}
const fmt = (v, d = 4) => showNumber(v, d);   // null/undefined/NaN -> 'null', never 'NaN'
const pct = v => showPercent(v);

// Horizontally scrollable tables must be reachable by keyboard (WCAG 2.1.1).
function labelScrollRegions() {
  document.querySelectorAll('.table-wrap').forEach(wrap => {
    const caption = wrap.querySelector('caption');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', caption ? `${caption.textContent} (가로 스크롤 가능)` : '표 (가로 스크롤 가능)');
  });
}

// ---------- contract ----------
function strictNumber(text) {
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text.trim()) ? Number(text) : NaN;
}
function readConfig() {
  const minSamples = $('min-samples').value.trim();
  return core.demoConfig({
    nominal_period_s: $('period').value.trim(),
    cadence_rel_tolerance: strictNumber($('tolerance').value),
    gap_factor: strictNumber($('gap').value),
    min_samples: /^\d+$/.test(minSamples) ? Number(minSamples) : NaN,
    rms_mode: $('rms-mode').value,
    reset_after_alarm: $('reset-after-alarm').checked,
  });
}
function setLocked(locked) {
  for (const id of ['contract-fields', 'detector-fields']) $(id).disabled = locked;
  $('lock').disabled = locked;
  $('unlock').disabled = !locked;
  $('files').disabled = !locked;
}
const canonical = v => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
async function fingerprint(config) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(config)))).slice(0, 16);
}
let lockGeneration = 0;
// Synchronous lock; the fingerprint text is filled in later only if the same lock is still current.
function lockContract(event) {
  event?.preventDefault();
  const config = readConfig();
  const reasons = core.validateConfig(config);
  if (reasons.length) {
    $('contract-status').replaceChildren(el('span', {class: 'bad', text: '고정 실패: '}), reasons.map(label).join(' / '));
    $('period').setAttribute('aria-invalid', reasons.some(r => r.startsWith('nominal') || r.startsWith('min_samples')) ? 'true' : 'false');
    return false;
  }
  $('period').removeAttribute('aria-invalid');
  state.config = config;
  setLocked(true);
  const generation = ++lockGeneration;
  $('contract-status').textContent = '계약 고정됨 · 화면 설정 지문 계산 중…';
  fingerprint(config).then(fp => {
    if (generation === lockGeneration && state.config === config) {
      $('contract-status').textContent = `계약 고정됨 · 화면 설정 지문 ${fp} (UI 전용 표시, Python config_sha256과 형식이 다름)`;
    }
  });
  return true;
}
function unlockContract() {
  lockGeneration++;
  state.config = null; clearAll(false); setLocked(false);
  $('contract-status').textContent = '고정을 해제하고 파일·결과를 모두 지웠습니다. 진행 중이던 파일 읽기도 취소했습니다.';
}

// ---------- files ----------
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const SIZE_LIMIT = 5 * 1024 * 1024;
// Synchronous: decodes the exact bytes that were hashed, with the config captured when the load began.
function ingestRecord(source, bytes, sha256) {
  const fileId = source.name.replace(/\.csv$/i, '');
  const preset = source.preset || {};
  const record = {fileId, name: source.name, size: bytes ? bytes.byteLength : source.size, sha256: sha256 || '',
    group: preset.group ?? core.recordingGroupFromId(fileId) ?? '', role: preset.role ?? '',
    expectedSha256: preset.selfHash ? sha256 : '', note: preset.note ?? '', inputReasons: [], windowed: null};
  try {
    if (bytes === null) throw Error('5MB 이하 CSV만 지원합니다.');
    const series = core.tableToSeries(parseCSV(decodeCSVBytes(bytes)));
    if (series.reasons.length) record.inputReasons = series.reasons;
    else record.windowed = core.windowFile(series.times, series.axes, source.config);
  } catch (error) { record.inputReasons = [`csv_rejected: ${error.message}`]; }
  if (!record.windowed) record.windowed = {file_status: 'invalid', file_reasons: record.inputReasons, windows: [], empty_window_runs: [], windows_complete: 0, partial_tail: null, n_gaps: 0, near_boundary_samples: 0};
  return record;
}
const loader = createLoader({
  digest: async bytes => hex(await crypto.subtle.digest('SHA-256', bytes)),
  process: ingestRecord,
});
// Reset visible state when a new load starts; the previous generation can no longer commit.
function beginLoading(text) {
  state.files = []; state.synthetic = false;
  $('synthetic-banner').hidden = true; $('file-table').hidden = true; $('window-legend').hidden = true;
  $('file-table').tBodies[0].replaceChildren(); $('window-results').replaceChildren(); clearRun();
  $('run').disabled = true;
  $('input-status').textContent = text;
}
function commit(records, synthetic) {
  state.files = records; state.synthetic = synthetic;
  $('synthetic-banner').hidden = !synthetic;
  afterLoad();
}
async function loadUserFiles() {
  const list = [...$('files').files];
  if (!list.length || !state.config) return;
  const config = state.config;
  beginLoading(`${list.length}개 파일을 읽는 중…`);
  const sources = list.map(f => ({name: f.name, size: f.size, config, preset: {},
    read: () => f.size > SIZE_LIMIT ? Promise.resolve(null) : f.arrayBuffer()}));
  const result = await loader.load(sources, records => commit(records, false));
  if (result.status === 'error') $('input-status').textContent = `파일을 읽지 못했습니다: ${result.error?.message || result.error}`;
}
async function loadSynthetic(kind) {
  for (const [id, value] of [['period', SYNTHETIC_CONFIG.nominal_period_s], ['tolerance', '0.05'], ['gap', '3'], ['min-samples', '45']]) $(id).value = value;
  $('rms-mode').value = 'vector'; $('reset-after-alarm').checked = false;
  setLocked(false);
  if (!lockContract()) return;
  const config = state.config;
  beginLoading('SYNTHETIC 합성 시연 파일을 만드는 중…');
  const sources = syntheticFiles(kind).map(f => ({name: `${f.fileId}.csv`, config,
    preset: {group: f.group, role: f.role, note: f.note, selfHash: true},
    read: async () => new TextEncoder().encode(toCSV(f)).buffer}));
  await loader.load(sources, records => commit(records, true));
}
function afterLoad() {
  const invalid = state.files.filter(f => f.windowed.file_status !== 'valid').length;
  $('input-status').textContent = `${state.files.length}개 파일 · 무효 ${invalid}개${state.synthetic ? ' · SYNTHETIC 합성 시연' : ''}`;
  renderFileTable(); renderWindows(); clearRun();
  $('run').disabled = !state.files.length;
}
function clearRun() { $('run-results').replaceChildren(); $('run-status').textContent = ''; }
function clearAll(message = true) {
  loader.cancel();   // any in-flight read/digest is now stale and cannot commit
  state.files = []; state.synthetic = false; $('files').value = '';
  $('synthetic-banner').hidden = true; $('file-table').hidden = true; $('window-legend').hidden = true;
  $('file-table').tBodies[0].replaceChildren(); $('window-results').replaceChildren(); clearRun();
  $('run').disabled = true;
  if (message) $('input-status').textContent = '입력과 결과를 지웠습니다. 진행 중이던 파일 읽기도 취소했습니다.';
}

function renderFileTable() {
  const body = $('file-table').tBodies[0];
  body.replaceChildren(...state.files.map((f, i) => {
    const group = el('input', {value: f.group, 'aria-label': `${f.fileId} 기록 그룹`, autocomplete: 'off'});
    group.addEventListener('input', () => { f.group = group.value.trim(); clearRun(); });
    const role = el('select', {'aria-label': `${f.fileId} 역할`},
      el('option', {value: '', text: '선택'}), ...core.ROLES.map(r => el('option', {value: r, text: r, selected: f.role === r})));
    role.addEventListener('change', () => { f.role = role.value; clearRun(); });
    const expected = el('input', {value: f.expectedSha256, 'aria-label': `${f.fileId} 예상 SHA-256`, autocomplete: 'off', spellcheck: 'false', placeholder: '64자리 16진수'});
    expected.addEventListener('input', () => { f.expectedSha256 = expected.value.trim().toLowerCase(); clearRun(); });
    const ok = f.windowed.file_status === 'valid';
    return el('tr', {},
      el('th', {scope: 'row'}, el('span', {class: 'file-name', text: f.fileId}), f.note ? el('small', {text: f.note}) : null, el('small', {text: `${f.size.toLocaleString('ko-KR')} bytes`})),
      el('td', {}, el('span', {class: `pill ${ok ? 'pill-ok' : 'pill-bad'}`, text: ok ? '형식 통과' : '무효'})),
      el('td', {}, group), el('td', {}, role),
      el('td', {}, el('code', {class: 'hash', title: f.sha256, text: `${f.sha256.slice(0, 12)}…`})),
      el('td', {}, expected));
  }));
  $('file-table').hidden = !state.files.length;
  labelScrollRegions();
}

// ---------- window view ----------
const KIND = w => w.reasons.includes('timestamp_gap') ? 'gap' : w.reasons.includes('insufficient_samples') ? 'short'
  : w.reasons.includes('nonfinite_value') ? 'nonfinite' : w.reasons.includes('value_out_of_range') ? 'range' : 'ok';
// Items in time order: windows with samples, plus one item per run of empty windows.
// The number of items is bounded by the number of samples, never by the time span.
const stripItems = w => [...w.windows.map(x => ({...x, count: 1})),
  ...(w.empty_window_runs || []).map(r => ({...r, window_index: r.first_index}))].sort((a, b) => a.window_index - b.window_index);
function excludedCounts(w) {
  const out = {};
  w.windows.forEach(x => x.reasons.forEach(r => { out[r] = (out[r] || 0) + 1; }));
  (w.empty_window_runs || []).forEach(run => run.reasons.forEach(r => { out[r] = (out[r] || 0) + run.count; }));
  return out;
}
function strip(w) {
  const items = stripItems(w);
  const total = items.length + (w.partial_tail?.n_samples ? 1 : 0);
  const width = 720, cell = width / Math.max(total, 1);
  const ex = excludedCounts(w), evaluable = w.windows.filter(x => x.status === 'ok').length;
  const desc = `완전 창 ${w.windows_complete}개 중 평가 가능 ${evaluable}, gap ${ex.timestamp_gap || 0}, 표본 부족 ${ex.insufficient_samples || 0}, NaN·무한대 ${ex.nonfinite_value || 0}, 범위 밖 ${ex.value_out_of_range || 0}; 빈 창 구간 ${(w.empty_window_runs || []).length}개는 한 칸씩 압축 표시; 부분 창 표본 ${w.partial_tail?.n_samples || 0}개`;
  const s = svg('svg', {viewBox: `0 0 ${width} 34`, role: 'img', 'aria-label': desc, class: 'strip'});
  items.forEach((x, i) => s.append(svg('rect', {x: (i * cell).toFixed(2), y: 4, width: Math.max(cell - 1, 0.5).toFixed(2), height: 26, class: `w-${KIND(x)}${x.count > 1 ? ' w-run' : ''}`},
    svg('title', {}, document.createTextNode(x.count > 1 ? `빈 창 ${x.first_index}–${x.last_index} (${x.count.toLocaleString('ko-KR')}개, 표본 없음): ${x.reasons.map(label).join(', ')}`
      : `창 ${x.window_index}: ${x.status === 'ok' ? `RMS ${fmt(x.value, 5)} g` : x.reasons.map(label).join(', ')}`)))));
  if (w.partial_tail?.n_samples) s.append(svg('rect', {x: (items.length * cell).toFixed(2), y: 4, width: Math.max(cell - 1, 0.5).toFixed(2), height: 26, class: 'w-tail'}));
  return s;
}
const chartValues = w => core.valuesOf(w).map(v => typeof v === 'number' ? v : null);
function chart(values, {alarms = [], label: aria}) {
  const width = 720, height = 150, pad = 30;
  const finiteVals = values.filter(v => v !== null);
  const s = svg('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': aria, class: 'rms-chart'});
  if (!finiteVals.length) { s.setAttribute('viewBox', `0 0 ${width} 40`); s.append(svg('text', {x: 8, y: 26, class: 'tick'}, document.createTextNode('평가 가능한 창이 없어 RMS를 그리지 않습니다 (보류 사유는 위 띠와 목록 참고)'))); return s; }
  const lo = Math.min(...finiteVals), hi = Math.max(...finiteVals), span = hi - lo || 1;
  const x = i => pad + (i + 0.5) * (width - pad - 8) / values.length;
  const y = v => height - 18 - (v - lo) / span * (height - 34);
  let d = '', pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true;
  });
  s.append(svg('line', {x1: pad, x2: width - 8, y1: height - 16, y2: height - 16, class: 'axis'}));
  s.append(svg('text', {x: 2, y: 12, class: 'tick'}, document.createTextNode(`${fmt(hi, 6)} g`)));
  s.append(svg('text', {x: 2, y: height - 20, class: 'tick'}, document.createTextNode(`${fmt(lo, 6)} g`)));
  s.append(svg('path', {d: d.trim(), class: 'rms-line'}));
  values.forEach((v, i) => { if (v === null) s.append(svg('rect', {x: (x(i) - 2).toFixed(1), y: 10, width: 4, height: height - 26, class: 'na-band'})); });
  alarms.forEach(i => values[i] !== null && s.append(svg('path', {d: `M${x(i).toFixed(1)},${(y(values[i]) - 12).toFixed(1)} l-5,-9 h10 z`, class: 'alarm-mark'})));
  return s;
}
function renderWindows() {
  $('window-legend').hidden = !state.files.length;
  $('window-results').replaceChildren(...state.files.map(f => {
    const w = f.windowed, card = el('article', {class: 'file-card'});
    card.append(el('h3', {}, f.fileId, ' ', el('span', {class: `pill ${w.file_status === 'valid' ? 'pill-ok' : 'pill-bad'}`, text: w.file_status === 'valid' ? '창 분할 완료' : '파일 무효 · 계산하지 않음'})));
    if (w.file_status !== 'valid') {
      card.append(el('ul', {class: 'reasons'}, (w.file_reasons.length ? w.file_reasons : ['unknown']).map(r => el('li', {text: label(r)}))));
      return card;
    }
    const excluded = excludedCounts(w);
    const evaluable = w.windows.filter(x => x.status === 'ok').length;
    card.append(el('dl', {class: 'facts'},
      el('div', {}, el('dt', {text: '전체 시간'}), el('dd', {text: `${fmt(w.duration_total_s, 3)} s`})),
      el('div', {}, el('dt', {text: '완전 창 / 평가 가능'}), el('dd', {text: `${w.windows_complete.toLocaleString('ko-KR')} / ${evaluable}`})),
      el('div', {}, el('dt', {text: '보류 사유별 창'}), el('dd', {text: Object.keys(excluded).length ? Object.entries(excluded).map(([k, v]) => `${REASONS[k] || k} ${v.toLocaleString('ko-KR')}`).join(', ') : '없음'})),
      el('div', {}, el('dt', {text: '부분 창 (계산 안 함)'}), el('dd', {text: `${w.partial_tail.n_samples}표본 · ${fmt(w.partial_tail.duration_s, 3)} s`})),
      el('div', {}, el('dt', {text: 'gap 수'}), el('dd', {text: String(w.n_gaps)})),
      el('div', {}, el('dt', {text: '경계 1 ns 이내 표본'}), el('dd', {text: String(w.near_boundary_samples)}))));
    card.append(strip(w));
    card.append(chart(chartValues(w), {label: `${f.fileId} 창별 RMS. 빈 칸은 평가 불가 창이며 선을 잇지 않음`}));
    card.append(el('p', {class: 'caption', text: '위: 창 상태 띠(시간순; 표본이 없는 연속 창은 한 칸으로 압축) · 아래: 창별 RMS (g). 평가 불가 창에서는 선을 끊고 회색 띠로 표시합니다.'}));
    const held = stripItems(w).filter(x => x.status !== 'ok');
    if (held.length) card.append(el('details', {}, el('summary', {text: `보류 항목 ${held.length}개 보기`}),
      el('ul', {class: 'reasons'}, held.slice(0, 50).map(x => el('li', {text: x.count > 1
        ? `빈 창 ${x.first_index}–${x.last_index} (${x.count.toLocaleString('ko-KR')}개, ${fmt(x.start_s, 3)} s~, 표본 없음): ${x.reasons.map(label).join(', ')}`
        : `창 ${x.window_index} (${fmt(x.start_s, 3)} s~, ${x.n_samples}표본): ${x.reasons.map(label).join(', ')}`})))));
    return card;
  }));
}

// ---------- protocol run ----------
function calibrationTable(report) {
  return el('div', {class: 'table-wrap'}, el('table', {}, el('caption', {text: 'reference와 calibration (evaluation 미사용)'}),
    el('thead', {}, el('tr', {}, ['방법', '선택 임계값', '시도한 grid (raw alarm / 평가 가능 창)', '상태'].map(t => el('th', {scope: 'col', text: t})))),
    el('tbody', {}, core.METHODS.map(m => { const cal = report.calibration[m];
      return el('tr', {class: cal.status === 'calibrated' ? '' : 'not-evaluated'}, el('th', {scope: 'row', text: m}),
        el('td', {text: cal.status === 'calibrated' ? fmt(cal.threshold, 1) : 'null (선택 없음)'}),
        el('td', {text: cal.tried.map(t => `${t.threshold}: ${t.raw_alarms}/${t.evaluable_windows}`).join(' · ')}),
        el('td', {text: calibrationStatus(cal)})); }))));
}
function runProtocol() {
  if (!state.config) return;
  const report = core.runProtocol(state.files.map(f => ({fileId: f.fileId, group: f.group, role: f.role, sha256: f.sha256, expectedSha256: f.expectedSha256, windowed: f.windowed})), state.config);
  const ok = report.run_status === 'exploratory_alarm_activity_only';
  $('run-status').replaceChildren(el('span', {class: ok ? 'warn' : 'bad', text: STATUS[report.run_status] || report.run_status}), ` · ${report.run_status}`);
  const out = [];
  if (!ok) {
    out.push(el('div', {class: 'fail-box'}, el('h3', {text: '중단 사유 (성공으로 표시하지 않음)'}), el('ul', {class: 'reasons'}, report.reasons.map(r => el('li', {text: label(r)})))));
    if (report.calibration) out.push(calibrationTable(report));
    out.push(el('p', {class: 'caption', text: '중단된 실행에서는 어떤 방법의 경보 활동도 계산하지 않았습니다. 경보가 없다는 뜻이 아닙니다.'}));
    $('run-results').replaceChildren(...out);
    labelScrollRegions();
    return;
  }
  out.push(el('div', {class: 'stability-box'}, el('h3', {text: '안정성 미확인 · stability_unverified'}),
    el('p', {text: '정상 라벨만으로 안정 정상이라고 판단하지 않습니다. 운전 정보·추세·분포·자기상관·동작 주기 근거가 없으므로 아래 숫자는 경보 활동이며 오탐률이 아닙니다.'}),
    state.synthetic ? el('p', {class: 'synthetic-tag', text: 'SYNTHETIC · 합성 시연 결과 — 실측 로봇 결과 아님'}) : el('p', {class: 'synthetic-tag', text: '사용자 파일 · 출처·운전 조건은 이 화면이 확인하지 않음'}),
    el('p', {class: 'caption', text: '입력 결속: 이 브라우저는 해시를 계산한 바로 그 바이트를 디코딩합니다. 예상 SHA-256은 사용자가 입력한 값이며, 일치는 바이트가 같다는 뜻일 뿐 출처 인증이 아닙니다.'})));
  out.push(calibrationTable(report));
  out.push(el('p', {class: 'caption', text: `reference 중심 ${fmt(report.reference.center, 6)} g · 척도 ${fmt(report.reference.scale, 6)} g · 창 ${report.reference.n_windows}개. 같은 calibration 상한이 같은 실제 오탐률·ARL을 뜻하지 않습니다.`}));
  for (const f of report.evaluation_files) {
    const card = el('article', {class: 'file-card'}, el('h3', {text: `평가 파일 ${f.file_id} · 그룹 ${f.recording_group}`}));
    if (f.file_status !== 'valid') { card.append(el('ul', {class: 'reasons'}, f.file_reasons.map(r => el('li', {text: label(r)})))); out.push(card); continue; }
    card.append(el('p', {class: 'caption', text: `전체 ${fmt(f.duration_total_s, 3)} s 중 평가 가능 ${fmt(f.duration_evaluable_s, 3)} s · 완전 창 ${f.windows_complete}개 중 ${f.windows_evaluable}개 평가 · 제외율 ${pct(f.exclusion_fraction)}`}));
    card.append(el('div', {class: 'table-wrap'}, el('table', {}, el('caption', {text: `${f.file_id} · 방법별 경보 활동 (같은 창·같은 리셋 규칙)`}),
      el('thead', {}, el('tr', {}, ['방법', 'raw alarm', 'episode', '경보 여부', '평가 가능 창당 경보 활동', '리셋'].map(t => el('th', {scope: 'col', text: t})))),
      el('tbody', {}, core.METHODS.map(m => { const row = methodRow(m, f.methods?.[m]);
        return el('tr', {class: row.evaluated ? '' : 'not-evaluated', 'data-method': m, 'data-evaluated': String(row.evaluated)},
          el('th', {scope: 'row', text: m}), ...row.cells.map(c => el('td', {text: c}))); })))));
    const values = chartValues(state.files.find(x => x.fileId === f.file_id).windowed);
    const cusum = f.methods.cusum?.rows || [];   // one row per chart item (empty runs are single items)
    card.append(chart(values, {alarms: cusum.flatMap((r, i) => r.raw_alarm ? [i] : []), label: `${f.file_id} 창별 RMS와 CUSUM raw alarm 위치 (삼각형)`}));
    card.append(el('p', {class: 'caption', text: alarmChartCaption('cusum', f.methods?.cusum)}));
    out.push(card);
  }
  out.push(el('div', {class: 'table-wrap'}, el('table', {}, el('caption', {text: '성능 지표 — 평가 불가'}),
    el('tbody', {}, [['검출 지연', 'detection_delay'], ['재현율', 'anomaly_recall'], ['놓침률', 'miss_rate'], ['오탐률', 'false_alarm_rate']].map(([k, code]) =>
      el('tr', {}, el('th', {scope: 'row', text: `${k} (${code})`}), el('td', {text: 'null · onset/종료 라벨 없음, 안정 정상 미확립'})))))));
  out.push(el('p', {class: 'caption', text: `독립 단위: evaluation 기록 그룹 ${report.independent_units.evaluation_recording_groups}개 (창 수는 독립 세션 수가 아님). 플래그: ${report.flags.join(', ')}`}));
  $('run-results').replaceChildren(...out);
  labelScrollRegions();
}

$('contract').addEventListener('submit', lockContract);
$('unlock').addEventListener('click', unlockContract);
$('files').addEventListener('change', loadUserFiles);
$('synthetic').addEventListener('click', () => loadSynthetic('demo'));
$('synthetic-error').addEventListener('click', () => loadSynthetic('error'));
$('clear').addEventListener('click', () => clearAll());
$('run').addEventListener('click', runProtocol);
labelScrollRegions();
document.querySelector('.skip-link').addEventListener('click', e => { e.preventDefault(); $('robot-main').focus(); });
