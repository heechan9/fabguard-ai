"""Read-only record-quality diagnostics, not judgment correctness or approval."""
from __future__ import annotations
import json
from .decision_basis import record_decision_basis, EVIDENCE_STATUSES
from .manufacturing_review import _sha256


def summarize_basis_quality(events_raw: bytes, history_raw: bytes, package_raw: bytes,
                            decisions_raw: bytes, basis_raw: bytes, *, recorded_at: str) -> dict:
    """Revalidate originals; describe only this valid submitted batch. No writes.

    Diagnostics cannot authenticate self-reported times, evidence, or rationale.
    Invalid/incomplete sidecars raise, rather than becoming a misleading quality score.
    """
    validated = record_decision_basis(events_raw, history_raw, package_raw,
                                     decisions_raw, basis_raw, recorded_at=recorded_at)
    package = json.loads(package_raw)
    observations = {row['review_id']: row for row in package['observations']}
    entries = validated['basis_entries']
    rows = []
    for entry in entries:
        row = observations[entry['review_id']]
        reason = entry['reason_code']
        if reason == 'context_changed':
            diagnostic = ('linked_change_present' if entry['change_refs']
                          else 'context_reason_without_change_reference')
            status = 'no_structural_warning' if entry['change_refs'] else 'needs_human_review'
        elif reason == 'measurement_missing':
            marked = 'measurement_missing' in row['reasons']
            diagnostic = ('snapshot_marks_measurement_missing' if marked
                          else 'missing_reason_not_marked_in_snapshot')
            status = 'no_structural_warning' if marked else 'needs_human_review'
        else:
            diagnostic, status = 'reason_not_machine_assessed', 'not_assessed'
        rows.append({'review_id': entry['review_id'], 'status': status, 'diagnostic': diagnostic})
    total = len(observations)
    decided = len(entries)
    return {
        'schema_version': 'fabguard-basis-quality/v1',
        'decisions_input_sha256': _sha256(decisions_raw),
        'basis_input_sha256': _sha256(basis_raw),
        'population': 'Only observations and submitted decisions in this validated snapshot; not all factory records.',
        'counts': {'observations': total, 'submitted_decisions': decided,
                   'pending_observations': total - decided, 'validated_basis_entries': decided},
        'submitted_decision_coverage': {'numerator': decided, 'denominator': total,
                                        'fraction': decided / total if total else None},
        'submission_attempt_history': {
            'status': 'unknown', 'total_attempts': None, 'rejected_attempts': None,
            'rejection_fraction': None,
            'reason': 'No submission-attempt ledger is provided; rejected inputs raise before reporting. '
                      'Do not interpret absent rejected records as zero failures or total coverage.'},
        'other_reason_usage': {
            'numerator': sum(e['reason_code'] == 'other' for e in entries),
            'denominator': decided,
            'fraction': (sum(e['reason_code'] == 'other' for e in entries) / decided
                         if decided else None),
            'population': 'Validated submitted basis entries only; pending observations and rejected attempts are excluded.',
            'interpretation': 'Reason-code usage only, not correctness, approval or factory-wide coverage.'},
        'evidence_declarations': {s: sum(e['evidence_status'] == s for e in entries)
                                  for s in sorted(EVIDENCE_STATUSES)},
        'diagnostic_counts': {s: sum(r['status'] == s for r in rows)
                              for s in ('needs_human_review', 'no_structural_warning', 'not_assessed')},
        'diagnostics': rows,
        'claim_boundary': ('Structural hints only, not semantic correctness, evidence truth, causal proof, '
                           'approval or field performance. No structural warning is not a PASS. '
                           'observed is a user declaration. Times are self-reported and this is batch '
                           'review as of the snapshot, not prediction-time evidence or proof against hindsight. '
                           'Invalid or missing submitted basis is rejected before counting; unsubmitted '
                           'observations stay pending. No submission success rate, total factory completeness or weighted quality score.'),
    }
