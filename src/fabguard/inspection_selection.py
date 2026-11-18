"""Descriptive inspection-budget summary, never detector error rates or approval."""
from __future__ import annotations

from .capture_transitions import compare_capture_transitions


def summarize_inspection_selection(baseline_raw: bytes, candidate_raw: bytes | None = None) -> dict:
    """Reuse the same-sample contract; retain both harmful and helpful transitions.

    Top-K selection is an inspection recommendation, not a defect verdict.
    Missing labels never become normal. Zero denominators produce no rate.
    No thresholds are fitted and no data, model or evidence is authenticated.
    """
    evidence = compare_capture_transitions(baseline_raw, candidate_raw)
    report = {
        'schema': 'fabguard-inspection-selection/v1',
        'status': evidence['status'],
        'operational_status': evidence['operational_status'],
        'independent_evaluation': evidence['independent_evaluation'],
        'metric_scope': 'Top-K inspection selection only; not detector false-positive/false-negative rates',
        'detector_error_rates': {
            'status': 'NOT_COMPUTED',
            'reason': 'Inputs contain risk scores and inspection budget, not detector verdicts under a fixed decision rule.',
        },
        'evidence': evidence,
    }
    if evidence['status'] == 'NOT_RUN':
        return report

    transitions = evidence['transitions']
    denominators = evidence['denominators']

    def fraction(numerator, denominator):
        return {'numerator': numerator, 'denominator': denominator,
                'value': numerator / denominator if denominator else None}

    summaries = {}
    for stage, selected_move, unselected_move in (
        ('baseline', 'newly_removed', 'newly_selected'),
        ('candidate', 'newly_selected', 'newly_removed'),
    ):
        selected = {label: transitions[f'{label}_jointly_selected']['count']
                    + transitions[f'{label}_{selected_move}']['count']
                    for label in denominators}
        unselected = {label: transitions[f'{label}_jointly_unselected']['count']
                      + transitions[f'{label}_{unselected_move}']['count']
                      for label in denominators}
        summaries[stage] = {
            'selected_counts': selected,
            'unselected_counts': unselected,
            'normal_selection_fraction': fraction(selected['normal'], denominators['normal']),
            'fail_unselected_fraction': fraction(unselected['fail'], denominators['fail']),
        }
    report['selection_summary'] = summaries
    return report
