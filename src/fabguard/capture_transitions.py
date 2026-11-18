"""Read-only declared-contract Top-K transitions, not independent evaluation."""
from datetime import datetime, timezone
import hashlib
import json
from decimal import Decimal, DecimalException
import re


class TransitionError(ValueError):
    pass


def _require(ok, message):
    if not ok:
        raise TransitionError(message)


def _fields(value, fields):
    _require(type(value) is dict and set(value) == set(fields.split()), 'unexpected/missing fields')


def _text(value):
    _require(type(value) is str and bool(value) and value == value.strip(), 'invalid text')


def _time(value):
    _text(value)
    _require(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})', value) is not None, 'invalid timestamp')
    if not value.endswith('Z'):
        _require(int(value[-5:-3]) <= 23 and int(value[-2:]) <= 59, 'invalid timezone offset')
        _require(value[-6:] != '-00:00', 'unknown timezone offset')
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)
    except (ValueError, OverflowError) as exc:
        raise TransitionError('invalid timestamp') from exc
    return result.isoformat()


def _pairs(items):
    result = {}
    for key, value in items:
        _require(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def _load(raw):
    _require(type(raw) is bytes and 0 < len(raw) <= 8_000_000, 'expected bounded JSON bytes')
    try:
        obj = json.loads(raw.decode('utf-8'), object_pairs_hook=_pairs, parse_float=Decimal,
                         parse_constant=lambda _: (_ for _ in ()).throw(TransitionError('nonfinite JSON')))
    except (UnicodeError, ValueError, RecursionError, DecimalException) as exc:
        raise TransitionError('invalid JSON') from exc
    _fields(obj, 'schema context model_version rows')
    _require(obj['schema'] == 'fabguard-capture-input/v1', 'unsupported schema')
    _text(obj['model_version'])
    ctx = obj['context']
    _fields(ctx, 'dataset_sha256 split_sha256 split_id label_rule cutoff k tie_policy exposure')
    _require(type(ctx['dataset_sha256']) is str and re.fullmatch('[0-9a-f]{64}', ctx['dataset_sha256']) is not None, 'invalid dataset hash')
    _require(type(ctx['split_sha256']) is str and re.fullmatch('[0-9a-f]{64}', ctx['split_sha256']) is not None, 'invalid split hash')
    for key in ('split_id', 'label_rule'):
        _text(ctx[key])
    ctx['cutoff'] = _time(ctx['cutoff'])
    _require(type(ctx['k']) is int and ctx['k'] > 0, 'invalid K')
    _require(ctx['tie_policy'] == 'score_desc_id_asc', 'unsupported tie policy')
    _require(ctx['exposure'] in ('exposed', 'unverified'), 'independence not established')
    _require(type(obj['rows']) is list and len(obj['rows']) >= ctx['k'], 'invalid population')
    rows = {}
    for row in obj['rows']:
        _fields(row, 'sample_id timestamp split_id label risk_score')
        sid = row['sample_id']
        _text(sid)
        _require(sid not in rows, 'duplicate ID')
        _require(row['split_id'] == ctx['split_id'], 'row split differs')
        row['timestamp'] = _time(row['timestamp'])
        _require(row['timestamp'] <= ctx['cutoff'], 'observation after cutoff')
        label = row['label']
        _require(label is None or (type(label) is int and label in (0, 1)), 'invalid label')
        score = row['risk_score']
        _require(type(score) in (int, Decimal) and 0 <= score <= 1, 'invalid score')
        rows[sid] = row
    selected = set(sorted(rows, key=lambda sid: (Decimal(rows[sid]['risk_score']).copy_negate(), sid))[:ctx['k']])
    return obj, rows, selected


def compare_capture_transitions(baseline_raw: bytes, candidate_raw: bytes | None = None) -> dict:
    """Require exact same declared population/context; never train, approve or write.

    Null labels stay unknown. Hashes bind submitted bytes, not their authenticity.
    Missing candidate is NOT_RUN, not zero improvement. Inputs are never mutated.
    """
    base, left, selected_left = _load(baseline_raw)
    result = {'schema': 'fabguard-capture-transitions/v1', 'status': 'NOT_RUN',
              'operational_status': 'WITHHELD', 'independent_evaluation': False,
              'score_policy': 'exact_submitted_json_decimal; no binary64 conversion or context-rounded arithmetic',
              'baseline_sha256': hashlib.sha256(baseline_raw).hexdigest(),
              'candidate_sha256': None, 'context': base['context'],
              'claim_boundary': 'Descriptive transitions of submitted scores only. Dataset/split/label/model/time declarations are unauthenticated; no raw-data, prespecification, independent performance, causal or factory-benefit proof.'}
    if candidate_raw is None:
        result['reason'] = 'candidate outputs not supplied'
        return result
    candidate, right, selected_right = _load(candidate_raw)
    _require(base['context'] == candidate['context'], 'comparison context differs')
    _require(left.keys() == right.keys(), 'sample sets differ')
    for sid in left:
        for key in ('label', 'timestamp', 'split_id'):
            _require(left[sid][key] == right[sid][key], 'row contract differs: ' + key)
    buckets = {f'{label}_{transition}': [] for label in ('fail', 'normal', 'unknown')
               for transition in ('newly_selected', 'newly_removed', 'jointly_selected', 'jointly_unselected')}
    for sid in sorted(left):
        label = {1: 'fail', 0: 'normal', None: 'unknown'}[left[sid]['label']]
        a, b = sid in selected_left, sid in selected_right
        transition = ('jointly_selected' if a else 'newly_selected') if b else ('newly_removed' if a else 'jointly_unselected')
        buckets[f'{label}_{transition}'].append(sid)
    denominators = {name: sum(row['label'] == value for row in left.values()) for name, value in (('fail', 1), ('normal', 0), ('unknown', None))}
    result.update(status='DESCRIPTIVE_COMPARISON', candidate_sha256=hashlib.sha256(candidate_raw).hexdigest(),
                  baseline_model=base['model_version'], candidate_model=candidate['model_version'],
                  population=len(left), denominators=denominators,
                  transitions={key: {'count': len(ids), 'sample_ids': ids,
                                     'denominator': denominators[key.split('_')[0]]} for key, ids in buckets.items()})
    return result
