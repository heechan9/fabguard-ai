import itertools
import json
import unittest
from fabguard.capture_transitions import TransitionError
from fabguard.score_diagnostics import diagnose_score_windows


def payload(scores=(.5,.5,.5), labels=(0,1,0), k=1, day=1, prefix='s'):
    return json.dumps({'schema':'fabguard-capture-input/v1','model_version':'synthetic-v1',
      'context':{'dataset_sha256':'a'*64,'split_sha256':'b'*64,'split_id':'dev',
       'label_rule':'fail=1','cutoff':'2020-02-01T00:00:00Z','k':k,
       'tie_policy':'score_desc_id_asc','exposure':'exposed'},
      'rows':[{'sample_id':f'{prefix}{i}','timestamp':f'2020-01-{day:02}T00:00:00Z',
       'split_id':'dev','label':label,'risk_score':score} for i,(score,label) in enumerate(zip(scores,labels))]}).encode()

class ScoreDiagnostics(unittest.TestCase):
    def one(self,*a,**kw):return diagnose_score_windows([payload(*a,**kw)])['windows'][0]
    def test_constant_is_tie_driven(self):
        r=self.one();self.assertEqual(r['selected_known_fail'],0)
        self.assertIn('CONSTANT_SCORES_NO_WITHIN_BATCH_RANK_SIGNAL',r['flags'])
        self.assertEqual(r['known_fail_capture_range_across_boundary_ties'],{'min':0,'max':1})
    def test_ties_not_improved_to_best_case(self):
        r=self.one((.9,.5,.5),(1,0,1),2)
        self.assertEqual(r['selected_known_fail'],1)
        self.assertEqual(r['known_fail_capture_range_across_boundary_ties'],{'min':1,'max':2})
    def test_no_fail_not_success(self):
        r=self.one(labels=(0,0,0));self.assertIn('NO_KNOWN_FAIL_DENOMINATOR',r['flags'])
        self.assertNotIn('ZERO_KNOWN_FAIL_CAPTURE',r['flags'])
    def test_unknown_not_fail_or_normal(self):
        r=self.one(labels=(None,1,None));self.assertEqual(r['selected_unknown'],1)
        self.assertEqual(r['unknown_labels'],2);self.assertIn('UNKNOWN_LABELS_CAPTURE_IS_INCOMPLETE',r['flags'])
    def test_full_budget_no_selection_ambiguity(self):
        r=self.one(k=3);self.assertNotIn('BOUNDARY_TIE_ID_ORDER_AFFECTS_SELECTION',r['flags'])
        self.assertEqual(r['known_fail_capture_range_across_boundary_ties'],{'min':1,'max':1})
    def test_windows_zero_capture_retained(self):
        r=diagnose_score_windows([payload(),payload((.9,.5,.1),(1,0,0),day=2,prefix='t')])
        self.assertEqual([w['selected_known_fail'] for w in r['windows']],[0,1])
        self.assertFalse(r['independent_evaluation']);self.assertEqual(r['operational_status'],'WITHHELD')
    def test_overlapping_ids_reject(self):
        with self.assertRaises(TransitionError):diagnose_score_windows([payload(),payload(day=2)])
    def test_shared_timestamp_reject(self):
        with self.assertRaises(TransitionError):diagnose_score_windows([payload(),payload(prefix='t')])
    def test_reverse_time_reject(self):
        with self.assertRaises(TransitionError):diagnose_score_windows([payload(day=2),payload(prefix='t')])
    def test_contract_change_reject(self):
        p=json.loads(payload(day=2,prefix='t'));p['context']['label_rule']='other'
        with self.assertRaises(TransitionError):diagnose_score_windows([payload(),json.dumps(p).encode()])
    def test_exact_decimal_no_false_tie(self):
        raw=payload((.1,.2,.3),(0,0,1)).replace(b'0.1',b'0.10000000000000000000000000000000000001').replace(b'0.2',b'0.10000000000000000000000000000000000002').replace(b'0.3',b'0.10000000000000000000000000000000000003')
        r=diagnose_score_windows([raw])['windows'][0]
        self.assertEqual(r['distinct_submitted_scores'],3);self.assertEqual(r['selected_known_fail'],1)
    def test_input_unchanged_no_ids_in_output(self):
        raw=payload();before=raw[:];r=diagnose_score_windows([raw]);self.assertEqual(raw,before)
        self.assertNotIn('sample_id',json.dumps(r))
    def test_nonfinite_reject(self):
        with self.assertRaises(TransitionError):diagnose_score_windows([payload().replace(b'0.5',b'NaN')])
    def test_bad_container(self):
        for bad in [[],[b'']*101,('x',),['x'],[b' '*8_000_001]]:
            with self.assertRaises(TransitionError):diagnose_score_windows(bad)
    def test_duplicate_json_keys_reject(self):
        raw=payload().replace(b'"model_version":',b'"schema":"bad","model_version":')
        with self.assertRaises(TransitionError):diagnose_score_windows([raw])
    def test_tie_bounds_exhaustive_small(self):
        for labels in itertools.product([0,1,None],repeat=4):
            for k in [1,2,3,4]:
                r=self.one((.5,)*4,labels,k)
                counts=[sum(labels[i]==1 for i in ix) for ix in itertools.combinations(range(4),k)]
                self.assertEqual(r['known_fail_capture_range_across_boundary_ties'],{'min':min(counts),'max':max(counts)})
if __name__=='__main__':unittest.main()
