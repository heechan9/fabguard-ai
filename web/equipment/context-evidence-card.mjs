// Optional evidence display adapter. It does not release equipment or infer causality.
import {parsePackage, digest, stamp, compareTimes} from './context-review-model.mjs';

const classes = new Set(['FDC', 'SPC', 'unknown']);
const claims = new Set(['observation', 'causal_effect', 'wafer_uniformity']);
export const followupFields = ['verification_plan', 'side_effect_check', 'verification_evidence_ref'];
const text = (v) => typeof v === 'string' && v.trim().length > 0;


export async function buildContextEvidenceCard(raw, reviewId, annotation = {}) {
  const p = parsePackage(raw); // Reuse the existing contract; do not recalculate SPC.
  const row = p.observations.find(r => r.review_id === reviewId);
  if (!row) throw new Error('Unknown review ID');
  if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) throw new Error('Annotation must be an object');
  const allowed = new Set(['context_package_sha256', 'signal_class', 'measured_at', 'available_at', 'claim', 'measurement_sites', 'hypotheses', ...followupFields]);
  if (Object.keys(annotation).some(k => !allowed.has(k))) throw new Error('Unsupported annotation field');
  const hash = await digest(raw);
  if (annotation.context_package_sha256 !== undefined && annotation.context_package_sha256 !== hash) throw new Error('Stale annotation: exact package hash differs');
  const signalClass = annotation.signal_class ?? 'unknown';
  const claim = annotation.claim ?? 'observation';
  if (!classes.has(signalClass) || !claims.has(claim)) throw new Error('Invalid signal class or claim');
  const hypotheses = annotation.hypotheses ?? [];
  if (!Array.isArray(hypotheses) || hypotheses.length > 20 || hypotheses.some(h => !text(h) || h.length > 500)) throw new Error('Invalid hypotheses');
  const sites = annotation.measurement_sites ?? null;
  if (sites !== null && (!Number.isSafeInteger(sites) || sites < 1)) throw new Error('Invalid measurement site count');
  const followup = {};
  for (const field of followupFields) {
    if (annotation[field] == null) continue;
    if (!text(annotation[field]) || annotation[field].length > 500) throw new Error('Invalid follow-up note');
    followup[field] = annotation[field];
  }
  const blockers = [...row.reasons];
  if (signalClass === 'unknown') blockers.push('signal_class_not_declared');
  let measured = null, available = null;
  if (annotation.measured_at != null) measured = stamp(annotation.measured_at);
  if (annotation.available_at != null) available = stamp(annotation.available_at);
  if (measured === null) blockers.push('measurement_time_not_declared');
  else if (compareTimes(annotation.measured_at, p.as_of) > 0) blockers.push('measurement_after_review_cutoff');
  if (available === null) blockers.push('availability_time_not_declared');
  if (measured !== null && available !== null && compareTimes(annotation.available_at, annotation.measured_at) < 0) blockers.push('availability_before_measurement');
  if (available !== null && compareTimes(annotation.available_at, p.as_of) > 0) blockers.push('unavailable_at_review_cutoff');
  // One remaining hypothesis or multiple sites never establishes causality/uniformity.
  if (claim === 'causal_effect') blockers.push('causal_effect_not_established');
  if (claim === 'wafer_uniformity') blockers.push('wafer_uniformity_not_established');
  if (claim === 'wafer_uniformity' && sites === 1) blockers.push('single_site_cannot_establish_uniformity');
  return {
    schema_version: 'fabguard-context-evidence-card/candidate-v1',
    context_package_sha256: hash, review_id: row.review_id, data_role: p.data_role,
    observation: {event_time: row.event_time, value: row.value, unit: row.unit, measurement: row.measurement},
    source_context_state: row.context_state, source_reference_status: row.reference_status,
    declared_annotation: {source: 'user_annotation', signal_class: signalClass, measured_at: annotation.measured_at ?? null, available_at: annotation.available_at ?? null, measurement_sites: sites, claim, hypotheses: [...hypotheses], ...followup},
    related_changes: p.timeline.filter(e => row.related_changes.includes(e.change_id)).map(e => ({change_id: e.change_id, kind: e.kind, effective_at: e.effective_at, available_at: e.available_at})),
    blockers: [...new Set(blockers)],
    evidence_verification: 'NOT_PERFORMED',
    operational_decision: 'NOT_MADE',
    limitations: ['Display-only adapter; original context state is unchanged', 'Annotations are unverified declarations, not independent evidence', 'No causal, quality, safety, adoption or equipment-release approval'],
  };
}
