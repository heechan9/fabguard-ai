import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildContextEvidenceCard as card} from '../../web/equipment/context-evidence-card.mjs';

const raw = readFileSync(new URL('../../web/equipment/data/maintenance-synthetic.json', import.meta.url), 'utf8');
const rows = JSON.parse(raw).observations;
const entry = rows[0];
const facts = {
  observed_fact: '해당 위치의 측정 기록', observation_ref: 'SYNTH-1/표2',
  measurement_conditions: '동일 측정 위치와 계측기', process_history: '이력 기록 SYNTH-3',
  quality_observation: '합성 재검사 결과', throughput_observation: '합성 처리량',
};
const paired = row => ({
  comparison_lot_id: row.trace.lot_id, comparison_unit_id: row.trace.unit_id,
  comparison_measurement: row.measurement, comparison_unit: row.unit,
  comparison_conditions: facts.measurement_conditions, inspection_selection_ref: 'SYNTH-4',
});

test('opt-in keeps observed facts, hypotheses, quality and throughput separate', async () => {
  const before = await card(raw, entry.review_id);
  assert.equal(Object.hasOwn(before, 'process_review_note'), false);
  const c = await card(raw, entry.review_id, {...facts, hypotheses:['정비 영향 가능성']});
  assert.deepEqual(c.process_review_note.declared_observation, {fact:facts.observed_fact, reference:facts.observation_ref});
  assert.deepEqual(c.declared_annotation.hypotheses, ['정비 영향 가능성']);
  assert.equal(c.process_review_note.declared_quality_observation, facts.quality_observation);
  assert.equal(c.process_review_note.declared_throughput_observation, facts.throughput_observation);
  assert.equal(c.process_review_note.comparison_state, 'NOT_REQUESTED');
  assert.deepEqual(c.observation, before.observation);
  assert.equal(c.context_package_sha256, before.context_package_sha256);
});

test('matching strings are not authentication, a calculated result or operational approval', async () => {
  const c = await card(raw, entry.review_id, {...facts, ...paired(entry)});
  assert.equal(c.process_review_note.comparison_state, 'DECLARED_FIELDS_MATCH_ONLY');
  assert.equal(c.process_review_note.comparison_performed, false);
  assert.equal(c.evidence_verification, 'NOT_PERFORMED');
  assert.equal(c.operational_decision, 'NOT_MADE');
  assert.equal(c.process_review_note.source_observation_identifiers.unit_id, entry.trace.unit_id);
});

test('same LOT is not enough; mismatch in any required field blocks matching', async () => {
  const fields = {comparison_lot_id:'another', comparison_unit_id:rows[1].trace.unit_id,
    comparison_measurement:'another', comparison_unit:'mm', comparison_conditions:'different'};
  for (const [k, v] of Object.entries(fields)) {
    const c = await card(raw, entry.review_id, {...facts, ...paired(entry), [k]:v});
    assert.equal(c.process_review_note.comparison_state, 'DECLARED_FIELDS_DIFFER', k);
    assert.ok(c.blockers.includes('comparison_fields_differ'));
    assert.equal(c.process_review_note.comparison_performed, false);
  }
});

test('reference or conditions alone do not fill gaps; a missing measurement remains withheld', async () => {
  const refOnly = await card(raw, entry.review_id, {inspection_selection_ref:'a'});
  assert.equal(refOnly.process_review_note.comparison_state, 'INSUFFICIENT_DETAILS');
  assert.ok(refOnly.blockers.includes('observation_or_reference_missing'));
  const missing = rows.find(r => r.value === null);
  const r = await card(raw, missing.review_id, {...facts, ...paired(missing)});
  assert.equal(r.process_review_note.comparison_state, 'INSUFFICIENT_DETAILS');
  assert.equal(r.source_context_state, 'withheld');
  assert.ok(r.blockers.includes('measurement_missing'));
});

test('rejects malformed added fields; no caller overrides comparison or review status', async () => {
  for (const extra of [{observed_fact:' '}, {observed_fact:'a'.repeat(501)}, {comparison_unit:0}, {comparison_performed:true}]) {
    await assert.rejects(card(raw, entry.review_id, extra));
  }
});
