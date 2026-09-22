import test from 'node:test';
import assert from 'node:assert/strict';
import {AlarmLesson} from '../../web/secom/tour-model.mjs';

test('acknowledgement never clears an active alarm or judges quality', () => {
  const lesson = new AlarmLesson();
  lesson.begin(); lesson.acknowledge(); lesson.acknowledge();
  assert.equal(lesson.snapshot().condition, 'active');
  assert.equal(lesson.snapshot().acknowledged, true);
  assert.equal(lesson.snapshot().events.length, 2);
  assert.equal(lesson.snapshot().quality, 'not_assessed');
});
test('recovery and acknowledgement remain independent in either order', () => {
  const lesson = new AlarmLesson();
  lesson.begin(); lesson.recover(); lesson.recover();
  assert.equal(lesson.snapshot().acknowledged, false);
  lesson.acknowledge();
  assert.equal(lesson.snapshot().condition, 'recovered');
  assert.deepEqual(lesson.snapshot().events.map(e => e.step), [1, 2, 3]);
  assert.equal(lesson.snapshot().quality, 'not_assessed');
});
test('reset and a new case remove stale events; snapshots cannot mutate state', () => {
  const lesson = new AlarmLesson();
  lesson.acknowledge(); lesson.recover();
  assert.equal(lesson.snapshot().events.length, 0);
  lesson.begin();
  lesson.snapshot().events[0].message = 'tampered';
  assert.notEqual(lesson.snapshot().events[0].message, 'tampered');
  lesson.acknowledge(); lesson.recover(); lesson.begin();
  assert.equal(lesson.snapshot().events.length, 1);
  assert.equal(lesson.snapshot().acknowledged, false);
  lesson.reset();
  assert.equal(lesson.snapshot().condition, 'waiting');
  assert.equal(lesson.snapshot().events.length, 0);
});

test('READY never clears overdue maintenance; acknowledging it never completes work', () => {
  const lesson = new AlarmLesson();
  lesson.begin('maintenance');
  lesson.acknowledge();
  assert.equal(lesson.snapshot().equipment, 'ready');
  assert.equal(lesson.snapshot().condition, 'active');
  assert.equal(lesson.snapshot().acknowledged, true);
  assert.equal(lesson.snapshot().quality, 'not_assessed');
  lesson.recover(); lesson.recover();
  assert.equal(lesson.snapshot().condition, 'recovered');
  assert.equal(lesson.snapshot().quality, 'not_assessed');
  assert.equal(lesson.snapshot().events.length, 3);
  lesson.begin('maintenance'); lesson.recover();
  assert.equal(lesson.snapshot().acknowledged, false);
});

test('case changes and resets clear stale READY and maintenance history; invalid cases leave state intact', () => {
  const lesson = new AlarmLesson();
  lesson.begin('maintenance'); lesson.acknowledge(); lesson.recover();
  lesson.begin('solution');
  assert.equal(lesson.snapshot().caseId, 'solution');
  assert.equal(lesson.snapshot().equipment, 'not_assessed');
  assert.equal(lesson.snapshot().acknowledged, false);
  assert.equal(lesson.snapshot().events.length, 1);
  const before = lesson.snapshot();
  for (const invalid of ['unknown', '__proto__', 'toString', null]) {
    lesson.begin(invalid);
    assert.deepEqual(lesson.snapshot(), before);
  }
  lesson.begin('maintenance'); lesson.reset();
  assert.equal(lesson.snapshot().caseId, null);
  assert.equal(lesson.snapshot().equipment, 'not_assessed');
  assert.equal(lesson.snapshot().condition, 'waiting');
  assert.deepEqual(lesson.snapshot().events, []);
});
