"""Optional saved-score warnings; no fitting, selection policy change or approval."""
import hashlib
from decimal import Decimal

from .capture_transitions import TransitionError, _load


def _summary(raw, obj, rows, selected):
    scores = {sid: Decimal(row['risk_score']) for sid, row in rows.items()}
    ordered = sorted(rows, key=lambda sid: (scores[sid].copy_negate(), sid))
    k = obj['context']['k']
    threshold = scores[ordered[k - 1]]
    above = {sid for sid in rows if scores[sid] > threshold}
    tied = {sid for sid in rows if scores[sid] == threshold}
    taken = k - len(above)
    fail = {sid for sid, row in rows.items() if row['label'] == 1}
    unknown = {sid for sid, row in rows.items() if row['label'] is None}
    tied_fails = len(tied & fail)
    fixed_fails = len(above & fail)
    flags = []
    if len(set(scores.values())) == 1:
        flags.append('CONSTANT_SCORES_NO_WITHIN_BATCH_RANK_SIGNAL')
    if taken < len(tied):
        flags.append('BOUNDARY_TIE_ID_ORDER_AFFECTS_SELECTION')
    if unknown:
        flags.append('UNKNOWN_LABELS_CAPTURE_IS_INCOMPLETE')
    if not fail:
        flags.append('NO_KNOWN_FAIL_DENOMINATOR')
    elif not fail & selected:
        flags.append('ZERO_KNOWN_FAIL_CAPTURE')
    return {
        'input_sha256': hashlib.sha256(raw).hexdigest(),
        'population': len(rows), 'k': k,
        'timestamp_min': min(row['timestamp'] for row in rows.values()),
        'timestamp_max': max(row['timestamp'] for row in rows.values()),
        'known_fail': len(fail), 'unknown_labels': len(unknown),
        'selected_known_fail': len(fail & selected),
        'selected_unknown': len(unknown & selected),
        'distinct_submitted_scores': len(set(scores.values())),
        'boundary_tie_size': len(tied), 'boundary_tie_selected': taken,
        'known_fail_capture_range_across_boundary_ties': {
            'min': fixed_fails + max(0, taken - (len(tied) - tied_fails)),
            'max': fixed_fails + min(taken, tied_fails),
        },
        'flags': flags,
    }


def diagnose_score_windows(raw_windows: list[bytes]) -> dict:
    """Diagnose submitted disjoint chronological batches without choosing a model.

    Reuses capture-transitions v1 parsing, exact decimal ordering and ID ties.
    Caller provides each window and K; no inferred daily policy or pooled gain.
    Dates, labels, hashes and split declarations are unauthenticated.
    """
    if type(raw_windows) is not list or not 1 <= len(raw_windows) <= 100:
        raise TransitionError('expected 1..100 window byte payloads')
    if any(type(raw) is not bytes for raw in raw_windows) or sum(map(len, raw_windows)) > 8_000_000:
        raise TransitionError('expected bounded JSON bytes')
    summaries, seen, previous_end, contract = [], set(), None, None
    for raw in raw_windows:
        obj, rows, selected = _load(raw)
        ctx = obj['context']
        current_contract = (ctx['dataset_sha256'], ctx['label_rule'])
        if contract is not None and contract != current_contract:
            raise TransitionError('window dataset/label declaration differs')
        contract = current_contract
        if seen & rows.keys():
            raise TransitionError('window sample overlap')
        summary = _summary(raw, obj, rows, selected)
        if previous_end is not None and summary['timestamp_min'] <= previous_end:
            raise TransitionError('windows must be strictly chronological with no shared timestamps')
        seen.update(rows)
        previous_end = summary['timestamp_max']
        summaries.append(summary)
    return {
        'schema': 'fabguard-score-diagnostics/v1',
        'status': 'DESCRIPTIVE_WARNINGS_ONLY',
        'operational_status': 'WITHHELD', 'independent_evaluation': False,
        'windows': summaries,
        'claim_boundary': 'Submitted-score diagnostics only. Constant scores lack within-batch rank signal, not proof of no model signal elsewhere. Tie bounds concern known Fail labels only, not uncertainty intervals. Windows/K are caller-supplied; no policy approval, model selection, independent or causal efficacy proof.',
    }
