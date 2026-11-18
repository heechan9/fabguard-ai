"""Offline diagnostic caller. Co-reporting is not a physical observation join."""
from .decision_basis import record_decision_basis
from .decision_basis_quality import summarize_basis_quality
from .semantic_mapping import diagnose_mapping
from .manufacturing_review import ManufacturingReviewError, _sha256


def build_review_diagnostics(events_raw, history_raw, package_raw, decisions_raw,
                             basis_raw, *, recorded_at, mapping_left_raw=None,
                             mapping_right_raw=None, mapping_contract_raw=None,
                             mapping_as_of=None, mapping_caller_id=None,
                             mapping_purpose=None):
    """Revalidate original bytes; preserve independent outputs and every hold.

    Mapping inputs have their own declared cutoff/caller/purpose. No row join,
    authority authentication, aggregate pass, decision writeback or control exists.
    Supplying only part of a mapping request is an error, not an absent mapping.
    """
    mapping_inputs = (mapping_left_raw, mapping_right_raw, mapping_contract_raw,
                      mapping_as_of, mapping_caller_id, mapping_purpose)
    if any(v is not None for v in mapping_inputs) and not all(v is not None for v in mapping_inputs):
        raise ManufacturingReviewError('all six mapping inputs are required together')
    args = (events_raw, history_raw, package_raw, decisions_raw, basis_raw)
    basis = record_decision_basis(*args, recorded_at=recorded_at)
    quality = summarize_basis_quality(*args, recorded_at=recorded_at)
    mapping = None
    if mapping_left_raw is not None:
        mapping = diagnose_mapping(mapping_left_raw, mapping_right_raw, mapping_contract_raw,
                                   as_of=mapping_as_of, caller_id=mapping_caller_id,
                                   purpose=mapping_purpose)
    return {
        'schema_version': 'fabguard-review-diagnostics/v1',
        'basis_audit': basis, 'quality': quality, 'mapping': mapping,
        'mapping_input_status': 'NOT_PROVIDED' if mapping is None else 'PROVIDED',
        'observation_linkage_status': 'NOT_ESTABLISHED',
        'operational_status': 'WITHHELD',
        'review_input_sha256': dict(zip(('events', 'history', 'package', 'decisions', 'basis'),
                                       (_sha256(raw) for raw in args))),
        'claim_boundary': ('Offline read-only co-reporting only. Mapping sources are not joined to '
                           'review observations, even when names or declared times coincide. '
                           'No aggregate PASS, authenticated authority, AAS connection, equipment '
                           'control, release, retraining or operational approval. Original pending, '
                           'hold and warning states remain unchanged. This is not a redaction or '
                           'de-identification tool: submitted rationale, roles, evidence and mapping '
                           'evaluation text may remain verbatim. Review the output before sharing.'),
    }
