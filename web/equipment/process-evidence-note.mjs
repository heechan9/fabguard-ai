// Optional human-review record. It never recalculates SPC or inspection selection.
export const processFields = ['observed_fact', 'observation_ref', 'measurement_conditions',
  'process_history', 'quality_observation', 'throughput_observation',
  'comparison_lot_id', 'comparison_unit_id', 'comparison_measurement', 'comparison_unit',
  'comparison_conditions', 'inspection_selection_ref'];

export function buildProcessNote(row, input) {
  const notes = {};
  for (const key of processFields) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 500) {
      throw Error('공정 검토 메모는 항목별로 1~500자 이내로 적으세요.');
    }
    notes[key] = value.trim();
  }
  if (!Object.keys(notes).length) return null;
  const gaps = [];
  if (!notes.observed_fact || !notes.observation_ref) gaps.push('observation_or_reference_missing');
  if (!notes.measurement_conditions) gaps.push('measurement_conditions_missing');
  const lot = row.trace?.lot_id;
  const unit = row.trace?.unit_id;
  const sourceText = value => typeof value === 'string' && value.trim() ? value : null;
  const source = {
    sample_id: sourceText(row.sample_id), lot_id: sourceText(lot), unit_id: sourceText(unit),
    measurement: sourceText(row.measurement), unit: sourceText(row.unit),
  };
  if (!source.lot_id || !source.unit_id || !notes.process_history) gaps.push('process_history_missing');
  const comparisonKeys = processFields.slice(6);
  const comparison = Object.fromEntries(comparisonKeys.filter(k => Object.hasOwn(notes,k)).map(k => [k, notes[k]]));
  let comparisonState = 'NOT_REQUESTED';
  if (Object.keys(comparison).length) {
    const unlike =
      (source.lot_id && notes.comparison_lot_id && source.lot_id !== notes.comparison_lot_id) ||
      (source.unit_id && notes.comparison_unit_id && source.unit_id !== notes.comparison_unit_id) ||
      (source.measurement && notes.comparison_measurement && source.measurement !== notes.comparison_measurement) ||
      (source.unit && notes.comparison_unit && source.unit !== notes.comparison_unit) ||
      (notes.measurement_conditions && notes.comparison_conditions &&
       notes.measurement_conditions !== notes.comparison_conditions);
    if (unlike) {
      comparisonState = 'DECLARED_FIELDS_DIFFER';
      gaps.push('comparison_fields_differ');
    } else if (comparisonKeys.some(k => !notes[k]) || !source.lot_id || !source.unit_id ||
               !source.measurement || !source.unit || !notes.measurement_conditions || row.value == null) {
      comparisonState = 'INSUFFICIENT_DETAILS';
      gaps.push('comparison_details_missing');
    } else {
      comparisonState = 'DECLARED_FIELDS_MATCH_ONLY';
    }
  }
  return {
    note: {
      source_observation_identifiers: source,
      declared_observation: {fact: notes.observed_fact ?? null, reference: notes.observation_ref ?? null},
      declared_measurement_conditions: notes.measurement_conditions ?? null,
      declared_process_history: notes.process_history ?? null,
      declared_quality_observation: notes.quality_observation ?? null,
      declared_throughput_observation: notes.throughput_observation ?? null,
      declared_comparison_inputs: comparison,
      comparison_state: comparisonState,
      comparison_performed: false,
    },
    gaps,
  };
}
