"""Isolated synthetic two-source mapping diagnostics, never operational eligibility."""
from __future__ import annotations

from .maintenance_review import _object, _context_timestamp
from .manufacturing_review import ManufacturingReviewError, _sha256

SEMANTICS = ('physical_asset_id', 'semantic_id', 'unit', 'definition_version',
             'process_step', 'recipe_id', 'recipe_version')
ENDPOINT = ('source_id', 'namespace', 'equipment_id', 'property_id') + SEMANTICS
TIMES = ('observed_at', 'available_at', 'valid_from', 'valid_until')


def diagnose_mapping(left_raw: bytes, right_raw: bytes, contract_raw: bytes, *,
                     as_of: str, caller_id: str, purpose: str) -> dict:
    """Compare one explicitly bound pair without modifying or promoting existing audits.

    Exact strings only; no guessed aliases, unit conversion, registry lookup or trust
    authentication. Incomplete declarations yield HOLD. Malformed JSON raises the
    existing ManufacturingReviewError. Every result remains operationally withheld.
    """
    left, right, contract = map(_object, (left_raw, right_raw, contract_raw))
    reasons = []

    def add(reason):
        if reason not in reasons:
            reasons.append(reason)

    def text(value):
        return isinstance(value, str) and bool(value) and value == value.strip()

    def timestamp(value, label):
        try:
            return _context_timestamp(value, label)
        except (ValueError, TypeError, OverflowError):
            add(label + ':unknown_or_invalid')
            return None

    cutoff = timestamp(as_of, 'as_of')
    times = []
    for label, source in (('left', left), ('right', right)):
        required = {'schema_version', 'data_role', *ENDPOINT, *TIMES}
        if set(source) != required:
            add(label + ':fields_mismatch')
        if source.get('schema_version') != 'fabguard-mapping-source/v1':
            add(label + ':schema_mismatch')
        if source.get('data_role') != 'synthetic':
            add(label + ':non_synthetic_not_supported')
        for key in ENDPOINT:
            if not text(source.get(key)):
                add(label + ':' + key + ':unknown_or_invalid')
        parsed = {key: timestamp(source.get(key), label + ':' + key) for key in TIMES}
        times.append(parsed)
        start, end = parsed['valid_from'], parsed['valid_until']
        observed, available = parsed['observed_at'], parsed['available_at']
        if start is not None and end is not None and start >= end:
            add(label + ':invalid_validity_interval')
        if cutoff is not None and all(t is not None for t in parsed.values()):
            if not start <= observed <= available <= cutoff < end:
                add(label + ':time_outside_contract')
    if text(left.get('source_id')) and left.get('source_id') == right.get('source_id'):
        add('sources:not_distinct')
    for key in SEMANTICS:
        if left.get(key) != right.get(key):
            add(key + ':mismatch')
    if all(t['observed_at'] is not None for t in times):
        if times[0]['observed_at'] != times[1]['observed_at']:
            add('observed_at:mismatch')

    required = {'schema_version', 'data_role', 'mapping_id', 'mapping_version',
                'authority_id', 'authority_evidence_ref', 'caller_id', 'purpose',
                'left', 'right', 'left_sha256', 'right_sha256',
                'declared_at', 'valid_from', 'valid_until'}
    if set(contract) != required:
        add('contract:fields_mismatch')
    if contract.get('schema_version') != 'fabguard-mapping-contract/v1':
        add('contract:schema_mismatch')
    if contract.get('data_role') != 'synthetic':
        add('contract:non_synthetic_not_supported')
    for key in ('mapping_id', 'mapping_version', 'authority_id', 'authority_evidence_ref',
                'caller_id', 'purpose'):
        if not text(contract.get(key)):
            add('contract:' + key + ':unknown_or_invalid')
    for key, value in (('caller_id', caller_id), ('purpose', purpose)):
        if not text(value) or value != contract.get(key):
            add(key + ':not_bound')
    for label, source, raw in (('left', left, left_raw), ('right', right, right_raw)):
        endpoint = contract.get(label)
        if (not isinstance(endpoint, dict) or set(endpoint) != set(ENDPOINT)
                or any(not text(endpoint.get(k)) or endpoint[k] != source.get(k)
                       for k in ENDPOINT)):
            add('contract:' + label + ':endpoint_mismatch')
        if contract.get(label + '_sha256') != _sha256(raw):
            add('contract:' + label + ':bytes_mismatch')
    declared = timestamp(contract.get('declared_at'), 'contract:declared_at')
    start = timestamp(contract.get('valid_from'), 'contract:valid_from')
    end = timestamp(contract.get('valid_until'), 'contract:valid_until')
    if all(t is not None for t in (cutoff, declared, start, end)):
        if not start <= declared <= cutoff < end:
            add('contract:time_outside_contract')
        for parsed in times:
            observed = parsed['observed_at']
            if observed is not None and not start <= observed < end:
                add('contract:observation_outside_validity')
    return {
        'schema_version': 'fabguard-mapping-diagnostic/v1',
        'status': 'HOLD' if reasons else 'DECLARATIONS_MATCH',
        'reasons': reasons,
        'operational_status': 'WITHHELD',
        'evaluation_context': {key: value if isinstance(value, str) else None
                               for key, value in (('as_of', as_of), ('caller_id', caller_id),
                                                  ('purpose', purpose))},
        'authority_status': 'unverified_declaration',
        'source_independence': 'unverified',
        'input_sha256': {'left': _sha256(left_raw), 'right': _sha256(right_raw),
                         'contract': _sha256(contract_raw)},
        'claim_boundary': 'Synthetic declared consistency only. Not authenticated mapping, '
                          'evidence truth, semantic eligibility, approval or equipment control. '
                          'No changes to decision_basis, quality, pending rows or existing holds.',
    }
