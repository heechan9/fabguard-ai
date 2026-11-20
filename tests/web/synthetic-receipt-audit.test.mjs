import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticReceiptAudit } from '../../web/equipment/synthetic-receipt-audit.mjs';

test('clean: same-time receipt is eligible and all fixed independent stage records reconcile', () => {
  const r = runSyntheticReceiptAudit('clean');
  assert.equal(r.status, 'MATCH');
  assert.equal(r.cutoff, '2026-01-15T09:00:00Z');
  assert.equal(r.operationalStatus, 'WITHHELD');
  assert.equal(r.lateCount, 0);
  assert.deepEqual(r.totals, { raw: 4, admitted: 4, scored: 4, rawToAdmittedLoss: 0, admittedToScoredLoss: 0 });
});

test('late-but-complete: a late receipt is counted but cannot replace an earlier eligible one', () => {
  const late = runSyntheticReceiptAudit('late-but-complete');
  const clean = runSyntheticReceiptAudit('clean');
  assert.equal(late.status, 'MATCH');
  assert.equal(late.lateCount, 1);
  assert.deepEqual(late.lateEvents, [{id: 'SYN-03', receivedAt: '2026-01-15T09:00:01Z'}]);
  assert.deepEqual(late.lateOnlyIds, []);
  assert.deepEqual(late.totals, clean.totals);
  assert.deepEqual(late.groups, clean.groups);
});

test('late-only: losing one required record blocks scoring, preserves fixed raw denominator and uses null', () => {
  const r = runSyntheticReceiptAudit('late-only');
  assert.equal(r.status, 'BLOCKED');
  assert.equal(r.scoringChecked, false);
  assert.equal(r.lateCount, 1);
  assert.deepEqual(r.lateOnlyIds, ['SYN-03']);
  assert.deepEqual(r.notAdmittedIds, ['SYN-03']);
  assert.deepEqual(r.missingScoredIds, []);
  assert.deepEqual(r.totals, { raw: 4, admitted: 3, scored: null, rawToAdmittedLoss: 1, admittedToScoredLoss: null });
  assert.ok(r.groups.every(group => group.scored === null && group.admittedToScoredLoss === null));
  assert.deepEqual(r.groups.find(group => group.lot === 'SYN-LOT-B' && group.tool === 'SYN-TOOL-1'),
                   { lot: 'SYN-LOT-B', tool: 'SYN-TOOL-1', raw: 1, admitted: 0, scored: null, rawToAdmittedLoss: 1, admittedToScoredLoss: null });
});

test('scoring-record-missing: preserves zero-scored LOT × tool grouping and traces correct stage', () => {
  const r = runSyntheticReceiptAudit('scoring-record-missing');
  assert.equal(r.status, 'MISSING');
  assert.equal(r.scoringChecked, true);
  assert.equal(r.lateCount, 0);
  assert.deepEqual(r.missingScoredIds, ['SYN-04']);
  assert.deepEqual(r.totals, { raw: 4, admitted: 4, scored: 3, rawToAdmittedLoss: 0, admittedToScoredLoss: 1 });
  assert.deepEqual(r.groups.find(group => group.lot === 'SYN-LOT-B' && group.tool === 'SYN-TOOL-2'),
                   { lot: 'SYN-LOT-B', tool: 'SYN-TOOL-2', raw: 1, admitted: 1, scored: 0, rawToAdmittedLoss: 0, admittedToScoredLoss: 1 });
});

test('rejects externally supplied fixtures and prototypes; results never share their mutable arrays', () => {
  for (const bad of ['__proto__', 'constructor', 'toString', {}, ['clean'], null]) {
    assert.throws(() => runSyntheticReceiptAudit(bad), TypeError);
  }
  const first = runSyntheticReceiptAudit('late-only');
  first.groups[0].raw = 99;
  first.lateOnlyIds.push('UNEXPECTED');
  const next = runSyntheticReceiptAudit('late-only');
  assert.equal(next.groups[0].raw, 2);
  assert.deepEqual(next.lateOnlyIds, ['SYN-03']);
});
