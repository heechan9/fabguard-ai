"""Optional offline decision-basis sidecar. No approval, control or training authority."""
from __future__ import annotations
import argparse
import json
import os
import tempfile
from pathlib import Path
from .maintenance_review import (_object, _fields, _context_timestamp, record_context_review)
from .manufacturing_review import ManufacturingReviewError, _canonical_bytes, _sha256

BASIS_SCHEMA = 'fabguard-decision-basis/v1'
REASON_CODES = {'context_changed', 'measurement_missing', 'additional_inspection', 'reference_only', 'other'}
EVIDENCE_STATUSES = {'observed', 'inferred', 'unverified'}


def record_decision_basis(events_raw: bytes, history_raw: bytes, package_raw: bytes,
                          decisions_raw: bytes, basis_raw: bytes, *, recorded_at: str) -> dict:
    """Validate a complete basis sidecar for submitted decisions, leaving pending rows pending.

    All dates, roles and evidence grades are local declarations, not authenticated facts.
    Observation hashes cover the complete context row, not just the measured value.
    """
    audit = record_context_review(events_raw, history_raw, package_raw, decisions_raw,
                                  recorded_at=recorded_at)
    package, envelope, basis = _object(package_raw), _object(decisions_raw), _object(basis_raw)
    _fields(basis, {'schema_version', 'decisions_sha256', 'entries'}, 'decision basis')
    if basis['schema_version'] != BASIS_SCHEMA or basis['decisions_sha256'] != _sha256(decisions_raw):
        raise ManufacturingReviewError('basis is not bound to the exact decision bytes')
    if not isinstance(basis['entries'], list) or len(basis['entries']) > len(envelope['decisions']):
        raise ManufacturingReviewError('basis entries must be an array with one entry per submitted decision')
    decisions = {row['review_id']: row for row in envelope['decisions']}
    observations = {row['review_id']: row for row in package['observations']}
    cutoff = _context_timestamp(package['as_of'], 'as_of')
    seen = set()
    for entry in basis['entries']:
        _fields(entry, {'review_id', 'reason_code', 'evidence_status', 'captured_at',
                        'observation_sha256', 'change_refs'}, 'basis entry')
        review_id = entry['review_id']
        if not isinstance(review_id, str) or review_id not in decisions or review_id in seen:
            raise ManufacturingReviewError('basis review_id must reference exactly one submitted decision')
        seen.add(review_id)
        for field, allowed in [('reason_code', REASON_CODES), ('evidence_status', EVIDENCE_STATUSES)]:
            if not isinstance(entry[field], str) or entry[field] not in allowed:
                raise ManufacturingReviewError(f'unsupported {field}')
        observation = observations[review_id]
        if entry['observation_sha256'] != _sha256(_canonical_bytes(observation)):
            raise ManufacturingReviewError('basis does not reference the complete decision-time observation')
        captured = _context_timestamp(entry['captured_at'], 'captured_at')
        decided = _context_timestamp(decisions[review_id]['decided_at'], 'decided_at')
        if not cutoff <= captured <= decided:
            raise ManufacturingReviewError('basis timestamp must be between snapshot cutoff and decision')
        refs = entry['change_refs']
        if (not isinstance(refs, list) or any(not isinstance(ref, str) for ref in refs)
                or len(set(refs)) != len(refs)
                or any(ref not in observation['related_changes'] for ref in refs)):
            raise ManufacturingReviewError('change_refs must be unique related changes in this snapshot')
    if seen != set(decisions):
        raise ManufacturingReviewError('missing basis for a submitted decision')
    return {
        'schema_version': 'fabguard-decision-basis-audit/v1',
        'basis_input_sha256': _sha256(basis_raw), 'audit': audit,
        'basis_entries': basis['entries'],
        'claim_boundary': ('Local declarations only; timestamps, roles and evidence grades are not authenticated. '
                           'Completeness is not decision correctness, causal proof or field performance. '
                           'No equipment control, product release, retraining or approval authority.'),
    }


def _write_basis_audit(output: Path, inputs: list[Path], result: dict) -> None:
    """Use an exclusive random sibling file; never reuse an input or fixed .tmp name.

    Local filesystem operation, not a sandbox against concurrent hostile directory changes.
    """
    if output.is_symlink():
        raise ManufacturingReviewError('output must not be a symlink')
    target = output.resolve()
    if any(target == path.resolve() or (target.exists() and target.samefile(path)) for path in inputs):
        raise ManufacturingReviewError('output must not overwrite or alias an input')
    payload = json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n'
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', prefix='.fabguard-basis-',
                                         suffix='.tmp', dir=target.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('events', 'history', 'package', 'decisions', 'basis', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--recorded-at', required=True)
    args = parser.parse_args()
    try:
        paths = [args.events, args.history, args.package, args.decisions, args.basis]
        if args.output.resolve() in [path.resolve() for path in paths]:
            raise ManufacturingReviewError('output must not overwrite an input')
        result = record_decision_basis(*(path.read_bytes() for path in paths), recorded_at=args.recorded_at)
        _write_basis_audit(args.output, paths, result)
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(2, f'decision basis refused: {error}\n')


if __name__ == '__main__':
    main()
