import copy
import json
from pathlib import Path
import unittest
import subprocess
import sys
import tempfile
import os
from unittest.mock import patch
from fabguard.maintenance_review import build_context_review, DECISIONS_SCHEMA
from fabguard.manufacturing_review import ManufacturingReviewError, _sha256
from fabguard.decision_basis import record_decision_basis, BASIS_SCHEMA, _write_basis_audit

class DecisionBasisTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.events = (root/'examples/manufacturing/smt_synthetic_events.json').read_bytes()
        self.history = (root/'examples/manufacturing/maintenance_history_synthetic.json').read_bytes()
        self.package = self.enc(build_context_review(self.events, self.history, 10, as_of='2026-09-01T00:20:00Z'))
        row = json.loads(self.package)['observations'][1]
        self.decisions = self.enc({'schema_version': DECISIONS_SCHEMA, 'context_package_sha256': _sha256(self.package), 'decisions':[{'review_id':row['review_id'], 'reviewer_role':'process_engineer', 'decided_at':'2026-09-01T00:21:00Z', 'outcome':'insufficient_evidence', 'action':'hold', 'rationale':'정비 이후 비교 기준 재검토'}]})
        self.basis = {'schema_version':BASIS_SCHEMA, 'decisions_sha256':_sha256(self.decisions), 'entries':[{'review_id':row['review_id'], 'reason_code':'context_changed', 'evidence_status':'inferred', 'captured_at':'2026-09-01T00:20:30Z', 'observation_sha256':_sha256(self.enc(row)), 'change_refs':['PM-001']}]}
    @staticmethod
    def enc(x):
        return json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    def run_record(self):
        return record_decision_basis(self.events,self.history,self.package,self.decisions,self.enc(self.basis),recorded_at='2026-09-01T00:22:00Z')
    def test_valid_preserves_audit_and_pending(self):
        result=self.run_record()
        self.assertEqual(result['audit']['counts'],{'total':3,'decided':1,'pending':2})
        self.assertEqual(result['basis_entries'],self.basis['entries'])
        self.assertIn('not authenticated',result['claim_boundary'])
    def test_missing_and_duplicate_entries_rejected(self):
        for entries in ([],self.basis['entries']*2):
            with self.subTest(entries=entries):
                old=self.basis['entries']; self.basis['entries']=entries
                with self.assertRaises(ManufacturingReviewError): self.run_record()
                self.basis['entries']=old
    def test_duplicate_id_rejected_when_count_matches_two_decisions(self):
        decisions=json.loads(self.decisions)
        second=copy.deepcopy(decisions['decisions'][0])
        second['review_id']=json.loads(self.package)['observations'][0]['review_id']
        decisions['decisions'].append(second)
        self.decisions=self.enc(decisions)
        self.basis['decisions_sha256']=_sha256(self.decisions)
        self.basis['entries']*=2
        with self.assertRaisesRegex(ManufacturingReviewError,'exactly one submitted decision'):
            self.run_record()

    def test_bad_fields_rejected(self):
        original=copy.deepcopy(self.basis)
        for field,value in [('reason_code',''),('reason_code',[]),('evidence_status','proven'),('evidence_status',{}),('observation_sha256','0'*64),('change_refs',['missing']),('change_refs',['PM-001','PM-001']),('change_refs','PM-001'),('change_refs',[{}]),('captured_at','2026-09-01'),('captured_at','2026-09-01T00:19:59Z'),('captured_at','2026-09-01T00:21:01Z'),('review_id','unknown')]:
            with self.subTest(field=field,value=value):
                self.basis=copy.deepcopy(original); self.basis['entries'][0][field]=value
                with self.assertRaises(ManufacturingReviewError): self.run_record()
    def test_missing_field_rejected(self):
        del self.basis['entries'][0]['reason_code']
        with self.assertRaises(ManufacturingReviewError): self.run_record()
    def test_decision_bytes_bound(self):
        self.decisions += b' '
        with self.assertRaises(ManufacturingReviewError): self.run_record()
    def test_future_context_and_withheld_guards_preserved(self):
        decisions=json.loads(self.decisions); decisions['decisions'][0]['outcome']='confirmed_issue'; decisions['decisions'][0]['action']='release'
        self.decisions=self.enc(decisions); self.basis['decisions_sha256']=_sha256(self.decisions)
        with self.assertRaises(ManufacturingReviewError): self.run_record()
    def test_package_tampering_rejected(self):
        package=json.loads(self.package); package['as_of']='2026-09-01T00:19:00Z'; self.package=self.enc(package)
        with self.assertRaises(ManufacturingReviewError): self.run_record()
    def test_empty_decisions_remain_pending(self):
        decisions=json.loads(self.decisions); decisions['decisions']=[]; self.decisions=self.enc(decisions)
        self.basis['decisions_sha256']=_sha256(self.decisions); self.basis['entries']=[]
        self.assertEqual(self.run_record()['audit']['counts']['pending'],3)
    def test_unverified_is_not_promoted(self):
        self.basis['entries'][0]['evidence_status']='unverified'
        self.assertEqual(self.run_record()['basis_entries'][0]['evidence_status'],'unverified')
    def test_cli_valid_invalid_and_input_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            directory=Path(directory)
            args=[sys.executable,'-m','fabguard.decision_basis']
            for name, raw in [('events',self.events),('history',self.history),('package',self.package),('decisions',self.decisions),('basis',self.enc(self.basis))]:
                path=directory/(name+'.json'); path.write_bytes(raw); args += ['--'+name,str(path)]
            output=directory/'audit.json'
            tail=['--recorded-at','2026-09-01T00:22:00Z','--output',str(output)]
            result=subprocess.run(args+tail,capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(output.read_bytes())['audit']['counts']['decided'],1)
            before=output.read_bytes()
            (directory/'basis.json').write_bytes(b'{}')
            result=subprocess.run(args+tail,capture_output=True)
            self.assertEqual(result.returncode,2)
            self.assertEqual(output.read_bytes(),before)
            (directory/'basis.json').write_bytes(self.enc(self.basis))
            original=(directory/'events.json').read_bytes()
            result=subprocess.run(args+tail[:-1]+[str(directory/'events.json')],capture_output=True)
            self.assertEqual(result.returncode,2)
            self.assertEqual((directory/'events.json').read_bytes(),original)

    def test_cli_temp_collision_and_aliases_preserve_every_input(self):
        for mode in ('old_temp_name', 'output_symlink', 'output_hardlink', 'input_symlink'):
            for input_name in ('events', 'history', 'package', 'decisions', 'basis'):
                with self.subTest(mode=mode, input=input_name), tempfile.TemporaryDirectory() as directory:
                    directory=Path(directory); output=directory/'audit.json'
                    payloads=dict(events=self.events,history=self.history,package=self.package,
                                  decisions=self.decisions,basis=self.enc(self.basis))
                    paths={name:directory/(name+'.json') for name in payloads}
                    if mode=='old_temp_name': paths[input_name]=directory/'audit.json.tmp'
                    for name,path in paths.items(): path.write_bytes(payloads[name])
                    if mode=='output_symlink': output.symlink_to(paths[input_name])
                    if mode=='output_hardlink': os.link(paths[input_name],output)
                    if mode=='input_symlink':
                        target=paths[input_name]; alias=directory/'alias.json'; alias.symlink_to(target)
                        paths[input_name]=alias; output=target
                    args=[sys.executable,'-m','fabguard.decision_basis']
                    for name,path in paths.items(): args += ['--'+name,str(path)]
                    args += ['--output',str(output),'--recorded-at','2026-09-01T00:22:00Z']
                    result=subprocess.run(args,capture_output=True)
                    self.assertEqual(result.returncode,0 if mode=='old_temp_name' else 2,result.stderr)
                    for name,path in paths.items(): self.assertEqual(path.read_bytes(),payloads[name])

    def test_writer_does_not_touch_fixed_temp_symlink_and_cleans_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); source=root/'input.json'; source.write_bytes(b'original input')
            output=root/'audit.json'; output.write_bytes(b'old audit')
            fixed=root/'audit.json.tmp'; fixed.symlink_to(source)
            with patch('fabguard.decision_basis.os.replace',side_effect=OSError('test replace failure')):
                with self.assertRaises(OSError): _write_basis_audit(output,[source],{'ok':True})
            self.assertEqual(source.read_bytes(),b'original input')
            self.assertEqual(output.read_bytes(),b'old audit')
            self.assertEqual(list(root.glob('.fabguard-basis-*')),[])
            _write_basis_audit(output,[source],{'ok':True})
            self.assertTrue(fixed.is_symlink())
            self.assertEqual(source.read_bytes(),b'original input')
            self.assertEqual(json.loads(output.read_bytes()),{'ok':True})

    def test_offset_timestamp_equivalence(self):
        self.basis['entries'][0]['captured_at']='2026-09-01T09:21:00+09:00'
        self.run_record()

if __name__=='__main__': unittest.main()
