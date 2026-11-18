import copy
import json
import unittest
from fabguard.capture_transitions import compare_capture_transitions as compare, TransitionError


def fixture():
    return {'schema': 'fabguard-capture-input/v1', 'model_version': 'baseline-v1',
            'context': {'dataset_sha256': 'a'*64, 'split_sha256': 'c'*64, 'split_id': 'heldout-v1', 'label_rule': 'fail=1',
                        'cutoff': '2026-01-02T00:00:00Z', 'k': 2,
                        'tie_policy': 'score_desc_id_asc', 'exposure': 'exposed'},
            'rows': [{'sample_id': sid, 'timestamp': '2026-01-01T00:00:00Z', 'split_id': 'heldout-v1', 'label': label, 'risk_score': score}
                     for sid, label, score in [('a',1,.9),('b',0,.8),('c',1,.7),('d',None,.1)]]}


def raw(obj):
    return json.dumps(obj).encode()


class CaptureTests(unittest.TestCase):
    def test_harmful_transition_not_hidden(self):
        a=fixture(); b=copy.deepcopy(a); b['model_version']='candidate-v1'
        b['rows'][0]['risk_score']=.2; b['rows'][2]['risk_score']=.95
        r=compare(raw(a),raw(b)); t=r['transitions']
        self.assertEqual(t['fail_newly_selected']['sample_ids'],['c'])
        self.assertEqual(t['fail_newly_removed']['sample_ids'],['a'])
        self.assertEqual(t['fail_newly_removed']['denominator'],2)
        self.assertEqual(t['unknown_jointly_unselected']['count'],1)
        self.assertFalse(r['independent_evaluation'])
        self.assertEqual(r['operational_status'],'WITHHELD')
    def test_missing_candidate(self):
        r=compare(raw(fixture())); self.assertEqual(r['status'],'NOT_RUN'); self.assertNotIn('transitions',r)
    def test_identical_and_immutable(self):
        a=raw(fixture()); before=a[:]; r=compare(a,a)
        self.assertEqual(a,before); self.assertEqual(r['transitions']['fail_newly_selected']['count'],0)
    def test_context_mismatches(self):
        for key,value in [('dataset_sha256','b'*64),('split_sha256','d'*64),('split_id','other'),('label_rule','different'),('cutoff','2026-01-03T00:00:00Z'),('k',1),('exposure','unverified')]:
            with self.subTest(key=key):
                a=fixture(); b=copy.deepcopy(a); b['context'][key]=value
                with self.assertRaises(TransitionError): compare(raw(a),raw(b))
    def test_row_contract_mismatches(self):
        for key,value in [('sample_id','z'),('label',0),('timestamp','2026-01-01T01:00:00Z'),('split_id','other')]:
            with self.subTest(key=key):
                a=fixture(); b=copy.deepcopy(a); b['rows'][0][key]=value
                with self.assertRaises(TransitionError): compare(raw(a),raw(b))
    def test_invalid_types(self):
        for key,values in [('label',[True,1.0,'1',2]),('risk_score',[True,'0.9',float('nan'),float('inf'),-1,2,10**400])]:
            for value in values:
                with self.subTest(key=key,value=str(value)):
                    a=fixture(); a['rows'][0][key]=value
                    with self.assertRaises(TransitionError): compare(raw(a))
    def test_bad_k(self):
        for value in [True,0,-1,2.0,5]:
            a=fixture(); a['context']['k']=value
            with self.assertRaises(TransitionError): compare(raw(a))
    def test_duplicate_id_missing_extra(self):
        for mode in ['duplicate','missing','extra']:
            a=fixture()
            if mode=='duplicate': a['rows'][1]['sample_id']='a'
            elif mode=='missing': del a['rows'][0]['label']
            else: a['rows'][0]['rank']=1
            with self.assertRaises(TransitionError): compare(raw(a))
    def test_json_boundaries(self):
        for value in [b'{"schema":1,"schema":2}', b'\xff', b'[]', b'null', b'', b'x'*8_000_001, 'not bytes']:
            with self.assertRaises(TransitionError): compare(value)
    def test_time_boundaries(self):
        for stamp in ['2026-01-03T00:00:00Z','2026-01-01T00:00:00','2026-02-30T00:00:00Z','2026-01-01',None]:
            a=fixture(); a['rows'][0]['timestamp']=stamp
            with self.assertRaises(TransitionError): compare(raw(a))
    def test_equivalent_timezone_and_tie_order(self):
        a=fixture(); b=copy.deepcopy(a)
        for row in a['rows']: row['risk_score']=.5
        for row in b['rows']: row['risk_score']=.5; row['timestamp']='2026-01-01T09:00:00+09:00'
        b['rows'].reverse()
        r=compare(raw(a),raw(b)); self.assertEqual(r['transitions']['fail_jointly_selected']['sample_ids'],['a'])
    def test_unknown_never_normal(self):
        a=fixture(); b=copy.deepcopy(a); b['rows'][3]['risk_score']=1
        r=compare(raw(a),raw(b)); self.assertEqual(r['transitions']['unknown_newly_selected']['count'],1)
        self.assertEqual(r['denominators'],{'fail':2,'normal':1,'unknown':1})
    def test_no_independence_declaration(self):
        a=fixture(); a['context']['exposure']='independent'
        with self.assertRaises(TransitionError): compare(raw(a))


class PrecisionAndOffsetTests(unittest.TestCase):
    def test_invalid_offset_components(self):
        for suffix in ['+09:60', '-09:60', '+24:00', '+00:99', '-00:00']:
            for field in ['row', 'cutoff']:
                a=fixture()
                if field=='row': a['rows'][0]['timestamp']='2026-01-01T10:00:00'+suffix
                else: a['context']['cutoff']='2026-01-02T10:00:00'+suffix
                with self.subTest(suffix=suffix,field=field), self.assertRaises(TransitionError): compare(raw(a))
    def test_false_tie_exact_decimal(self):
        a=fixture(); a['context']['k']=1
        for row in a['rows']: row['risk_score']=0
        a['rows'][0]['risk_score']=.5; a['rows'][2]['risk_score']=.6
        baseline=raw(a).replace(b'0.6',b'0.50000000000000001')
        candidate=raw(a).replace(b'0.6',b'0.50000000000000000')
        r=compare(baseline,candidate)
        self.assertEqual(r['transitions']['fail_newly_removed']['sample_ids'],['c'])
        self.assertEqual(r['transitions']['fail_newly_selected']['sample_ids'],['a'])
    def test_decimal_context_does_not_round_sort_key(self):
        from decimal import localcontext
        a=fixture(); a['context']['k']=1
        for row in a['rows']: row['risk_score']=0
        a['rows'][0]['risk_score']=.5; a['rows'][2]['risk_score']=.6
        data=raw(a).replace(b'0.6',b'0.50000000000000000000000000000000000000000000001')
        with localcontext() as ctx:
            ctx.prec=2
            r=compare(data,data)
        self.assertEqual(r['transitions']['fail_jointly_selected']['sample_ids'],['c'])
    def test_tiny_positive_not_zero(self):
        a=fixture(); a['context']['k']=1
        for row in a['rows']: row['risk_score']=0
        a['rows'][2]['risk_score']=.6
        data=raw(a).replace(b'0.6',b'1e-10000')
        self.assertEqual(compare(data,data)['transitions']['fail_jointly_selected']['sample_ids'],['c'])
    def test_decimal_equivalent_notations_tie(self):
        a=fixture(); a['context']['k']=1
        for row in a['rows']: row['risk_score']=0
        a['rows'][0]['risk_score']=.5; a['rows'][2]['risk_score']=.6
        data=raw(a).replace(b'0.6',b'5e-1')
        self.assertEqual(compare(data,data)['transitions']['fail_jointly_selected']['sample_ids'],['a'])
    def test_existing_baseline_score_tokens_are_accepted(self):
        import csv
        from pathlib import Path
        from fabguard.capture_transitions import _load
        from decimal import Decimal
        path=Path(__file__).resolve().parents[1]/'results/v1/priority_table.csv'
        with path.open(newline='', encoding='utf-8') as stream:
            rows=list(csv.DictReader(stream))
        # Score-format-only probe: no real timestamps/IDs/model/evaluation are inferred.
        a=fixture(); a['context']['k']=1
        for row in rows:
            token=row['risk_score']; probe=raw(a).replace(b'0.9',token.encode())
            _, loaded, _ = _load(probe)
            self.assertEqual(loaded['a']['risk_score'],Decimal(token))
    def test_number_edges(self):
        a=fixture()
        for token in [b'1.0000000000000000000000000000000000001',b'-1e-10000',b'1e99999999999999999999999999']:
            with self.subTest(token=token),self.assertRaises(TransitionError): compare(raw(a).replace(b'0.9',token))

if __name__ == "__main__": unittest.main()
