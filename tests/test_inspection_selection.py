"""Synthetic-only education/regression fixtures; no battery measurements."""
import copy
import json
import unittest

from fabguard.capture_transitions import TransitionError
from fabguard.inspection_selection import summarize_inspection_selection as summarize


def fixture(labels=(1, 1, 0, 0, None)):
    return {'schema': 'fabguard-capture-input/v1', 'model_version': 'synthetic-baseline',
            'context': {'dataset_sha256': 'a'*64, 'split_sha256': 'b'*64,
                        'split_id': 'synthetic-education', 'label_rule': 'synthetic fail=1 normal=0 unknown=null',
                        'cutoff': '2026-01-02T00:00:00Z', 'k': 2,
                        'tie_policy': 'score_desc_id_asc', 'exposure': 'unverified'},
            'rows': [{'sample_id': f's{i}', 'timestamp': '2026-01-01T00:00:00Z',
                      'split_id': 'synthetic-education', 'label': label, 'risk_score': score}
                     for i, (label, score) in enumerate(zip(labels, [.9, .1, .8, .2, .3]))]}


def raw(data):
    return json.dumps(data).encode()


class InspectionSelectionTests(unittest.TestCase):
    def test_normal_selection_decrease_can_hide_fail_loss(self):
        a = fixture(); b = copy.deepcopy(a)
        # Replace selected fail and normal with two unknowns: fewer normals selected
        # is NOT improvement. Both populations, labels and K remain fixed.
        a['rows'][3]['label'] = b['rows'][3]['label'] = None
        b['model_version'] = 'synthetic-candidate'
        b['rows'][3]['risk_score'] = 1; b['rows'][4]['risk_score'] = .99
        r = summarize(raw(a), raw(b)); s = r['selection_summary']
        self.assertEqual(s['baseline']['normal_selection_fraction']['value'], 1)
        self.assertEqual(s['candidate']['normal_selection_fraction']['value'], 0)
        self.assertEqual(s['baseline']['fail_unselected_fraction']['value'], .5)
        self.assertEqual(s['candidate']['fail_unselected_fraction']['value'], 1)
        self.assertEqual(r['evidence']['transitions']['fail_newly_removed']['sample_ids'], ['s0'])
        self.assertEqual(s['candidate']['selected_counts']['unknown'], 2)
        self.assertEqual(r['detector_error_rates']['status'], 'NOT_COMPUTED')
        self.assertEqual(r['operational_status'], 'WITHHELD')
        self.assertFalse(r['independent_evaluation'])

    def test_new_fail_capture_and_new_miss_not_netted(self):
        a=fixture(); b=copy.deepcopy(a); b['rows'][0]['risk_score']=0; b['rows'][1]['risk_score']=1
        r=summarize(raw(a),raw(b)); t=r['evidence']['transitions']
        self.assertEqual(t['fail_newly_selected']['sample_ids'], ['s1'])
        self.assertEqual(t['fail_newly_removed']['sample_ids'], ['s0'])
        self.assertEqual(r['selection_summary']['baseline']['fail_unselected_fraction'],
                         r['selection_summary']['candidate']['fail_unselected_fraction'])

    def test_no_fail_labels_means_unknown_rate_not_zero(self):
        a=raw(fixture((0,0,0,0,None))); r=summarize(a,a)
        self.assertEqual(r['selection_summary']['baseline']['fail_unselected_fraction'],
                         {'numerator':0,'denominator':0,'value':None})

    def test_no_normal_labels_means_unknown_rate_not_zero(self):
        a=raw(fixture((1,1,1,1,None))); r=summarize(a,a)
        self.assertIsNone(r['selection_summary']['candidate']['normal_selection_fraction']['value'])

    def test_all_unknown_stays_unknown(self):
        a=raw(fixture((None,)*5)); r=summarize(a,a)
        for stage in r['selection_summary'].values():
            self.assertEqual(stage['selected_counts'], {'fail':0,'normal':0,'unknown':2})
            self.assertIsNone(stage['fail_unselected_fraction']['value'])
            self.assertIsNone(stage['normal_selection_fraction']['value'])

    def test_exhaustive_small_population_against_direct_membership(self):
        from itertools import permutations
        for k in (1,2):
            for left_scores in permutations((.1,.5,.9)):
                for right_scores in permutations((.1,.5,.9)):
                    a=fixture((1,0,None)); b=copy.deepcopy(a)
                    a['context']['k']=b['context']['k']=k
                    for row,score in zip(a['rows'],left_scores): row['risk_score']=score
                    for row,score in zip(b['rows'],right_scores): row['risk_score']=score
                    result=summarize(raw(a),raw(b))['selection_summary']
                    for name,scores in [('baseline',left_scores),('candidate',right_scores)]:
                        chosen=set(sorted(range(3),key=lambda i:-scores[i])[:k])
                        expected={label:int(i in chosen) for i,label in enumerate(('fail','normal','unknown'))}
                        self.assertEqual(result[name]['selected_counts'],expected)
                        self.assertEqual(result[name]['normal_selection_fraction']['value'],int(1 in chosen))
                        self.assertEqual(result[name]['fail_unselected_fraction']['value'],int(0 not in chosen))

    def test_missing_candidate_has_no_numeric_summary(self):
        r=summarize(raw(fixture()))
        self.assertEqual(r['status'],'NOT_RUN'); self.assertNotIn('selection_summary',r)

    def test_same_sample_and_label_contract_preserved(self):
        for key,value in [('sample_id','different'),('label',0),('timestamp','2026-01-01T01:00:00Z')]:
            a=fixture(); b=copy.deepcopy(a); b['rows'][0][key]=value
            with self.subTest(key=key), self.assertRaises(TransitionError): summarize(raw(a),raw(b))

    def test_budget_and_split_must_match(self):
        for key,value in [('k',3),('split_sha256','c'*64)]:
            a=fixture(); b=copy.deepcopy(a); b['context'][key]=value
            with self.subTest(key=key), self.assertRaises(TransitionError): summarize(raw(a),raw(b))

    def test_reordered_inputs_and_conservation(self):
        a=fixture(); b=copy.deepcopy(a); b['rows'].reverse(); ar,br=raw(a),raw(b)
        r=summarize(ar,br)
        self.assertEqual(r['selection_summary']['baseline'],r['selection_summary']['candidate'])
        for stage in r['selection_summary'].values():
            self.assertEqual(sum(stage['selected_counts'].values()),2)
            for label,n in r['evidence']['denominators'].items():
                self.assertEqual(stage['selected_counts'][label]+stage['unselected_counts'][label],n)
        self.assertEqual(ar,raw(a)); self.assertEqual(br,raw(b))


if __name__ == '__main__':
    unittest.main()
