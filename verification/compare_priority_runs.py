"""Read-only comparison of saved priority tables, never a performance evaluation."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import platform


def read_table(path):
    raw = Path(path).read_bytes()
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig'), newline=''))
    required = {'sample_id', 'timestamp', 'risk_score', 'rank', 'prediction', 'label', 'model'}
    fields = reader.fieldnames or []
    if len(set(fields)) != len(fields) or not required.issubset(fields):
        raise ValueError('missing or duplicate columns')
    rows = list(reader)
    if not rows:
        raise ValueError('empty table')
    result = {}
    for row in rows:
        if None in row or any(value is None for value in row.values()):
            raise ValueError('malformed row')
        identity = row['sample_id']
        if not identity.strip() or identity in result or not row['timestamp'].strip() or not row['model'].strip():
            raise ValueError('empty or duplicate identity / metadata')
        score = float(row['risk_score'])
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError('invalid score')
        rank = int(row['rank'])
        if row['prediction'] not in {'0', '1'} or row['label'] not in {'0', '1'}:
            raise ValueError('invalid prediction or label')
        result[identity] = dict(row, risk_score=score, rank=rank)
    if sorted(r['rank'] for r in result.values()) != list(range(1, len(rows)+1)):
        raise ValueError('ranks must be a permutation of 1..n')
    if len({r['model'] for r in result.values()}) != 1:
        raise ValueError('mixed model identities')
    ordered = sorted(result.values(), key=lambda r: r['rank'])
    if any(a['risk_score'] < b['risk_score'] for a, b in zip(ordered, ordered[1:])):
        raise ValueError('rank and score order disagree')
    return result, hashlib.sha256(raw).hexdigest()


def compare(reference, actual, *, score_atol, top_k):
    if isinstance(score_atol, bool) or not math.isfinite(score_atol) or score_atol < 0:
        raise ValueError('explicit finite nonnegative score tolerance required')
    left, lh = read_table(reference)
    right, rh = read_table(actual)
    if type(top_k) is not int or not 1 <= top_k <= len(left):
        raise ValueError('invalid top_k')
    if left.keys() != right.keys():
        raise ValueError('sample sets differ')
    differences = []
    for identity, a in sorted(left.items()):
        b = right[identity]
        for field in ('timestamp', 'label', 'model'):
            if a[field] != b[field]:
                raise ValueError('comparison contract differs: '+field+' / '+identity)
        changes = {}
        if abs(a['risk_score'] - b['risk_score']) > score_atol:
            changes['risk_score'] = [a['risk_score'], b['risk_score']]
        for field in ('rank', 'prediction'):
            if a[field] != b[field]:
                changes[field] = [a[field], b[field]]
        if (a['rank'] <= top_k) != (b['rank'] <= top_k):
            changes['top_k_member'] = [a['rank'] <= top_k, b['rank'] <= top_k]
        if changes:
            differences.append({'sample_id': identity, 'changes': changes})
    return {'status': 'DIFFERENT' if differences else 'MATCH',
            'scope': 'saved_output_comparison', 'sample_count': len(left),
            'score_atol': score_atol, 'top_k': top_k, 'differences': differences,
            'input_sha256': {'reference': lh, 'actual': rh},
            'python': platform.python_version(), 'model_inference_performed': False,
            'performance_evaluated': False, 'reviewer_identity_authenticated': False,
            'claim_boundary': 'Saved-output agreement only; not independent inference, ground truth, performance or factory approval.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--actual', type=Path, required=True)
    parser.add_argument('--score-atol', type=float, required=True)
    parser.add_argument('--top-k', type=int, required=True)
    args = parser.parse_args()
    try:
        result = compare(args.reference, args.actual, score_atol=args.score_atol, top_k=args.top_k)
    except (OSError, UnicodeError, ValueError, csv.Error) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error), 'scope': 'saved_output_comparison'}))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 1 if result['status'] == 'DIFFERENT' else 0


if __name__ == '__main__':
    raise SystemExit(main())
