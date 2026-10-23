// SECOM research page: generated #170 data stays internally consistent and claims stay bounded.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RESEARCH as D} from '../../web/secom/research/data.mjs';
import {contrasts, bottomLine, foldsFor, slotsFor} from '../../web/secom/research/model.mjs';

const html = readFileSync(new URL('../../web/secom/research.html', import.meta.url), 'utf8');
const robotHtml = readFileSync(new URL('../../web/robot/index.html', import.meta.url), 'utf8');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);

test('data is pinned to the frozen #170 head with source hashes', () => {
  assert.equal(D.provenance.head, 'e7cdc47bfc13740448f7ee160a4047f42fd887fc');
  assert.equal(Object.keys(D.provenance.files).length, 3);
  for (const sha of Object.values(D.provenance.files)) assert.match(sha, /^[0-9a-f]{64}$/);
  assert.equal(D.manifest.test_rows_parsed_or_scored, 0);
  assert.equal(D.manifest.final_model_fit, false);
  assert.equal(D.manifest.candidate_selection, 'none');
});

test('13 candidates x 3 folds = 39 fits; summaries recompute from fold rows', () => {
  assert.equal(D.summary.length, 13);
  assert.equal(D.folds.length, 39);
  assert.equal(D.manifest.fits, 39);
  for (const s of D.summary) {
    const folds = foldsFor(D, s.family, s.mode);
    assert.equal(folds.length, 3);
    assert.equal(folds.reduce((a, f) => a + f.captured_fail, 0), s.captured_fail_sum);
    assert.equal(folds.reduce((a, f) => a + f.validation_fail, 0), s.validation_fail_sum);
    assert.equal(folds.reduce((a, f) => a + f.inspection_count, 0), s.inspection_count_sum);
    folds.forEach(f => assert.equal(f.inspection_count, slotsFor(f.validation_rows)));
    close(s.pooled_fold_budget_capture_rate, s.captured_fail_sum / s.validation_fail_sum);
    close(s.average_precision_mean, folds.reduce((a, f) => a + f.average_precision, 0) / 3);
  }
  assert.ok(D.summary.every(s => s.validation_fail_sum === 61 && s.inspection_count_sum === 105));
});

test('fold windows match fold metrics and budgets', () => {
  for (const w of D.fold_windows) {
    const rows = D.folds.filter(f => f.fold === w.fold);
    assert.ok(rows.every(r => r.validation_rows === w.validation_rows && r.validation_fail === w.validation_fail && r.fit_rows === w.fit_rows));
    assert.ok(w.validation_start > w.fit_end, 'validation dates after fit dates');
  }
});

test('bottom line: row-missing feature did not increase captures for any model', () => {
  const bl = bottomLine(D);
  assert.equal(bl.anyIncrease, false);
  assert.equal(bl.rowMissing.length, 3);
  assert.equal(contrasts(D).length, 9);
});

test('page states scope limits and does not claim improvement or link a network source', () => {
  for (const phrase of ['개선은 입증되지 않았습니다', 'Draft', '수율 향상', '392행', '익명 측정변수', '플랫폼의 일부', '강의 내용 전체를 적용했거나 플랫폼을 업그레이드했다는 뜻이 아닙니다']) assert.ok(html.includes(phrase), phrase);
  assert.match(html, /connect-src 'none'/);
  assert.ok(!/fetch\(|XMLHttpRequest/.test(readFileSync(new URL('../../web/secom/research/research.mjs', import.meta.url), 'utf8')));
  for (const banned of ['개선되었습니다', '성능이 향상', '수율이 향상', '업그레이드 완료', '본체는 로봇']) assert.ok(!html.includes(banned), banned);
});

test('robot page is labelled as a separate extension with synthetic and backend boundaries', () => {
  for (const phrase of ['별도 추가 기능', '그 기능들을 대체하지 않습니다', 'SYNTHETIC', 'Python 백엔드 미연결', '장비 연결·제어 없음', 'null', '출처 인증이 아닙니다', '센서 규격이 아닙니다']) assert.ok(robotHtml.includes(phrase), phrase);
  assert.match(robotHtml, /connect-src 'none'/);
  const app = readFileSync(new URL('../../web/robot/app.mjs', import.meta.url), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(app));
  assert.ok(!/innerHTML/.test(app));
});
