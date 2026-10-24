// Robot demo v3 regressions: unavailable methods are never shown as "no alarm",
// and stale async loads can never commit after Clear/unlock/newer loads. SYNTHETIC data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../web/robot/window-core.mjs';
import {methodRow, showPercent, showNumber, calibrationStatus, alarmChartCaption, NOT_EVALUATED} from '../../web/robot/report-view.mjs';
import {createLoader} from '../../web/robot/load-session.mjs';

// ---- report view ----
const recorded = (raw, episodes, activity) => ({status: 'alarm_activity_recorded', threshold: 3, raw_alarms: raw, episodes,
  any_raw_alarm: raw > 0, alarm_activity_per_evaluable_window: activity, resets: {}});

test('recorded zero alarms is the only way to show "no alarm"', () => {
  const zero = methodRow('ewma', recorded(0, 0, 0));
  assert.equal(zero.evaluated, true);
  assert.equal(zero.rawAlarms, 0);
  assert.equal(zero.cells[0], '0');
  assert.match(zero.cells[2], /^없음/);
  assert.equal(zero.cells[3], '0.0%');
  const some = methodRow('ewma', recorded(3, 2, 0.075));
  assert.deepEqual(some.cells.slice(0, 4), ['3', '2', '있음', '7.5%']);
});

test('unavailable, missing and malformed results render as not evaluated with null values', () => {
  const cases = [
    [{status: 'unavailable_calibration_failed'}, 'unavailable_calibration_failed'],
    [undefined, 'result_missing'], [null, 'result_missing'], [{}, 'result_missing'],
    [{status: 'alarm_activity_recorded'}, 'result_field_invalid'],
    [recorded(NaN, 0, 0), 'result_field_invalid'],
    [recorded(undefined, 0, 0), 'result_field_invalid'],
    [recorded(1, 1, NaN), 'result_field_invalid'],
    [recorded(-1, 0, 0), 'result_field_invalid'],
  ];
  for (const [input, code] of cases) {
    const row = methodRow('cusum', input);
    assert.equal(row.evaluated, false, code);
    assert.equal(row.reasonCode, code);
    for (const key of ['rawAlarms', 'episodes', 'anyAlarm', 'activity']) assert.equal(row[key], null, `${code}.${key}`);
    assert.ok(row.cells.every(c => !/NaN|^없음|0\.0%|^0$/.test(c)), `${code}: ${row.cells}`);
    assert.ok(row.cells[0].startsWith(NOT_EVALUATED));
  }
  assert.match(methodRow('cusum', {status: 'unavailable_calibration_failed'}).cells[4], /calibration 실패/);
});

test('null activity (no evaluable window) is null, not 0%', () => {
  const row = methodRow('shewhart', recorded(0, 0, null));
  assert.equal(row.evaluated, true);
  assert.equal(row.activity, null);
  assert.match(row.cells[3], /^null/);
});

test('number formatting keeps null, undefined, NaN and 0 apart', () => {
  assert.equal(showNumber(0), '0');
  for (const v of [null, undefined, NaN, Infinity, '3']) assert.equal(showNumber(v), 'null');
  assert.equal(showPercent(0), '0.0%');
  for (const v of [null, undefined, NaN]) assert.equal(showPercent(v), 'null');
  assert.match(calibrationStatus({status: 'calibration_failed', threshold: null}), /평가 불가/);
  assert.match(alarmChartCaption('cusum', {status: 'unavailable_calibration_failed'}), /경보가 없다는 뜻이 아닙니다/);
});

// ---- partial and total calibration failure through the real protocol ----
const windowed = values => ({file_status: 'valid', file_reasons: [], empty_window_runs: [], windows_complete: values.length,
  n_gaps: 0, near_boundary_samples: 0, partial_tail: {n_samples: 0, duration_s: 0}, duration_total_s: values.length * 0.05,
  windows: values.map((v, i) => ({window_index: i, start_s: i * 0.05, n_samples: 50, status: 'ok', reasons: [], value: v}))});
const SCALE = 0.001;
const refValues = Array.from({length: 40}, (_, i) => 1 + (i % 2 ? SCALE : -SCALE));
function files(calValues) {
  const sha = c => c.repeat(64);
  const f = (fileId, group, role, values, c) => ({fileId, group, role, sha256: sha(c), expectedSha256: sha(c), windowed: windowed(values)});
  return [f('SYNTHETIC_r_dataLog_1', 'SYNTHETIC_r', 'reference', refValues, 'a'),
    f('SYNTHETIC_c_dataLog_1', 'SYNTHETIC_c', 'calibration', calValues, 'b'),
    f('SYNTHETIC_e1_dataLog_1', 'SYNTHETIC_e1', 'evaluation', refValues, 'c'),
    f('SYNTHETIC_e2_dataLog_1', 'SYNTHETIC_e2', 'evaluation', refValues, 'd')];
}
const cfg = core.demoConfig({nominal_period_s: '0.001'});

test('partial calibration failure: failed method is not evaluated, others are', () => {
  const scale = core.fitReference([{role: 'reference', fileId: 'r', windowed: windowed(refValues)}], cfg).scale;
  const cal = refValues.map((v, i) => i >= 20 ? v + 1.2 * scale : v);
  const report = core.runProtocol(files(cal), cfg);
  assert.equal(report.run_status, 'exploratory_alarm_activity_only');
  const failed = core.METHODS.filter(m => report.calibration[m].status !== 'calibrated');
  const ok = core.METHODS.filter(m => report.calibration[m].status === 'calibrated');
  assert.ok(failed.length >= 1 && ok.length >= 1, `failed=${failed} ok=${ok}`);
  assert.ok(failed.includes('cusum'));
  assert.ok(report.flags.includes('calibration_failed:cusum'));
  for (const f of report.evaluation_files) {
    for (const m of failed) {
      const row = methodRow(m, f.methods[m]);
      assert.equal(row.evaluated, false);
      assert.equal(row.reasonCode, 'unavailable_calibration_failed');
      assert.equal(f.methods[m].raw_alarms, undefined);
    }
    for (const m of ok) assert.equal(methodRow(m, f.methods[m]).evaluated, true);
  }
  for (const k of ['detection_delay', 'anomaly_recall', 'miss_rate', 'false_alarm_rate']) assert.equal(report.performance[k], null);
});

test('all calibrations failing stops the run with no evaluation rows', () => {
  const report = core.runProtocol(files(refValues.map(v => v + 50 * SCALE)), cfg);
  assert.equal(report.run_status, 'calibration_failed');
  assert.deepEqual(report.evaluation_files, []);
  assert.deepEqual(report.reasons, core.METHODS.map(m => `calibration_failed:${m}`));
  assert.ok(core.METHODS.every(m => report.calibration[m].threshold === null));
});

test('NaN detector input never becomes "within" (throws); normal UI windows never carry NaN', () => {
  assert.throws(() => core.runDetector([NaN], 0, 1, 'shewhart', 3, cfg), /detector_statistic_nonfinite/);
  assert.throws(() => core.runDetector([undefined], 0, 1, 'ewma', 3, cfg), /detector_statistic_nonfinite/);
  const t = Array.from({length: 160}, (_, i) => i / 1000);
  const w = core.windowFile(t, [t.map(() => NaN), t.map(() => 0), t.map(() => 0)], cfg);
  assert.ok(w.windows.every(x => x.value === null && x.status === 'not_evaluable'));
  assert.ok(core.valuesOf(w).every(v => v === null || typeof v === 'object'));
});

// ---- generation-guarded loading ----
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; }
function harness() {
  const commits = [];
  const loader = createLoader({digest: async b => `sha:${b}`, process: (s, b, sha) => ({name: s.name, sha})});
  const source = (name, gate) => ({name, read: () => gate.promise});
  return {loader, commits, source, onCommit: label => records => commits.push({label, names: records.map(r => r.name)})};
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('cancel (Clear/unlock) during a pending read discards the load', async () => {
  const {loader, commits, source, onCommit} = harness();
  const gate = deferred();
  const pending = loader.load([source('a.csv', gate)], onCommit('A'));
  loader.cancel();
  gate.resolve('bytesA');
  assert.deepEqual(await pending, {status: 'stale'});
  assert.deepEqual(commits, []);
});

test('newer load wins even when the older one resolves last', async () => {
  const {loader, commits, source, onCommit} = harness();
  const gA = deferred(), gB = deferred();
  const a = loader.load([source('a.csv', gA)], onCommit('user-A'));
  const b = loader.load([source('b.csv', gB)], onCommit('synthetic-B'));
  gB.resolve('bytesB'); await tick();
  gA.resolve('bytesA');
  assert.deepEqual(await b, {status: 'committed'});
  assert.deepEqual(await a, {status: 'stale'});
  assert.deepEqual(commits, [{label: 'synthetic-B', names: ['b.csv']}]);
});

test('repeated clicks commit exactly one complete set, atomically', async () => {
  const {loader, commits, source, onCommit} = harness();
  const gates = [deferred(), deferred(), deferred()];
  const runs = gates.map((g, i) => loader.load([source(`r${i}-1.csv`, g), {name: `r${i}-2.csv`, read: async () => 'x'}], onCommit(`run${i}`)));
  gates.forEach(g => g.resolve('bytes'));
  const results = await Promise.all(runs);
  assert.deepEqual(results.map(r => r.status), ['stale', 'stale', 'committed']);
  assert.deepEqual(commits, [{label: 'run2', names: ['r2-1.csv', 'r2-2.csv']}]);
});

test('a stale load cancelled between read and digest cannot commit', async () => {
  const commits = [];
  const digestGate = deferred();
  const loader = createLoader({digest: () => digestGate.promise, process: s => ({name: s.name})});
  const p = loader.load([{name: 'a.csv', read: async () => 'bytes'}], r => commits.push(r));
  await tick();
  loader.cancel();
  digestGate.resolve('sha');
  assert.deepEqual(await p, {status: 'stale'});
  assert.deepEqual(commits, []);
});

test('errors from stale loads are swallowed; errors from the current load are reported', async () => {
  const {loader, commits, source, onCommit} = harness();
  const g1 = deferred();
  const stale = loader.load([source('a.csv', g1)], onCommit('A'));
  loader.cancel();
  g1.reject(new Error('read failed'));
  assert.deepEqual(await stale, {status: 'stale'});
  const g2 = deferred();
  const current = loader.load([source('b.csv', g2)], onCommit('B'));
  g2.reject(new Error('read failed'));
  const r = await current;
  assert.equal(r.status, 'error');
  assert.deepEqual(commits, []);
});
