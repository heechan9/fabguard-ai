"""Read-only review declaration/log linkage; never executes or authenticates reviews."""
import hashlib
import re

_LIMIT = 2_000_000
_FIELDS = {'reviewer', 'source_commit', 'mode', 'command', 'exit_code', 'evidence_sha256'}


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def _text(value):
    return isinstance(value, str) and bool(value.strip()) and value == value.strip()


def diagnose_review_receipts(expected_commit, expected_reviewers, receipts, evidence):
    """Check caller-supplied declarations against a required reviewer list and bytes.

    No file/network I/O. `evidence` maps SHA-256 to bytes. Log content is not parsed
    or returned. A digest match is not proof of execution, reviewer identity,
    completeness, approval, source authenticity or correctness of the log.
    """
    _require(isinstance(expected_commit, str) and re.fullmatch('[0-9a-f]{40}', expected_commit), 'invalid expected commit')
    _require(isinstance(expected_reviewers, list) and 0 < len(expected_reviewers) <= 100, 'invalid reviewer list')
    _require(all(_text(x) for x in expected_reviewers), 'invalid reviewer')
    _require(len(set(expected_reviewers)) == len(expected_reviewers), 'duplicate expected reviewer')
    _require(isinstance(receipts, list) and len(receipts) <= 100, 'invalid receipt list')
    _require(isinstance(evidence, dict) and len(evidence) <= 100, 'invalid evidence map')
    for digest, raw in evidence.items():
        _require(isinstance(digest, str) and re.fullmatch('[0-9a-f]{64}', digest), 'invalid evidence digest')
        _require(type(raw) is bytes and 0 < len(raw) <= _LIMIT, 'invalid evidence bytes')
        _require(hashlib.sha256(raw).hexdigest() == digest, 'evidence bytes mismatch')
    rows = {}
    for receipt in receipts:
        _require(isinstance(receipt, dict) and set(receipt) == _FIELDS, 'invalid receipt fields')
        reviewer = receipt['reviewer']
        _require(_text(reviewer) and reviewer in expected_reviewers, 'unexpected reviewer')
        _require(reviewer not in rows, 'duplicate receipt')
        source = receipt['source_commit']
        _require(isinstance(source, str) and re.fullmatch('[0-9a-f]{40}', source), 'invalid source commit')
        mode = receipt['mode']
        _require(isinstance(mode, str) and mode in {'static', 'executed', 'not_run'}, 'invalid mode')
        command, code, digest = receipt['command'], receipt['exit_code'], receipt['evidence_sha256']
        if mode == 'not_run':
            _require(command is None and code is None and digest is None, 'not_run cannot carry execution evidence')
            status = 'NOT_RUN'
        else:
            _require(isinstance(digest, str) and digest in evidence, 'missing evidence bytes')
            if mode == 'static':
                _require(command is None and code is None, 'static review cannot claim execution')
                status = 'STATIC_EVIDENCE_LINKED'
            else:
                _require(isinstance(command, list) and 0 < len(command) <= 100 and all(_text(x) for x in command), 'invalid command declaration')
                _require(type(code) is int, 'invalid exit code')
                status = 'EXECUTION_SUCCESS_DECLARED' if code == 0 else 'EXECUTION_FAILURE_DECLARED'
        declared_status = status
        if source != expected_commit:
            status = 'STALE_SOURCE'
        rows[reviewer] = {'reviewer': reviewer, 'status': status, 'declared_status': declared_status, 'mode': mode}
    ordered = [rows.get(name, {'reviewer': name, 'status': 'MISSING', 'mode': None}) for name in expected_reviewers]
    return {'status': 'DECLARATION_LINKAGE_ONLY', 'source_commit': expected_commit,
            'reviews': ordered, 'operational_approval': False, 'execution_authenticated': False}
