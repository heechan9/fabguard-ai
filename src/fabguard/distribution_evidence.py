"""Train-only descriptive evidence; no fitting, feature selection or evaluation."""
import math
import pandas as pd


def select_training(frame, manifest):
    if manifest.empty or manifest.sample_id.duplicated().any() or frame.sample_id.duplicated().any():
        raise ValueError('empty or duplicate sample identity')
    lookup = frame.set_index('sample_id')
    if not set(manifest.sample_id).issubset(lookup.index):
        raise ValueError('training sample missing')
    selected = lookup.loc[manifest.sample_id].reset_index()
    if not selected.label.reset_index(drop=True).equals(manifest.label.reset_index(drop=True)):
        raise ValueError('training labels differ from frozen manifest')
    if list(pd.to_datetime(selected.timestamp)) != list(pd.to_datetime(manifest.timestamp)):
        raise ValueError('training timestamps differ from frozen manifest')
    if not selected.label.isin([0, 1]).all():
        raise ValueError('invalid training label')
    return selected


def group_summary(frame, feature):
    if not frame.label.isin([0, 1]).all():
        raise ValueError('invalid group labels')
    groups = {}
    for label, name in [(0, 'pass'), (1, 'fail')]:
        raw = frame.loc[frame.label == label, feature]
        values = raw.dropna()
        if not all(math.isfinite(float(v)) for v in values):
            raise ValueError('nonfinite observed value')
        n, observed = len(raw), len(values)
        groups[name] = {'n_total': n, 'n_observed': observed, 'n_missing': n-observed,
                        'missing_rate': (n-observed)/n if n else None,
                        'mean': float(values.mean()) if observed else None,
                        'std': float(values.std(ddof=1)) if observed >= 2 else None,
                        'quantiles': {str(q): float(values.quantile(q)) if observed else None
                                      for q in [.05, .25, .5, .75, .95]}}
    a, b = groups['pass'], groups['fail']
    delta = b['mean']-a['mean'] if a['mean'] is not None and b['mean'] is not None else None
    standardized, reason = None, None
    if min(a['n_observed'], b['n_observed']) < 2:
        reason = 'fewer_than_two_observed_values_in_a_group'
    else:
        variance = ((a['n_observed']-1)*a['std']**2 + (b['n_observed']-1)*b['std']**2) / (a['n_observed']+b['n_observed']-2)
        if variance <= 0:
            reason = 'zero_pooled_variance'
        else:
            standardized = delta/math.sqrt(variance)
    return {'feature': feature, 'groups': groups, 'difference_direction': 'fail_minus_pass',
            'mean_difference': delta, 'standardized_mean_difference': standardized,
            'standardized_difference_unavailable_reason': reason}


def maximum_sensitivity(frame, feature):
    """Leave one group maximum out of a COPY, never a cleaning recommendation.

    Ties use the first row in the frozen training order. Original summaries and
    model inputs are unchanged; each scenario removes exactly one observed row.
    """
    baseline = group_summary(frame, feature)  # also validates observed values
    scenarios = []
    for label, group in [(0, 'pass'), (1, 'fail')]:
        observed = frame.loc[(frame.label == label) & frame[feature].notna()]
        if observed.empty:
            scenarios.append({'group': group, 'available': False,
                              'reason': 'no_observed_values'})
            continue
        maximum = observed[feature].max()
        # Positional selection avoids accidentally removing multiple equal indexes.
        positions = [i for i, (y, v) in enumerate(zip(frame.label, frame[feature]))
                     if y == label and pd.notna(v) and v == maximum]
        position = positions[0]
        reduced = frame.iloc[[i for i in range(len(frame)) if i != position]]
        row = frame.iloc[position]
        scenarios.append({'group': group, 'available': True,
                          'excluded_sample_id': str(row.sample_id),
                          'excluded_value': float(maximum),
                          'maximum_tie_count': len(positions),
                          'summary': group_summary(reduced, feature)})
    return {'scope': 'observed_training_descriptive_sensitivity_only',
            'deletion_recommended': False, 'original_data_modified': False,
            'tie_policy': 'first_in_frozen_training_order',
            'baseline': baseline, 'leave_one_group_maximum_out': scenarios}
