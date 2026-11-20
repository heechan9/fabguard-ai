"""Synthetic independent fixtures; never evidence of a physical observation join."""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
import test_decision_basis as bf
import test_semantic_mapping as mf
from fabguard.review_diagnostics import build_review_diagnostics
from fabguard.decision_basis_quality import summarize_basis_quality
from fabguard.manufacturing_review import ManufacturingReviewError, _sha256

class DiagnosticCallerTests(unittest.TestCase):
    def setUp(self):
        self.b=bf.DecisionBasisTests(); self.b.setUp()
        self.m=mf.MappingTests(); self.m.setUp()
    def originals(self):
        b=self.b
        return (b.events,b.history,b.package,b.decisions,b.enc(b.basis))
    def mapping(self):
        m=self.m
        return dict(mapping_left_raw=mf.enc(m.left),mapping_right_raw=mf.enc(m.right),
                    mapping_contract_raw=mf.enc(m.contract),mapping_as_of=m.args['as_of'],
                    mapping_caller_id=m.args['caller_id'],mapping_purpose=m.args['purpose'])
    def run_report(self,**kwargs):
        return build_review_diagnostics(*self.originals(),recorded_at='2026-09-01T00:22:00Z',**kwargs)
    def test_disclosure_warning_and_verbatim_synthetic_text(self):
        marker='SYNTHETIC_DISCLOSURE_MARKER_NOT_PERSONAL_DATA'
        d=json.loads(self.b.decisions);d['decisions'][0]['rationale']=marker
        self.b.decisions=self.b.enc(d);self.b.basis['decisions_sha256']=_sha256(self.b.decisions)
        self.m.contract['purpose']=marker;self.m.args['purpose']=marker
        r=self.run_report(**self.mapping())
        decision=[x['decision'] for x in r['basis_audit']['audit']['entries'] if x['state']=='decided'][0]
        self.assertEqual(decision['rationale'],marker)
        self.assertEqual(r['mapping']['evaluation_context']['purpose'],marker)
        self.assertIn('not a redaction',r['claim_boundary'])
        self.assertIn('Review the output before sharing',r['claim_boundary'])
        self.assertEqual(r['operational_status'],'WITHHELD')
    def test_outputs_equal_existing_calls_and_inputs_unchanged(self):
        before=self.originals();r=self.run_report(**self.mapping())
        self.assertEqual(r['basis_audit'],self.b.run_record())
        self.assertEqual(r['quality'],summarize_basis_quality(*before,recorded_at='2026-09-01T00:22:00Z'))
        self.assertEqual(r['mapping'],self.m.run_case());self.assertEqual(before,self.originals())
        self.assertEqual(r['observation_linkage_status'],'NOT_ESTABLISHED')
        self.assertEqual(r['operational_status'],'WITHHELD')
    def test_mapping_match_keeps_warning_pending_hold(self):
        self.b.basis['entries'][0]['change_refs']=[]
        r=self.run_report(**self.mapping())
        self.assertEqual(r['mapping']['status'],'DECLARATIONS_MATCH')
        self.assertEqual(r['quality']['diagnostic_counts']['needs_human_review'],1)
        self.assertEqual(r['basis_audit']['audit']['counts']['pending'],2)
        decided=[x for x in r['basis_audit']['audit']['entries'] if x['state']=='decided']
        self.assertEqual(decided[0]['decision']['action'],'hold')
    def test_good_quality_does_not_clear_mapping_hold(self):
        self.m.right['unit']='K';self.m.bind();r=self.run_report(**self.mapping())
        self.assertEqual(r['quality']['diagnostic_counts']['no_structural_warning'],1)
        self.assertEqual(r['mapping'],self.m.run_case());self.assertEqual(r['mapping']['status'],'HOLD')
    def test_missing_basis_still_raises(self):
        self.b.basis['entries']=[]
        with self.assertRaises(ManufacturingReviewError):self.run_report(**self.mapping())
    def test_absent_mapping_not_match(self):
        r=self.run_report();self.assertIsNone(r['mapping']);self.assertEqual(r['mapping_input_status'],'NOT_PROVIDED')
        self.assertEqual(r['operational_status'],'WITHHELD')
    def test_partial_mapping_rejected(self):
        for key in self.mapping():
            args=self.mapping();del args[key]
            with self.subTest(key=key),self.assertRaises(ManufacturingReviewError):self.run_report(**args)
    def test_zero_submissions_remain_pending(self):
        b=self.b;d=json.loads(b.decisions);d['decisions']=[];b.decisions=b.enc(d)
        b.basis['decisions_sha256']=_sha256(b.decisions);b.basis['entries']=[]
        r=self.run_report(**self.mapping());self.assertEqual(r['quality']['counts']['pending_observations'],3)
    def test_mapping_caller_not_inferred_and_invalid_json_raises(self):
        args=self.mapping();args['mapping_caller_id']='other'
        self.assertIn('caller_id:not_bound',self.run_report(**args)['mapping']['reasons'])
        args=self.mapping();args['mapping_left_raw']=b'not-json'
        with self.assertRaises(ManufacturingReviewError):self.run_report(**args)
    def test_cli_legacy_and_opt_in_and_failure_preserves_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);args=[sys.executable,'-m','fabguard.decision_basis']
            for name,raw in zip(('events','history','package','decisions','basis'),self.originals()):
                p=root/(name+'.json');p.write_bytes(raw);args+=['--'+name,str(p)]
            out=root/'out.json';args+=['--output',str(out),'--recorded-at','2026-09-01T00:22:00Z']
            def run(extra):return subprocess.run(args+extra,capture_output=True)
            self.assertEqual(run([]).returncode,0);self.assertEqual(json.loads(out.read_bytes()),self.b.run_record())
            self.assertEqual(run(['--include-diagnostics']).returncode,0)
            self.assertEqual(json.loads(out.read_bytes()),self.run_report())
            extra=['--include-diagnostics']
            paths=[]
            for name,raw in zip(('left','right','contract'),list(self.mapping().values())[:3]):
                p=root/(name+'.json');p.write_bytes(raw);paths.append(p);extra+=['--mapping-'+name,str(p)]
            extra+=['--mapping-as-of',self.m.args['as_of'],'--mapping-caller-id','test','--mapping-purpose','offline-test']
            self.assertEqual(run(extra).returncode,0);self.assertEqual(json.loads(out.read_bytes()),self.run_report(**self.mapping()))
            previous=out.read_bytes()
            for bad in [['--mapping-left',str(paths[0])],extra[:-2]]:
                self.assertEqual(run(bad).returncode,2);self.assertEqual(previous,out.read_bytes())
            for p in paths:
                before=p.read_bytes()
                for mode in ['direct','hardlink','symlink']:
                    target=p
                    if mode!='direct':
                        target=root/('alias_'+p.name+mode)
                        if mode=='hardlink':os.link(p,target)
                        else:target.symlink_to(p)
                    self.assertEqual(run(extra+['--output',str(target)]).returncode,2)
                    self.assertEqual(p.read_bytes(),before)
            paths[0].write_bytes(b'{}')
            # Invalid declarations remain HOLD, rather than silently discarding mapping.
            self.assertEqual(run(extra).returncode,0);self.assertEqual(json.loads(out.read_bytes())['mapping']['status'],'HOLD')
if __name__=='__main__':unittest.main()
