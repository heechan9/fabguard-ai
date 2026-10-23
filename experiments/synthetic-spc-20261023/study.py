"""Isolated synthetic SPC study. No real dataset or production imports."""
import hashlib
import json
import math
from pathlib import Path
import platform
import random
import statistics

METHODS = ('shewhart', 'ewma', 'cusum')
SCENARIOS = ('normal', 'step_up', 'step_down', 'ramp_up', 'ramp_down',
             'normal_invalid', 'step_up_invalid')
CONFIG = dict(seeds=list(range(50)), reference_n=2000, calibration_n=20000,
              evaluation_n=600, onset=200, alarm_budget=20, lam=.2, k=.5)
FREEZE_COMMIT = 'f02ab17038389595b60d2279afb590d405d34c09'


def valid(x):
    try:
        return type(x) in (int, float) and math.isfinite(x)
    except OverflowError:
        return False


def fit_reference(values):
    clean = [x for x in values if valid(x)]
    if len(clean) < 2:
        raise ValueError('reference needs at least two finite numbers')
    try:
        center, scale = statistics.mean(clean), statistics.stdev(clean)
    except (OverflowError, ValueError) as exc:
        raise ValueError('unrepresentable reference') from exc
    if not valid(center) or not valid(scale) or scale <= 0:
        raise ValueError('reference variation must be finite and positive')
    return center, scale


def monitor(values, center, scale, method, threshold, lam=.2, k=.5):
    if method not in METHODS or not all(valid(x) for x in (center, scale, threshold, lam, k)):
        raise ValueError('invalid detector configuration')
    if scale <= 0 or threshold <= 0 or not 0 < lam <= 1 or k < 0:
        raise ValueError('invalid detector configuration')
    e = upper = lower = 0.0
    rows = []
    for tick, x in enumerate(values):
        z = (x-center)/scale if valid(x) else None
        if z is None or not valid(z):
            rows.append(dict(tick=tick, status='invalid', statistic=None))
            e = upper = lower = 0.0
            continue
        if method == 'shewhart':
            score = abs(z)
        elif method == 'ewma':
            e = lam*z + (1-lam)*e
            score = abs(e)/math.sqrt(lam/(2-lam))
        else:
            upper = max(0.0, upper+z-k)
            lower = max(0.0, lower-z-k)
            score = max(upper, lower)
        if not valid(score):
            rows.append(dict(tick=tick, status='invalid', statistic=None))
            e = upper = lower = 0.0
            continue
        alarm = score > threshold
        rows.append(dict(tick=tick, status='alarm' if alarm else 'within', statistic=score))
        if alarm:
            e = upper = lower = 0.0
    return rows


def calibrate(values, center, scale, method):
    grid = ([i/10 for i in range(25, 51)] if method != 'cusum'
            else [i/2 for i in range(6, 31)])
    for threshold in grid:
        alarms = sum(r['status'] == 'alarm' for r in monitor(values, center, scale, method, threshold))
        if alarms <= CONFIG['alarm_budget']:
            return threshold, alarms
    return None, None


def normal(seed, n):
    rng = random.Random(seed)
    return [rng.gauss(0, 1) for _ in range(n)]


def scenario(noise, name):
    if name not in SCENARIOS:
        raise ValueError('unknown scenario')
    out = []
    for i, x in enumerate(noise):
        shift = 0.0
        if i >= 200:
            if name.startswith('step'):
                shift = -1.0 if 'down' in name else 1.0
            elif name.startswith('ramp'):
                shift = min((i-200)/199, 1.0) * (-1 if 'down' in name else 1)
        value = x+shift
        if name.endswith('invalid'):
            if i % 17 == 0:
                value = None
            if i % 53 == 0:
                value = float('nan')
            if i % 97 == 0:
                value = float('inf')
            if 190 <= i <= 209:
                value = None
        out.append(value)
    return out


def metrics(rows, changed):
    normal_rows = rows[:200] if changed else rows
    false = sum(r['status'] == 'alarm' for r in normal_rows)
    normal_valid = sum(r['status'] != 'invalid' for r in normal_rows)
    detections = [r['tick']-200 for r in rows[200:] if r['status'] == 'alarm']
    return dict(false_alarms=false, normal_valid=normal_valid, normal_ticks=len(normal_rows),
                alarms=sum(r['status'] == 'alarm' for r in rows),
                invalid=sum(r['status'] == 'invalid' for r in rows), total_ticks=len(rows),
                delay=(detections[0] if detections else None) if changed else None,
                missed=(not detections) if changed else None)


def canonical(value):
    if isinstance(value, float) and not math.isfinite(value):
        return 'NaN' if math.isnan(value) else ('Infinity' if value > 0 else '-Infinity')
    if isinstance(value, list):
        return [canonical(x) for x in value]
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in value.items()}
    return value


def digest(value):
    return hashlib.sha256(json.dumps(canonical(value), sort_keys=True, allow_nan=False,
                                    separators=(',', ':')).encode()).hexdigest()


def summarize(rows):
    result = []
    for name in SCENARIOS:
        for method in METHODS:
            group = [r for r in rows if r['scenario'] == name and r['method'] == method and r['available']]
            changed = not name.startswith('normal')
            delays = [r['delay'] for r in group if r['delay'] is not None]
            q = (statistics.quantiles(delays, n=4, method='inclusive') if len(delays) > 1
                 else [delays[0]]*3 if delays else [None]*3)
            nv = sum(r['normal_valid'] for r in group)
            nt = sum(r['normal_ticks'] for r in group)
            total = sum(r['total_ticks'] for r in group)
            invalid = sum(r['invalid'] for r in group)
            false = sum(r['false_alarms'] for r in group)
            n = len(group)
            result.append(dict(scenario=name, method=method, available_seeds=n,
                unavailable_seeds=len(CONFIG['seeds'])-n,
                false_alarms=false, false_per_valid=false/nv if nv else None,
                false_per_tick=false/nt if nt else None,
                any_false_fraction=sum(r['false_alarms'] > 0 for r in group)/n if n else None,
                valid_coverage=(total-invalid)/total if total else None,
                detected=len(delays) if changed else None,
                miss_fraction=sum(r['missed'] for r in group)/n if changed and n else None,
                delay_median=statistics.median(delays) if delays else None,
                delay_q1=q[0], delay_q3=q[2]))
    return result


def run():
    rows, inputs, calibration = [], [], []
    for seed in CONFIG['seeds']:
        reference = normal(10000+seed, CONFIG['reference_n'])
        stable = normal(20000+seed, CONFIG['calibration_n'])
        noise = normal(30000+seed, CONFIG['evaluation_n'])
        series = {name: scenario(noise, name) for name in SCENARIOS}
        inputs.append(dict(seed=seed, reference=reference, calibration=stable, evaluation=series))
        try:
            center, scale = fit_reference(reference)
        except ValueError as exc:
            for method in METHODS:
                calibration.append(dict(seed=seed, method=method, error=str(exc),
                                        reference_total=len(reference),
                                        reference_valid=sum(valid(x) for x in reference),
                                        reference_invalid=sum(not valid(x) for x in reference)))
                for name in SCENARIOS:
                    rows.append(dict(seed=seed, scenario=name, method=method, available=False))
            continue
        for method in METHODS:
            threshold, count = calibrate(stable, center, scale, method)
            calibration.append(dict(seed=seed, method=method, center=center, scale=scale,
                                    reference_total=len(reference),
                                    reference_valid=sum(valid(x) for x in reference),
                                    reference_invalid=sum(not valid(x) for x in reference),
                                    threshold=threshold, alarms=count, ticks=len(stable)))
            for name, values in series.items():
                row = dict(seed=seed, scenario=name, method=method, available=threshold is not None)
                if threshold is not None:
                    row.update(metrics(monitor(values, center, scale, method, threshold),
                                       not name.startswith('normal')))
                rows.append(row)
    return dict(config=CONFIG, protocol_commit=FREEZE_COMMIT, input_sha256=digest(inputs),
                config_sha256=digest(CONFIG), calibration=calibration,
                per_seed=rows, summary=summarize(rows))


if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    result = run()
    (here/'results.json').write_text(json.dumps(result, indent=2, sort_keys=True, allow_nan=False)+'\n', encoding='utf-8')
    metadata = dict(python=platform.python_version(), platform=platform.system(),
                    code_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                    protocol_sha256=hashlib.sha256((here/'PROTOCOL.md').read_bytes()).hexdigest())
    (here/'environment.json').write_text(json.dumps(metadata, indent=2, sort_keys=True)+'\n', encoding='utf-8')
