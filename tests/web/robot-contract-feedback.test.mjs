import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT_CONTROLS, markContractErrors} from '../../web/robot/contract-feedback.mjs';

function controls() {
  const fields = Object.fromEntries(CONTRACT_CONTROLS.map(id => [id, {
    attrs: new Map(id === 'period' ? [['aria-describedby', 'period-help']] : []),
    focused: false,
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.get(k) ?? null; },
    removeAttribute(k) { this.attrs.delete(k); },
    focus() { this.focused = true; },
  }]));
  return {fields, get: id => fields[id]};
}

test('minimum sample capacity failure marks minimum samples, not period', () => {
  const {fields, get} = controls();
  assert.equal(markContractErrors(get, ['min_samples_exceeds_nominal_window_capacity']), 'min-samples');
  assert.equal(fields['min-samples'].getAttribute('aria-invalid'), 'true');
  assert.equal(fields['min-samples'].getAttribute('aria-describedby'), 'contract-status');
  assert.equal(fields['min-samples'].focused, true);
  assert.equal(fields.period.getAttribute('aria-invalid'), null);
  assert.equal(fields.period.getAttribute('aria-describedby'), 'period-help');
});

test('multiple invalid fields focus first in form order and preserve existing help', () => {
  const {fields, get} = controls();
  assert.equal(markContractErrors(get, ['gap_factor_invalid', 'nominal_period_s_must_be_decimal_string',
    'cadence_rel_tolerance_invalid']), 'period');
  assert.equal(fields.period.getAttribute('aria-describedby'), 'period-help contract-status');
  for (const id of ['period', 'gap', 'tolerance']) assert.equal(fields[id].getAttribute('aria-invalid'), 'true');
  markContractErrors(get, []);
  for (const id of CONTRACT_CONTROLS) assert.equal(fields[id].getAttribute('aria-invalid'), null);
  assert.equal(fields.period.getAttribute('aria-describedby'), 'period-help');
  assert.equal(fields.gap.getAttribute('aria-describedby'), null);
});
