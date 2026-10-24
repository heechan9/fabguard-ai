// Contract validation feedback follows the offending control in DOM order.
// In particular, a minimum-sample error belongs to that input, not the period.
export const CONTRACT_CONTROLS = ['period', 'tolerance', 'gap', 'min-samples', 'rms-mode', 'reset-after-alarm'];
const FIELDS = {
  nominal_period_s_must_be_decimal_string: ['period'],
  cadence_rel_tolerance_invalid: ['tolerance'],
  gap_factor_invalid: ['gap'],
  min_samples_invalid: ['min-samples'],
  min_samples_exceeds_nominal_window_capacity: ['min-samples'],
  rms_mode_unsupported: ['rms-mode'],
  reset_after_alarm_must_be_declared_bool: ['reset-after-alarm'],
};
export function markContractErrors(getControl, reasons) {
  const invalid = new Set(reasons.flatMap(reason => FIELDS[reason] || []));
  for (const id of CONTRACT_CONTROLS) {
    const control = getControl(id);
    if (invalid.has(id)) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
    const descriptions = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.delete('contract-status');
    if (invalid.has(id)) descriptions.add('contract-status');
    if (descriptions.size) control.setAttribute('aria-describedby', [...descriptions].join(' '));
    else control.removeAttribute('aria-describedby');
  }
  const first = CONTRACT_CONTROLS.find(id => invalid.has(id));
  if (first) getControl(first).focus();
  return first || null;
}
