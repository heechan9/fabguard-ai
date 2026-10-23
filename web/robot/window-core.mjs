// Browser port of the frozen robot 50 ms window protocol (Python patch robot_window_spc.py).
// Pure functions only: no DOM, no network, no equipment I/O. Results are alarm activity,
// never performance, stability or root cause. Parity with the Python patch is checked on a
// frozen synthetic fixture in tests/web/robot-window.test.mjs.

export const ROLES = Object.freeze(['reference', 'calibration', 'evaluation']);
export const METHODS = Object.freeze(['shewhart', 'ewma', 'cusum']);
export const RMS_MODES = Object.freeze(['axis_x', 'axis_y', 'axis_z', 'vector']);
export const HEADER = Object.freeze(['Time', 'A_x [g]', 'A_y [g]', 'A_z [g]']);
export const NULL_PERFORMANCE = Object.freeze({
  detection_delay: null, anomaly_recall: null, miss_rate: null, false_alarm_rate: null,
  reason: 'no_onset_end_labels_and_stable_normal_not_established'
});

// ---------- exact rationals for window boundaries ----------
const view = new DataView(new ArrayBuffer(8));
export function ratFromDouble(x) {
  if (!Number.isFinite(x)) throw Error('nonfinite');
  view.setFloat64(0, x);
  const hi = view.getUint32(0), lo = view.getUint32(4);
  const sign = hi >>> 31 ? -1n : 1n;
  const exp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (exp === 0) e = -1074; else { mant |= 1n << 52n; e = exp - 1075; }
  if (mant === 0n) return {n: 0n, d: 1n};
  return e >= 0 ? {n: sign * (mant << BigInt(e)), d: 1n} : {n: sign * mant, d: 1n << BigInt(-e)};
}
export function ratFromDecimal(text) {
  if (typeof text !== 'string' || !/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  const n = BigInt(whole + frac), d = 10n ** BigInt(frac.length);
  return n > 0n ? {n, d} : null;
}
const sub = (a, b) => ({n: a.n * b.d - b.n * a.d, d: a.d * b.d});
const add = (a, b) => ({n: a.n * b.d + b.n * a.d, d: a.d * b.d});
const mul = (a, b) => ({n: a.n * b.n, d: a.d * b.d});
const cmp = (a, b) => { const v = a.n * b.d - b.n * a.d; return v > 0n ? 1 : v < 0n ? -1 : 0; };
// Window indices/counts must stay exact in IEEE doubles (JS numbers, JSON). Same limit as
// Python MAX_WINDOWS_PER_FILE; larger spans are rejected before any BigInt->Number conversion.
export const MAX_WINDOWS_PER_FILE = Number.MAX_SAFE_INTEGER;
const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
function floorDivBig(a, b) { // exact floor(a / b), b > 0
  const num = a.n * b.d, den = a.d * b.n;
  const q = num / den;
  return num < 0n && q * den !== num ? q - 1n : q;
}
function floorDiv(a, b) { // as a Number; refuses (throws) instead of rounding an unsafe integer
  const q = floorDivBig(a, b);
  if (q > MAX_SAFE_BIG || q < -MAX_SAFE_BIG) throw new RangeError('unsafe_window_index');
  return Number(q);
}
const bitLength = x => (x < 0n ? -x : x).toString(2).length;
function scale2(x, e) { // x * 2**e without intermediate overflow/underflow of 2**e
  while (e > 1000) { x *= 2 ** 1000; e -= 1000; }
  while (e < -1000) { x *= 2 ** -1000; e += 1000; }
  return x * 2 ** e;
}
// Rational -> Number without Number(n)/Number(d) overflow (both can exceed 2**1024
// for subnormal or huge timestamps). Keeps ~64 significant bits before the final rounding.
function toNumber({n, d}) {
  if (n === 0n) return 0;
  const shift = 64 - (bitLength(n) - bitLength(d));
  const q = shift >= 0 ? (n << BigInt(shift)) / d : n / (d << BigInt(-shift));
  return scale2(Number(q), -shift);
}

// ---------- Python-compatible exact float summation (math.fsum) ----------
export function fsum(values) {
  const partials = [];
  for (let x of values) {
    let i = 0;
    for (let j = 0; j < partials.length; j++) {
      let y = partials[j];
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi = x + y, lo = y - (hi - x);
      if (lo) partials[i++] = lo;
      x = hi;
    }
    partials.length = i;
    partials.push(x);
  }
  let n = partials.length, hi = 0, lo = 0;
  if (n > 0) {
    hi = partials[--n];
    while (n > 0) {
      const x = hi, y = partials[--n];
      hi = x + y; lo = y - (hi - x);
      if (lo) break;
    }
    if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
      const y = lo * 2, x = hi + y;
      if (y === x - hi) hi = x;
    }
  }
  return hi;
}

// ---------- configuration ----------
export function demoConfig(overrides = {}) {
  return {
    window_s: '0.050', boundary: 'left_closed_right_open', anchor: 'file_first_timestamp',
    rms_mode: 'vector', dc_handling: 'none', time_unit: 's', value_unit: 'g',
    nominal_period_s: '', cadence_rel_tolerance: 0.05, gap_factor: 3, min_samples: 45,
    min_reference_windows: 10, ewma_lambda: 0.2, cusum_k: 0.5, reset_after_alarm: false,
    grids: {shewhart: [3, 4, 5], ewma: [3, 4, 5], cusum: [4, 6, 8]},
    max_raw_alarm_fraction: 0.05,
    expected_groups: {reference: 1, calibration: 1, evaluation: 2},
    ...overrides
  };
}
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function validateConfig(c) {
  const r = [];
  const w = ratFromDecimal(c.window_s), p = ratFromDecimal(c.nominal_period_s);
  if (!w) r.push('window_s_must_be_decimal_string');
  if (!p) r.push('nominal_period_s_must_be_decimal_string');
  if (c.boundary !== 'left_closed_right_open') r.push('boundary_unsupported');
  if (c.anchor !== 'file_first_timestamp') r.push('anchor_unsupported');
  if (!RMS_MODES.includes(c.rms_mode)) r.push('rms_mode_unsupported');
  if (c.dc_handling !== 'none') r.push('dc_handling_unsupported');
  if (c.time_unit !== 's') r.push('time_unit_unsupported');
  if (c.value_unit !== 'g') r.push('value_unit_unsupported');
  if (!finite(c.cadence_rel_tolerance) || !(c.cadence_rel_tolerance > 0 && c.cadence_rel_tolerance <= 1)) r.push('cadence_rel_tolerance_invalid');
  if (!finite(c.gap_factor) || !(c.gap_factor > 1)) r.push('gap_factor_invalid');
  if (!Number.isInteger(c.min_samples) || c.min_samples < 1) r.push('min_samples_invalid');
  if (!Number.isInteger(c.min_reference_windows) || c.min_reference_windows < 2) r.push('min_reference_windows_invalid');
  if (!finite(c.ewma_lambda) || !(c.ewma_lambda > 0 && c.ewma_lambda <= 1)) r.push('ewma_lambda_invalid');
  if (!finite(c.cusum_k) || c.cusum_k < 0) r.push('cusum_k_invalid');
  if (typeof c.reset_after_alarm !== 'boolean') r.push('reset_after_alarm_must_be_declared_bool');
  for (const m of METHODS) {
    const g = c.grids?.[m];
    if (!Array.isArray(g) || !g.length || !g.every(t => finite(t) && t > 0) || g.some((t, i) => i && t <= g[i - 1])) r.push(`grid_invalid:${m}`);
  }
  if (!finite(c.max_raw_alarm_fraction) || !(c.max_raw_alarm_fraction >= 0 && c.max_raw_alarm_fraction < 1)) r.push('max_raw_alarm_fraction_invalid');
  if (!ROLES.every(role => Number.isInteger(c.expected_groups?.[role]) && c.expected_groups[role] >= 1)) r.push('expected_groups_invalid');
  if (w && p && Number.isInteger(c.min_samples) && cmp({n: BigInt(c.min_samples), d: 1n}, {n: w.n * p.d, d: w.d * p.n}) > 0) r.push('min_samples_exceeds_nominal_window_capacity');
  return r;
}

// ---------- strict CSV numbers ----------
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const NONFINITE = /^(|nan|NaN|NAN|inf|Inf|INF|\+inf|-inf|Infinity|-Infinity)$/;
export function tableToSeries(data) {
  const reasons = [];
  if (!data || data.headers.length !== HEADER.length || data.headers.some((h, i) => h !== HEADER[i])) {
    return {reasons: ['column_schema_mismatch'], times: null, axes: null};
  }
  const times = [], axes = [[], [], []];
  for (const [rowIndex, row] of data.rows.entries()) {
    if (row.length !== HEADER.length) { reasons.push(`row_shape_invalid:${rowIndex + 2}`); break; }
    const [t, ...vals] = row.map(v => v.trim());
    if (!NUMBER.test(t)) { reasons.push(`time_nonfinite_or_nonnumeric:${rowIndex + 2}`); break; }
    times.push(Number(t));
    for (let a = 0; a < 3; a++) {
      if (NUMBER.test(vals[a])) axes[a].push(Number(vals[a]));
      else if (NONFINITE.test(vals[a])) axes[a].push(NaN);
      else { reasons.push(`value_nonnumeric:${rowIndex + 2}`); break; }
    }
    if (reasons.length) break;
  }
  return reasons.length ? {reasons, times: null, axes: null} : {reasons: [], times, axes};
}

export function recordingGroupFromId(fileId) {
  const i = fileId.lastIndexOf('_dataLog_');
  return i >= 0 ? fileId.slice(0, i) : null;
}

// ---------- numeric guards (same constants as the Python v2 module) ----------
export const MAX_ABS_SAMPLE_G = 1e6;      // overflow guard, not a sensor specification
export const MIN_REFERENCE_SCALE_G = 1e-9;

// ---------- windowing (mirrors window_file v2: sparse, span-independent) ----------
const NEAR_BOUNDARY = {n: 1n, d: 1000000000n};
const invalidFile = reasons => ({file_status: 'invalid', file_reasons: reasons, windows: [], empty_window_runs: [],
  windows_complete: 0, partial_tail: null, n_gaps: 0, near_boundary_samples: 0, duration_total_s: null});

function mergeRanges(ranges) {
  const merged = [];
  for (const [first, last] of [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (merged.length && first <= merged.at(-1)[1] + 1) merged.at(-1)[1] = Math.max(merged.at(-1)[1], last);
    else merged.push([first, last]);
  }
  return merged;
}
function bisectRight(sorted, x) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= x) lo = mid + 1; else hi = mid; }
  return lo;
}
function splitByRanges(first, last, ranges, starts) {
  const pieces = [];
  let cursor = first;
  for (let i = Math.max(bisectRight(starts, first) - 1, 0); i < ranges.length; i++) {
    const [lo, hi] = ranges[i];
    if (lo > last) break;
    if (hi < cursor) continue;
    if (lo > cursor) pieces.push([cursor, lo - 1, false]);
    pieces.push([Math.max(lo, cursor), Math.min(hi, last), true]);
    cursor = Math.min(hi, last) + 1;
    if (cursor > last) break;
  }
  if (cursor <= last) pieces.push([cursor, last, false]);
  return pieces;
}

export function windowFile(times, axes, config) {
  const n = Array.isArray(times) ? times.length : 0;
  if (n < 2 || !Array.isArray(axes) || axes.length !== 3 || axes.some(a => !Array.isArray(a) || a.length !== n)) return invalidFile(['shape_invalid']);
  if (!times.every(finite)) return invalidFile(['time_nonfinite_or_nonnumeric']);
  for (let i = 1; i < n; i++) if (!(times[i] > times[i - 1])) return invalidFile(['time_not_strictly_increasing']);
  const period = ratFromDecimal(config.nominal_period_s), width = ratFromDecimal(config.window_s);
  const exact = times.map(ratFromDouble);
  const diffs = [];
  for (let i = 1; i < n; i++) diffs.push(sub(exact[i], exact[i - 1]));
  diffs.sort(cmp);
  const m = diffs.length >> 1;
  const median = diffs.length % 2 ? diffs[m] : mul(add(diffs[m - 1], diffs[m]), {n: 1n, d: 2n});
  const dev = sub(median, period);
  const absDev = dev.n < 0n ? {n: -dev.n, d: dev.d} : dev;
  if (cmp(absDev, mul(period, ratFromDouble(config.cadence_rel_tolerance))) > 0) return invalidFile(['cadence_mismatch']);

  const t0 = exact[0], tLast = exact[n - 1];
  const nCompleteBig = floorDivBig(sub(tLast, t0), width);
  if (nCompleteBig > MAX_SAFE_BIG) return invalidFile(['time_span_exceeds_window_index_limit']);
  const nComplete = Number(nCompleteBig);   // exact: checked above; every later index is <= nComplete
  const gapLimit = mul(period, ratFromDouble(config.gap_factor));
  let rawRanges = [];
  for (let i = 1; i < n; i++) {
    if (cmp(sub(exact[i], exact[i - 1]), gapLimit) > 0) {
      rawRanges.push([floorDiv(sub(add(exact[i - 1], period), t0), width), floorDiv(sub(exact[i], t0), width)]);
    }
  }
  const nGaps = rawRanges.length;
  const ranges = mergeRanges(rawRanges), starts = ranges.map(r => r[0]);
  const inGap = k => { const i = bisectRight(starts, k) - 1; return i >= 0 && ranges[i][0] <= k && k <= ranges[i][1]; };

  const groups = [], tail = [];
  let nearBoundary = 0;
  for (let i = 0; i < n; i++) {
    const offset = sub(exact[i], t0);
    const k = floorDiv(offset, width);
    const frac = sub({n: offset.n * width.d, d: offset.d * width.n}, {n: BigInt(k), d: 1n});
    if (frac.n !== 0n) {
      const other = sub({n: 1n, d: 1n}, frac);
      const dist = mul(cmp(frac, other) <= 0 ? frac : other, width);
      if (cmp(dist, NEAR_BOUNDARY) <= 0) nearBoundary++;
    }
    if (k >= nComplete) tail.push(i);
    else if (groups.length && groups.at(-1)[0] === k) groups.at(-1)[1].push(i);
    else groups.push([k, [i]]);
  }
  const startOf = k => toNumber(add(t0, mul({n: BigInt(k), d: 1n}, width)));
  const axis = config.rms_mode === 'vector' ? -1 : 'xyz'.indexOf(config.rms_mode.at(-1));
  const windows = [], emptyRuns = [];
  const addEmpty = (first, last) => {
    for (const [lo, hi, gap] of splitByRanges(first, last, ranges, starts)) {
      emptyRuns.push({first_index: lo, last_index: hi, count: hi - lo + 1, start_s: startOf(lo), status: 'not_evaluable',
        reasons: [...(gap ? ['timestamp_gap'] : []), 'insufficient_samples']});
    }
  };
  let previous = -1;
  for (const [k, idx] of groups) {
    if (k > previous + 1) addEmpty(previous + 1, k - 1);
    previous = k;
    const why = [];
    if (inGap(k)) why.push('timestamp_gap');
    if (idx.length < config.min_samples) why.push('insufficient_samples');
    if (idx.some(i => !finite(axes[0][i]) || !finite(axes[1][i]) || !finite(axes[2][i]))) why.push('nonfinite_value');
    else if (idx.some(i => Math.abs(axes[0][i]) > MAX_ABS_SAMPLE_G || Math.abs(axes[1][i]) > MAX_ABS_SAMPLE_G || Math.abs(axes[2][i]) > MAX_ABS_SAMPLE_G)) why.push('value_out_of_range');
    let value = null;
    if (!why.length) {
      const squares = idx.map(i => axis < 0 ? axes[0][i] ** 2 + axes[1][i] ** 2 + axes[2][i] ** 2 : axes[axis][i] ** 2);
      value = Math.sqrt(fsum(squares) / squares.length);
      if (!Number.isFinite(value)) { why.push('value_out_of_range'); value = null; }
    }
    windows.push({window_index: k, start_s: startOf(k), n_samples: idx.length, status: why.length ? 'not_evaluable' : 'ok', reasons: why, value});
  }
  if (nComplete > previous + 1) addEmpty(previous + 1, nComplete - 1);
  const tailStart = add(t0, mul({n: BigInt(nComplete), d: 1n}, width));
  return {file_status: 'valid', file_reasons: [], windows, empty_window_runs: emptyRuns, windows_complete: nComplete,
    n_gaps: nGaps, near_boundary_samples: nearBoundary, duration_total_s: toNumber(sub(tLast, t0)),
    partial_tail: {n_samples: tail.length, duration_s: tail.length ? toNumber(sub(tLast, tailStart)) : 0}};
}

// ---------- detectors (mirrors run_detector v2) ----------
export class EmptyRun { constructor(firstIndex, count) { this.first_index = firstIndex; this.count = count; } }
export class ProtocolFailure extends Error {}

export function runDetector(values, center, scale, method, threshold, config) {
  if (!METHODS.includes(method) || !finite(scale) || scale <= 0 || !finite(threshold)) throw new ProtocolFailure('detector_configuration_invalid');
  const lam = config.ewma_lambda, k = config.cusum_k, norm = Math.sqrt(lam / (2 - lam));
  let e = 0, upper = 0, lower = 0, raw = 0, episodes = 0, inEpisode = false, index = 0;
  const rows = [], resets = {}, mask = [];
  const bump = (key, c) => { resets[key] = (resets[key] || 0) + c; };
  const mark = (bit, c) => { if (mask.length && mask.at(-1)[0] === bit) mask.at(-1)[1] += c; else mask.push([bit, c]); };
  for (const x of values) {
    if (x === null || x instanceof EmptyRun) {
      const count = x === null ? 1 : x.count;
      rows.push({window_index: index, window_count: count, status: 'not_evaluable', statistic: null, raw_alarm: false});
      e = upper = lower = 0; bump('not_evaluable_window', count); inEpisode = false; mark('0', count); index += count;
      continue;
    }
    const z = (x - center) / scale;
    let stat;
    if (method === 'shewhart') stat = Math.abs(z);
    else if (method === 'ewma') { e = lam * z + (1 - lam) * e; stat = Math.abs(e) / norm; }
    else { upper = Math.max(0, upper + z - k); lower = Math.max(0, lower - z - k); stat = Math.max(upper, lower); }
    if (!Number.isFinite(stat)) throw new ProtocolFailure('detector_statistic_nonfinite');
    const alarm = stat > threshold;
    rows.push({window_index: index, window_count: 1, status: alarm ? 'alarm' : 'within', statistic: stat, raw_alarm: alarm});
    mark('1', 1); index += 1;
    if (alarm) {
      raw++; if (!inEpisode) episodes++; inEpisode = true;
      if (config.reset_after_alarm) { e = upper = lower = 0; bump('after_alarm', 1); }
    } else inEpisode = false;
  }
  return {rows, raw_alarms: raw, episodes, resets, evaluable_windows: mask.filter(([b]) => b === '1').reduce((s, [, c]) => s + c, 0),
    evaluable_mask_rle: mask.map(([b, c]) => `${b}x${c}`).join(',')};
}

export function valuesOf(w) {
  const items = w.windows.map(x => [x.window_index, x.status === 'ok' ? x.value : null]);
  for (const r of w.empty_window_runs || []) items.push([r.first_index, new EmptyRun(r.first_index, r.count)]);
  return items.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}
function requireRole(files, role) {
  if (!files.length || files.some(f => f.role !== role)) throw new ProtocolFailure(`role_violation:${role}_only`);
  if (files.some(f => f.windowed.file_status !== 'valid')) throw new ProtocolFailure(`${role}_file_invalid`);
}
export function fitReference(files, config) {
  requireRole(files, 'reference');
  const values = files.flatMap(f => valuesOf(f.windowed)).filter(v => typeof v === 'number');
  if (values.length < config.min_reference_windows) throw new ProtocolFailure('reference_windows_insufficient');
  const center = fsum(values) / values.length;
  // Compute sample variance from exact binary inputs, as statistics.stdev does.
  // Squared deviations from an already rounded mean can inflate tiny scales
  // near a large DC offset and incorrectly cross the minimum-scale gate.
  const exact = values.map(ratFromDouble);
  const denominator = exact.reduce((d, v) => v.d > d ? v.d : d, 1n);
  const origin = exact[0].n * (denominator / exact[0].d);
  let sum = 0n, squares = 0n;
  for (const v of exact) {
    const delta = v.n * (denominator / v.d) - origin;
    sum += delta; squares += delta * delta;
  }
  const count = BigInt(values.length);
  const variance = {n: count * squares - sum * sum,
    d: count * (count - 1n) * denominator * denominator};
  const scale = Math.sqrt(toNumber(variance));
  if (!finite(center) || !finite(scale) || scale <= 0) throw new ProtocolFailure('reference_scale_invalid');
  if (scale < MIN_REFERENCE_SCALE_G) throw new ProtocolFailure('reference_scale_below_floor');
  return {center, scale, n_windows: values.length, files: files.map(f => f.fileId)};
}
export function calibrate(files, center, scale, config) {
  requireRole(files, 'calibration');
  const out = {};
  for (const method of METHODS) {
    const grid = [...config.grids[method]], tried = [];
    let chosen = null;
    for (const threshold of grid) {
      const runs = files.map(f => runDetector(valuesOf(f.windowed), center, scale, method, threshold, config));
      const alarms = runs.reduce((s, r) => s + r.raw_alarms, 0);
      const evaluable = runs.reduce((s, r) => s + r.evaluable_windows, 0);
      tried.push({threshold, raw_alarms: alarms, evaluable_windows: evaluable});
      if (evaluable && alarms / evaluable <= config.max_raw_alarm_fraction) { chosen = threshold; break; }
    }
    out[method] = {status: chosen === null ? 'calibration_failed' : 'calibrated', threshold: chosen, grid, tried};
  }
  return out;
}

// ---------- manifest + protocol (mirrors validate_manifest / run_protocol) ----------
export function validateFiles(files, config) {
  const r = [], ids = new Set(), hashes = new Set(), groupRoles = new Map();
  for (const f of files) {
    if (!f.fileId || ids.has(f.fileId)) r.push('file_id_invalid_or_duplicate'); else ids.add(f.fileId);
    if (!f.group) { r.push(`recording_group_missing:${f.fileId}`); continue; }
    const derived = recordingGroupFromId(f.fileId || '');
    if (derived !== null && derived !== f.group) r.push(`recording_group_mismatch:${f.fileId}`);
    if (!ROLES.includes(f.role)) { r.push(`role_missing:${f.fileId}`); continue; }
    if (hashes.has(f.sha256)) r.push('duplicate_source_sha256'); else hashes.add(f.sha256);
    if (!groupRoles.has(f.group)) groupRoles.set(f.group, new Set());
    groupRoles.get(f.group).add(f.role);
  }
  for (const [g, roles] of [...groupRoles].sort()) if (roles.size > 1) r.push(`recording_group_crosses_roles:${g}`);
  for (const role of ROLES) {
    const actual = [...groupRoles.values()].filter(s => s.size === 1 && s.has(role)).length;
    if (actual !== config.expected_groups[role]) r.push(`group_count_mismatch:${role}:${actual}!=${config.expected_groups[role]}`);
  }
  for (const f of files) {
    if (!/^[0-9a-f]{64}$/.test(f.expectedSha256 || '')) r.push(`expected_sha256_missing:${f.fileId}`);
    else if (f.expectedSha256 !== f.sha256) r.push(`source_sha256_mismatch:${f.fileId}`);
  }
  return [...new Set(r)];
}

export function runProtocol(files, config, {posthoc = false} = {}) {
  const report = {run_status: null, reasons: [], flags: [], reference: null, calibration: null,
    input_binding: 'decoded_in_browser_from_the_same_bytes_that_were_hashed; expected hash is user-entered; not provenance authentication',
    evaluation_files: [], independent_units: null, performance: {...NULL_PERFORMANCE},
    stability: {status: 'stability_unverified', reasons: ['no_stability_evidence']}};
  const stop = (status, reasons) => Object.assign(report, {run_status: status, reasons});
  const configReasons = validateConfig(config);
  if (configReasons.length) return stop('invalid_config', configReasons);
  const fileReasons = validateFiles(files, config);
  const sourceReasons = fileReasons.filter(x => x.startsWith('expected_sha256') || x.startsWith('source_sha256'));
  const manifestReasons = fileReasons.filter(x => !sourceReasons.includes(x));
  if (manifestReasons.length) return stop('invalid_manifest', manifestReasons);
  if (sourceReasons.length) return stop('source_verification_failed', sourceReasons);
  const byRole = role => files.filter(f => f.role === role);
  let reference, calibration;
  try { reference = fitReference(byRole('reference'), config); }
  catch (e) { if (e instanceof ProtocolFailure) return stop('reference_invalid', [e.message]); throw e; }
  report.reference = reference;
  try { calibration = calibrate(byRole('calibration'), reference.center, reference.scale, config); }
  catch (e) { if (e instanceof ProtocolFailure) return stop('calibration_failed', [e.message]); throw e; }
  report.calibration = calibration;
  const failed = METHODS.filter(m => calibration[m].status !== 'calibrated');
  if (failed.length === METHODS.length) return stop('calibration_failed', failed.map(m => `calibration_failed:${m}`));
  report.flags.push(...failed.map(m => `calibration_failed:${m}`));
  const width = toNumber(ratFromDecimal(config.window_s));
  try {
  for (const f of byRole('evaluation')) {
    const w = f.windowed;
    const rec = {file_id: f.fileId, recording_group: f.group, file_status: w.file_status, file_reasons: w.file_reasons};
    if (w.file_status === 'valid') {
      const excluded = {};
      w.windows.forEach(x => x.reasons.forEach(reason => { excluded[reason] = (excluded[reason] || 0) + 1; }));
      (w.empty_window_runs || []).forEach(r => r.reasons.forEach(reason => { excluded[reason] = (excluded[reason] || 0) + r.count; }));
      const evaluable = w.windows.filter(x => x.status === 'ok').length;
      Object.assign(rec, {duration_total_s: w.duration_total_s, duration_evaluable_s: evaluable * width,
        windows_complete: w.windows_complete, windows_evaluable: evaluable, windows_excluded: excluded,
        exclusion_fraction: w.windows_complete ? (w.windows_complete - evaluable) / w.windows_complete : null,
        empty_window_runs: (w.empty_window_runs || []).length,
        partial_tail: w.partial_tail, n_gaps: w.n_gaps, near_boundary_samples: w.near_boundary_samples, methods: {}});
      for (const m of METHODS) {
        const cal = calibration[m];
        if (cal.status !== 'calibrated') { rec.methods[m] = {status: 'unavailable_calibration_failed'}; continue; }
        const run = runDetector(valuesOf(w), reference.center, reference.scale, m, cal.threshold, config);
        rec.methods[m] = {status: 'alarm_activity_recorded', threshold: cal.threshold, raw_alarms: run.raw_alarms,
          episodes: run.episodes, any_raw_alarm: run.raw_alarms > 0,
          alarm_activity_per_evaluable_window: evaluable ? run.raw_alarms / evaluable : null,
          resets: run.resets, evaluable_mask_rle: run.evaluable_mask_rle, rows: run.rows};
      }
    }
    report.evaluation_files.push(rec);
  }
  } catch (e) {
    if (e instanceof ProtocolFailure) { report.evaluation_files = []; return stop('numeric_failure', [e.message]); }
    throw e;
  }
  if (files.some(f => f.windowed.near_boundary_samples)) report.flags.push('near_boundary_timestamps_present');
  report.flags.push('stability_unverified', 'reused_or_unlocked_data_not_independent_holdout');
  if (posthoc) report.flags.push('exploratory_posthoc_reference_selection');
  report.independent_units = {evaluation_recording_groups: new Set(byRole('evaluation').map(f => f.group)).size,
    evaluation_files: byRole('evaluation').length, windows_are_independent_sessions: false};
  report.run_status = 'exploratory_alarm_activity_only';
  return report;
}
