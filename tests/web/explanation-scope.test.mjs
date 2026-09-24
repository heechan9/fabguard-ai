import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explanationScope} from '../../web/explanation-scope.mjs';
test('RF canonical rows expose global scope, never a per-row explanation', () => {
  const rows = JSON.parse(readFileSync(new URL('../../web/data/priority_top50.json', import.meta.url)));
  for (const row of rows) {
    const scope = explanationScope(row.evidence_scope);
    assert.equal(scope.label, '전체 모델 중요도');
    assert.match(scope.description, /모든 생산 건에 동일/);
    assert.match(scope.description, /개별 예측 설명이나 위험 원인을 나타내지 않습니다/);
  }
});
test('linear contribution and unknown scopes retain distinct interpretation', () => {
  assert.match(explanationScope('local_linear_contribution').description, /로짓 기여도/);
  assert.equal(explanationScope('unexpected').showFeatures, false);
  assert.equal(explanationScope(undefined).showFeatures, false);
});
