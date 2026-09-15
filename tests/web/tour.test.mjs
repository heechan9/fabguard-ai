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
