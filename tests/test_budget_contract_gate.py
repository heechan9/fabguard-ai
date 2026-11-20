import copy,csv,hashlib,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from verification import budget_contract_gate as gate

class BudgetGateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.a=self.root/'a.csv';self.b=self.root/'b.csv';self.ca=self.root/'a.json';self.cb=self.root/'b.json'
        self.contract={'schema':'fabguard.declared-budget-contract.v1','snapshot_sha256':'a'*64,
            'original_ids':[f'synthetic-{i}' for i in range(392)],'eligible_ids':[f'synthetic-{i}' for i in range(12,392)],
            'held':[{'sample_id':f'synthetic-{i}','reason':'synthetic missing feature','evidence_state':'unknown','evidence_reference':'synthetic://fixture-only'} for i in range(12)],
            'budget':{'mode':'fraction','basis':'eligible','numerator':1,'denominator':10,'rounding':'ceil'},'declared_k':38}
        self.rows=[{'sample_id':f'synthetic-{i}','timestamp':'2026-01-01','risk_score':.99-(i-12)*.002,'rank':i-11,'prediction':0,'label':i%2,'model':'synthetic'} for i in range(12,392)]
        for p in [self.ca,self.cb]:self.json(p,self.contract)
        for p in [self.a,self.b]:self.csv(p,self.rows)
    def json(self,path,value):path.write_text(json.dumps(value))
    def csv(self,path,value):
        with path.open('w',newline='') as f:
            w=csv.DictWriter(f,fieldnames=list(self.rows[0]));w.writeheader();w.writerows(value)
    def run_gate(self):return gate.gated_compare(self.a,self.b,self.ca,self.cb,score_atol=0)
    def mutated(self,mutator):
        c=copy.deepcopy(self.contract);mutator(c);return c
    def blocked_contract(self,mutator):
        with self.assertRaises(gate.ContractError):gate.validate_contract(self.mutated(mutator))
    def test_valid_and_read_only(self):
        before={p:p.read_bytes() for p in [self.a,self.b,self.ca,self.cb]};r=self.run_gate()
        self.assertEqual((r['status'],r['original_count'],r['eligible_count'],r['held_count'],r['top_k']),('MATCH',392,380,12,38))
        self.assertEqual(before,{p:p.read_bytes() for p in before})
        for k in ['eligibility_truth_verified','prespecification_timing_verified','evidence_authenticity_verified','factory_readiness_verified']:self.assertFalse(r[k])
    def test_original_denominator_valid_if_declared(self):
        c=self.mutated(lambda c:c['budget'].update(basis='original'));c['declared_k']=40
        for p in [self.ca,self.cb]:self.json(p,c)
        self.assertEqual(self.run_gate()['top_k'],40)
    def test_wrong_denominator_count_blocks(self):self.blocked_contract(lambda c:c.update(declared_k=40))
    def test_same_k_but_different_rules_block(self):
        c=self.mutated(lambda c:c.update(budget={'mode':'fixed_count','count':38}));self.json(self.cb,c)
        with self.assertRaisesRegex(gate.ContractError,'contracts differ'):self.run_gate()
    def test_snapshot_mismatch_blocks(self):
        self.json(self.cb,self.mutated(lambda c:c.update(snapshot_sha256='b'*64)))
        with self.assertRaisesRegex(gate.ContractError,'contracts differ'):self.run_gate()
    def test_overlap_blocks(self):self.blocked_contract(lambda c:c['eligible_ids'].append('synthetic-0'))
    def test_unaccounted_original_blocks(self):self.blocked_contract(lambda c:c['held'].pop())
    def test_unknown_held_id_blocks(self):self.blocked_contract(lambda c:c['held'][0].update(sample_id='unseen'))
    def test_duplicate_ids_block(self):
        for field in ['original_ids','eligible_ids']:
            with self.subTest(field=field):self.blocked_contract(lambda c:c[field].append(c[field][0]))
    def test_duplicate_held_blocks(self):self.blocked_contract(lambda c:c['held'].append(c['held'][0]))
    def test_missing_reason_blocks(self):self.blocked_contract(lambda c:c['held'][0].update(reason=' '))
    def test_missing_evidence_reference_blocks(self):self.blocked_contract(lambda c:c['held'][0].update(evidence_reference=''))
    def test_invalid_evidence_state_blocks(self):self.blocked_contract(lambda c:c['held'][0].update(evidence_state='verified'))
    def test_fraction_and_k_types_are_strict(self):
        for key,value in [('numerator',True),('numerator',0),('denominator',0),('denominator',1.5),('numerator',11)]:
            with self.subTest(key=key,value=value):self.blocked_contract(lambda c:c['budget'].update({key:value}))
        self.blocked_contract(lambda c:c.update(declared_k=True))
    def test_no_implicit_budget_clamp(self):
        self.blocked_contract(lambda c:c.update(budget={'mode':'fixed_count','count':392},declared_k=392))
    def test_no_empty_eligible_cohort(self):self.blocked_contract(lambda c:c.update(eligible_ids=[]))
    def test_unknown_fields_do_not_silently_disappear(self):self.blocked_contract(lambda c:c.update(hidden_override=True))
    def test_reordered_contract_has_same_semantics(self):
        c=self.mutated(lambda c:c.update(original_ids=list(reversed(c['original_ids'])),eligible_ids=list(reversed(c['eligible_ids'])),held=list(reversed(c['held']))));self.json(self.cb,c)
        self.assertEqual(self.run_gate()['status'],'MATCH')
    def test_declared_eligible_ids_must_match_table(self):
        rows=copy.deepcopy(self.rows);rows[0]['sample_id']='synthetic-0';self.csv(self.b,rows)
        with self.assertRaisesRegex(gate.ContractError,'actual table differs'):self.run_gate()
    def test_score_difference_preserved(self):
        rows=copy.deepcopy(self.rows);rows[0]['risk_score']-=.0001;self.csv(self.b,rows)
        r=self.run_gate();self.assertEqual(r['status'],'DIFFERENT');self.assertEqual(len(r['saved_output_comparison']['differences']),1)
    def test_duplicate_json_keys_block(self):
        self.ca.write_text('{"schema":"x","schema":"y"}')
        with self.assertRaisesRegex(gate.ContractError,'duplicate JSON'):self.run_gate()
    def test_nonfinite_json_blocks(self):
        self.ca.write_text('{"x":NaN}')
        with self.assertRaisesRegex(gate.ContractError,'non-finite'):self.run_gate()
    def test_changed_comparator_source_blocks(self):
        with patch.object(gate,'SOURCE_SHA256','b'*64):
            with self.assertRaisesRegex(gate.ContractError,'comparator SHA'):self.run_gate()
    def test_only_hash_checked_source_bytes_are_executed(self):
        isolated=self.root/'isolated';isolated.mkdir(parents=True)
        source=Path(gate.__file__).parent/'compare_priority_runs.py'
        target=isolated/'compare_priority_runs.py';original=source.read_bytes();target.write_bytes(original)
        real_sha256=hashlib.sha256
        def change_after_read(raw):
            target.write_bytes(original+b'\nUNVERIFIED_SOURCE_MARKER = True\n')
            return real_sha256(raw)
        with patch.object(gate,'__file__',str(isolated/'budget_gate.py')),patch.object(gate.hashlib,'sha256',side_effect=change_after_read):
            module=gate.load_comparator()
        self.assertNotEqual(target.read_bytes(),original)
        self.assertFalse(hasattr(module,'UNVERIFIED_SOURCE_MARKER'))
        self.assertTrue(callable(module.compare))
    def test_table_changed_between_reads_blocks(self):
        mod=gate.load_comparator();original=mod.compare
        def changed(*args,**kwargs):
            rows=copy.deepcopy(self.rows);rows[0]['risk_score']-=.0001;self.csv(self.b,rows)
            return original(*args,**kwargs)
        with patch.object(mod,'compare',changed),patch.object(gate,'load_comparator',return_value=mod):
            with self.assertRaisesRegex(gate.ContractError,'table changed'):self.run_gate()
    def cli(self):return subprocess.run([sys.executable,str(Path(gate.__file__)),'--reference',str(self.a),'--actual',str(self.b),'--reference-contract',str(self.ca),'--actual-contract',str(self.cb),'--score-atol','0'],capture_output=True,text=True)
    def test_cli_success(self):
        p=self.cli();self.assertEqual(p.returncode,0,p.stderr);self.assertEqual(json.loads(p.stdout)['status'],'MATCH')
    def test_cli_budget_block(self):
        self.json(self.cb,self.mutated(lambda c:c.update(declared_k=40)));p=self.cli()
        self.assertEqual(p.returncode,2,p.stderr);self.assertEqual(json.loads(p.stdout)['status'],'BLOCKED')
    def test_cli_difference(self):
        rows=copy.deepcopy(self.rows);rows[0]['risk_score']-=.0001;self.csv(self.b,rows);p=self.cli()
        self.assertEqual(p.returncode,1,p.stderr);self.assertEqual(json.loads(p.stdout)['status'],'DIFFERENT')
    def test_cli_malformed_csv_blocks(self):
        self.b.write_text(self.b.read_text()+'"unterminated')
        p=self.cli();self.assertEqual(p.returncode,2,p.stderr);self.assertEqual(json.loads(p.stdout)['status'],'BLOCKED')

if __name__=='__main__':unittest.main(verbosity=2)
