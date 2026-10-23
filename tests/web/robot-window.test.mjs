// Robot extension demo: browser window/RMS/reset contract and parity with the frozen Python patch.
// SYNTHETIC inputs only. No robot data, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as core from '../../web/robot/window-core.mjs';
import {syntheticFiles, toCSV} from '../../web/robot/synthetic.mjs';
import {parseCSV} from '../../web/equipment/contract.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/robot-window-parity.json', import.meta.url), 'utf8'));
const cfg = overrides => core.demoConfig({...fixture.config, expected_groups: {reference: 1, calibration: 1, evaluation: 2}, ...overrides});
const nanAxes = axes => axes.map(a => a.map(v => v === null ? NaN : v));
const close = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const sha = text => createHash('sha256').update(text).digest('hex');

function fixtureFiles() {
  return fixture.files.map(f => ({fileId: f.file_id, group: f.group, role: f.role,
    sha256: sha(f.file_id), expectedSha256: sha(f.file_id),
    windowed: core.windowFile(f.times, nanAxes(f.axes), cfg())}));
}

test('fsum matches Python math.fsum on cancellation cases', () => {
  assert.equal(core.fsum([1e100, 1, -1e100]), 1);
  assert.equal(core.fsum([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]), 1);
  assert.equal(core.fsum([1, 1e-16, 1e-16]), 1.0000000000000002);
});

function assertWindowParity(js, py, label) {
  assert.equal(js.windows_complete, py.windows_complete, label);
  assert.deepEqual(js.empty_window_runs.map(r => [r.first_index, r.last_index, r.count, r.reasons]),
    py.empty_window_runs.map(r => [r.first_index, r.last_index, r.count, r.reasons]), label);
  js.empty_window_runs.forEach((r, i) => close(r.start_s, py.empty_window_runs[i].start_s, `${label} run start`));
}

test('windowing matches the Python backend window by window', () => {
  for (const f of fixture.files) {
    const js = core.windowFile(f.times, nanAxes(f.axes), cfg());
    const py = fixture.expected.windowed[f.file_id];
    assertWindowParity(js, py, f.file_id);
    assert.equal(js.file_status, py.file_status);
    assert.equal(js.n_gaps, py.n_gaps, f.file_id);
    assert.equal(js.near_boundary_samples, py.near_boundary_samples);
    assert.equal(js.partial_tail.n_samples, py.partial_tail.n_samples);
    close(js.partial_tail.duration_s, py.partial_tail.duration_s, 'tail');
    assert.equal(js.windows.length, py.windows.length);
    js.windows.forEach((w, i) => {
      assert.equal(w.status, py.windows[i].status);
      assert.deepEqual(w.reasons, py.windows[i].reasons);
      assert.equal(w.n_samples, py.windows[i].n_samples);
      if (py.windows[i].value === null) assert.equal(w.value, null); else assert.equal(w.value, py.windows[i].value);
    });
  }
});

test('exact boundary assignment matches Python (stored 0.15 < 3/20)', () => {
  const b = fixture.expected.boundary_case;
  const n = b.times.length;
  const js = core.windowFile(b.times, [Array(n).fill(1), Array(n).fill(0), Array(n).fill(0)],
    cfg({nominal_period_s: '0.01', min_samples: 1, gap_factor: 10}));
  assert.deepEqual(js.windows.map(w => w.n_samples), b.n_samples);
  assert.equal(js.near_boundary_samples, b.near_boundary_samples);
});

test('protocol results match Python: reference, calibration, alarm activity', () => {
  const report = core.runProtocol(fixtureFiles(), cfg());
  const ex = fixture.expected;
  assert.equal(report.run_status, ex.run_status);
  close(report.reference.center, ex.reference.center, 'center');
  close(report.reference.scale, ex.reference.scale, 'scale');
  assert.equal(report.reference.n_windows, ex.reference.n_windows);
  for (const m of core.METHODS) {
    assert.equal(report.calibration[m].status, ex.calibration[m].status);
    assert.equal(report.calibration[m].threshold, ex.calibration[m].threshold);
    assert.deepEqual(report.calibration[m].tried, ex.calibration[m].tried);
  }
  report.evaluation_files.forEach((f, i) => {
    const py = ex.evaluation[i];
    assert.equal(f.file_id, py.file_id);
    assert.deepEqual(f.windows_excluded, py.windows_excluded);
    assert.equal(f.windows_evaluable, py.windows_evaluable);
    for (const m of core.METHODS) {
      assert.equal(f.methods[m].raw_alarms, py.methods[m].raw_alarms);
      assert.equal(f.methods[m].episodes, py.methods[m].episodes);
      assert.deepEqual(f.methods[m].resets, py.methods[m].resets);
    }
  });
});

test('fail closed: duplicate/reversed time and cadence mismatch invalidate the file', () => {
  const t = Array.from({length: 200}, (_, i) => i / 1000); t[50] = t[49];
  const flat = n => [Array(n).fill(1), Array(n).fill(0), Array(n).fill(0)];
  assert.deepEqual(core.windowFile(t, flat(200), cfg()).file_reasons, fixture.expected.dup_time_reasons);
  const c = Array.from({length: 200}, (_, i) => i / 500);
  assert.deepEqual(core.windowFile(c, flat(200), cfg()).file_reasons, fixture.expected.cadence_reasons);
});

test('no performance numbers without onset labels; stability stays unverified', () => {
  const report = core.runProtocol(fixtureFiles(), cfg());
  for (const k of ['detection_delay', 'anomaly_recall', 'miss_rate', 'false_alarm_rate']) assert.equal(report.performance[k], null);
  assert.equal(report.stability.status, 'stability_unverified');
  assert.ok(report.flags.includes('stability_unverified'));
  assert.equal(report.independent_units.evaluation_recording_groups, 2);
  assert.equal(report.independent_units.windows_are_independent_sessions, false);
  assert.ok(!JSON.stringify(report).includes('success'));
});

test('manifest guards: crossing groups, duplicate bytes, missing or wrong expected hash', () => {
  const files = fixtureFiles();
  files[1] = {...files[1], group: 'synth_ref', fileId: 'synth_ref_dataLog_2'};
  assert.equal(core.runProtocol(files, cfg()).run_status, 'invalid_manifest');
  const dup = fixtureFiles(); dup[1] = {...dup[1], sha256: dup[0].sha256, expectedSha256: dup[0].sha256};
  assert.ok(core.runProtocol(dup, cfg()).reasons.includes('duplicate_source_sha256'));
  const missing = fixtureFiles(); missing[2] = {...missing[2], expectedSha256: ''};
  const r = core.runProtocol(missing, cfg());
  assert.equal(r.run_status, 'source_verification_failed');
  assert.deepEqual(r.evaluation_files, []);
  const wrong = fixtureFiles(); wrong[0] = {...wrong[0], expectedSha256: 'f'.repeat(64)};
  assert.equal(core.runProtocol(wrong, cfg()).run_status, 'source_verification_failed');
});

test('invalid reference file stops the run before any alarm activity', () => {
  const files = fixtureFiles();
  const t = Array.from({length: 600}, (_, i) => i / 1000); t[9] = t[8];
  files[0] = {...files[0], windowed: core.windowFile(t, [Array(600).fill(1), Array(600).fill(0), Array(600).fill(0)], cfg())};
  const r = core.runProtocol(files, cfg());
  assert.equal(r.run_status, 'reference_invalid');
  assert.deepEqual(r.evaluation_files, []);
});

test('config without declared cadence is rejected (no silent default)', () => {
  assert.ok(core.validateConfig(core.demoConfig()).includes('nominal_period_s_must_be_decimal_string'));
  assert.ok(core.validateConfig(core.demoConfig({nominal_period_s: '0.001', window_s: 0.05})).includes('window_s_must_be_decimal_string'));
  assert.ok(core.validateConfig(core.demoConfig({nominal_period_s: '0.001', min_samples: 60})).includes('min_samples_exceeds_nominal_window_capacity'));
});

test('strict CSV columns and numbers', () => {
  const ok = core.tableToSeries(parseCSV('Time,A_x [g],A_y [g],A_z [g]\n0,1,0,0\n0.001,NaN,0,0\n'));
  assert.deepEqual(ok.reasons, []);
  assert.ok(Number.isNaN(ok.axes[0][1]));
  assert.deepEqual(core.tableToSeries(parseCSV('time,x,y,z\n0,1,0,0\n')).reasons, ['column_schema_mismatch']);
  assert.match(core.tableToSeries(parseCSV('Time,A_x [g],A_y [g],A_z [g]\n,1,0,0\n')).reasons[0], /^time_nonfinite/);
  assert.match(core.tableToSeries(parseCSV('Time,A_x [g],A_y [g],A_z [g]\n0,abc,0,0\n')).reasons[0], /^value_nonnumeric/);
});

test('synthetic example is labelled, deterministic and round-trips through the CSV contract', () => {
  const a = syntheticFiles('demo'), b = syntheticFiles('demo');
  assert.deepEqual(a.map(f => toCSV(f)), b.map(f => toCSV(f)));
  for (const f of a) {
    assert.match(f.fileId, /^SYNTHETIC_/);
    const parsed = core.tableToSeries(parseCSV(toCSV(f)));
    assert.deepEqual(parsed.reasons, []);
    assert.equal(parsed.times.length, f.times.length);
  }
  const err = syntheticFiles('error');
  const ref = err.find(f => f.role === 'reference');
  const p = core.tableToSeries(parseCSV(toCSV(ref)));
  assert.equal(core.windowFile(p.times, p.axes, core.demoConfig({nominal_period_s: '0.001'})).file_status, 'invalid');
});


// ---- v2 regression: independent-audit findings (overflow, span-proportional allocation) ----
const flat = n => [Array(n).fill(1), Array(n).fill(0), Array(n).fill(0)];

test('huge finite values fail closed as value_out_of_range (parity with Python v2)', () => {
  const py = fixture.expected.out_of_range_case;
  const t = Array.from({length: 160}, (_, i) => i / 1000);
  const js = core.windowFile(t, [[...Array(50).fill(1e200), ...Array(110).fill(1)], Array(160).fill(0), Array(160).fill(0)], cfg());
  assert.deepEqual(js.windows.map(w => w.reasons), py.windows.map(w => w.reasons));
  assert.deepEqual(js.windows.map(w => w.value), py.windows.map(w => w.value));
  for (const big of [1e200, 1.7e308, -1e200]) {
    const w = core.windowFile(t, [Array(160).fill(big), Array(160).fill(0), Array(160).fill(0)], cfg());
    assert.ok(w.windows.every(x => x.status === 'not_evaluable' && x.value === null && x.reasons[0] === 'value_out_of_range'));
  }
  const limit = core.windowFile(t, [Array(160).fill(core.MAX_ABS_SAMPLE_G), Array(160).fill(0), Array(160).fill(0)], cfg());
  assert.ok(limit.windows.every(x => x.status === 'ok'));
});

test('huge gaps stay sparse: parity with Python and bounded time/memory', () => {
  for (const name of ['huge_gap_case', 'mixed_gap_case']) {
    const py = fixture.expected[name];
    const input = name === 'huge_gap_case'
      ? [[0, 0.001, 0.002, 10000], flat(4), cfg({min_samples: 1, cadence_rel_tolerance: 1})]
      : [[...Array.from({length: 120}, (_, i) => i / 1000), ...Array.from({length: 120}, (_, i) => 5 + i / 1000)], flat(240), cfg({min_samples: 10})];
    const js = core.windowFile(...input);
    assertWindowParity(js, py, name);
    assert.deepEqual(js.windows.map(w => [w.n_samples, w.reasons]), py.windows.map(w => [w.n_samples, w.reasons]));
  }
  for (const span of [10000, 1e9]) {
    const started = performance.now(), before = process.memoryUsage().heapUsed;
    const w = core.windowFile([0, 0.001, 0.002, span], flat(4), cfg({min_samples: 1, cadence_rel_tolerance: 1}));
    const elapsed = performance.now() - started, grown = process.memoryUsage().heapUsed - before;
    assert.equal(w.windows_complete, Math.floor(span / 0.05));
    assert.ok(w.windows.length <= 4);
    assert.equal(w.windows.length + w.empty_window_runs.reduce((s, r) => s + r.count, 0), w.windows_complete);
    assert.ok(elapsed < 500, `span ${span}: ${elapsed} ms`);
    assert.ok(grown < 20e6, `span ${span}: heap +${grown}`);
  }
});

test('EmptyRun detector items equal the same number of nulls (parity with Python v2)', () => {
  for (const m of core.METHODS) {
    const compact = core.runDetector([5, new core.EmptyRun(1, 4), 5, 5], 0, 1, m, 3, cfg());
    const expanded = core.runDetector([5, null, null, null, null, 5, 5], 0, 1, m, 3, cfg());
    for (const key of ['raw_alarms', 'episodes', 'resets', 'evaluable_windows', 'evaluable_mask_rle']) assert.deepEqual(compact[key], expanded[key]);
    const py = fixture.expected.empty_run_detector[m];
    assert.equal(compact.raw_alarms, py.raw_alarms); assert.equal(compact.episodes, py.episodes);
    assert.deepEqual(compact.resets, py.resets); assert.equal(compact.evaluable_windows, py.evaluable_windows);
  }
});

test('protocol with a huge-gap evaluation file completes with bounded output', () => {
  const files = fixtureFiles();
  const ev = fixture.files.find(f => f.file_id === 'synth_evB_dataLog_1');
  const times = ev.times.map((t, i) => i >= 500 ? t + 10000 : t);
  files[3] = {...files[3], windowed: core.windowFile(times, nanAxes(ev.axes), cfg())};
  const r = core.runProtocol(files, cfg());
  assert.equal(r.run_status, 'exploratory_alarm_activity_only');
  const out = r.evaluation_files.find(f => f.file_id === 'synth_evB_dataLog_1');
  assert.ok(out.windows_complete > 200000);
  assert.ok(out.windows_excluded.timestamp_gap > 200000);
  assert.equal(new Set(core.METHODS.map(m => out.methods[m].evaluable_mask_rle)).size, 1);
  assert.ok(out.methods.cusum.rows.length < 50);
  for (const k of ['detection_delay', 'anomaly_recall', 'miss_rate', 'false_alarm_rate']) assert.equal(r.performance[k], null);
});

test('scale floor and non-finite statistic fail closed', () => {
  assert.throws(() => core.runDetector([1e308, 1e308], -1e308, 1e-300, 'cusum', 3, cfg()), /detector_statistic_nonfinite/);
  const t = Array.from({length: 1001}, (_, i) => i / 1000);
  const x = t.map((_, i) => 1 + (i % 2 ? 1e-13 : 0));
  const files = fixtureFiles();
  files[0] = {...files[0], windowed: core.windowFile(t, [x, Array(1001).fill(0), Array(1001).fill(0)], cfg())};
  assert.match(core.runProtocol(files, cfg()).reasons[0], /reference_scale_(below_floor|invalid)/);
});

// ---- v4 regression: exact window indices (no unsafe BigInt -> Number) ----
test('extreme finite spans fail closed with a clear reason (parity with Python v3)', () => {
  const cases = fixture.expected.extreme_span_cases;
  const c = cfg({min_samples: 1, cadence_rel_tolerance: 1});
  for (const end of [1e100, 1e308, 450359962737049.5625, 450359962737049.625]) {
    const py = cases[Object.keys(cases).find(k => Number(k) === end)];   // keys are Python repr()
    let js;
    assert.doesNotThrow(() => { js = core.windowFile([0, 0.001, 0.002, 0.003, 0.004, end], flat(6), c); }, `end ${end}`);
    assert.equal(js.file_status, py.file_status, `end ${end}`);
    assert.deepEqual(js.file_reasons, py.file_reasons ?? [], `end ${end}`);
    if (py.file_status === 'valid') {
      assertWindowParity(js, py, `end ${end}`);
      assert.equal(js.windows_complete, core.MAX_WINDOWS_PER_FILE);
      assert.ok(Number.isSafeInteger(js.windows_complete));
      assert.ok(js.empty_window_runs.every(r => Number.isSafeInteger(r.first_index) && Number.isSafeInteger(r.last_index) && Number.isSafeInteger(r.count)));
      assert.equal(js.windows.length + js.empty_window_runs.reduce((s, r) => s + r.count, 0), js.windows_complete);
      assert.ok(js.partial_tail.duration_s >= 0 && js.partial_tail.duration_s < 0.05, `tail ${js.partial_tail.duration_s}`);
      close(js.partial_tail.duration_s, py.partial_tail.duration_s, 'tail');
    } else {
      assert.deepEqual(js.file_reasons, ['time_span_exceeds_window_index_limit']);
      assert.equal(js.windows_complete, 0);
    }
  }
});

test('runs never overlap and indices stay ordered near the safe-integer limit', () => {
  const js = core.windowFile([0, 0.001, 0.002, 0.003, 0.004, 450359962737049.5625], flat(6), cfg({min_samples: 1, cadence_rel_tolerance: 1}));
  const spans = [...js.windows.map(w => [w.window_index, w.window_index]), ...js.empty_window_runs.map(r => [r.first_index, r.last_index])].sort((a, b) => a[0] - b[0]);
  spans.forEach(([lo, hi], i) => { assert.ok(lo <= hi); if (i) assert.equal(lo, spans[i - 1][1] + 1); });
  assert.equal(spans.at(-1)[1], core.MAX_WINDOWS_PER_FILE - 1);
});

test('subnormal and huge timestamps convert without Infinity/NaN (parity with Python v3)', () => {
  const py = fixture.expected.subnormal_start_case;
  const js = core.windowFile([5e-324, 0.001, 0.002, 0.003, 0.004, 0.2], flat(6), cfg({min_samples: 1, cadence_rel_tolerance: 1}));
  assertWindowParity(js, py, 'subnormal');
  close(js.duration_total_s, py.duration_total_s, 'duration');
  close(js.partial_tail.duration_s, py.partial_tail.duration_s, 'tail');
  const near = core.windowFile([1e308, 1e308 + 2 ** 971, 1e308 + 2 * 2 ** 971], flat(3), cfg({nominal_period_s: '1', min_samples: 1, cadence_rel_tolerance: 1}));
  assert.notEqual(near.file_status, undefined);
  for (const v of [near.duration_total_s, ...(near.windows || []).map(w => w.start_s)]) if (v !== null) assert.ok(Number.isFinite(v));
});

test('protocol with an extreme-span evaluation file reports it invalid and still finishes', () => {
  const files = fixtureFiles();
  files[3] = {...files[3], windowed: core.windowFile([0, 0.001, 0.002, 0.003, 0.004, 1e100], flat(6), cfg({min_samples: 1, cadence_rel_tolerance: 1}))};
  const r = core.runProtocol(files, cfg());
  assert.equal(r.run_status, 'exploratory_alarm_activity_only');
  const ev = r.evaluation_files.find(f => f.file_id === files[3].fileId);
  assert.deepEqual([ev.file_status, ev.file_reasons], ['invalid', ['time_span_exceeds_window_index_limit']]);
  assert.doesNotThrow(() => JSON.stringify(r));
  for (const k of ['detection_delay', 'anomaly_recall', 'miss_rate', 'false_alarm_rate']) assert.equal(r.performance[k], null);
});

// Independent adversarial regression: rounded-mean variance previously admitted
// a reference below Python's scale floor (Python stdev = 9.999277589963936e-10).
test('large DC reference cannot cross scale floor through rounded-mean variance', () => {
  const times = Array.from({length:1001}, (_, i) => i * .001);
  const axes = [times.map((_, i) => i < 450 ? 1e6 : 1e6 - 17 * 2 ** -33),
    times.map(() => 0), times.map(() => 0)];
  const config = cfg();
  const windowed = core.windowFile(times, axes, config);
  assert.equal(windowed.file_status, 'valid');
  assert.throws(() => core.fitReference([{fileId:'ref_dataLog_1',role:'reference',windowed}], config),
    /reference_scale_below_floor/);
  // A neighboring reference clearly above the floor must remain usable.
  axes[0] = times.map((_, i) => i < 450 ? 1e6 : 1e6 - 18 * 2 ** -33);
  const above = core.fitReference([{fileId:'ref_dataLog_1',role:'reference',
    windowed:core.windowFile(times, axes, config)}], config);
  assert.ok(above.scale > 1e-9);
});
