"""Synthetic API coexistence only: fixtures are NOT linked physical observations.

No adapter or aggregate approval exists here. These tests ensure independent
read-only calls do not erase warnings/pending/hold or repair rejected evidence.
"""
import copy
import unittest
import test_decision_basis as basis_fixtures
import test_semantic_mapping as mapping_fixtures
from fabguard.decision_basis_quality import summarize_basis_quality
from fabguard.manufacturing_review import ManufacturingReviewError

class DiagnosticCoexistence(unittest.TestCase):
    def setUp(self):
        self.b = basis_fixtures.DecisionBasisTests(); self.b.setUp()
        self.m = mapping_fixtures.MappingTests(); self.m.setUp()
    def quality(self):
        b=self.b
        return summarize_basis_quality(b.events,b.history,b.package,b.decisions,b.enc(b.basis),recorded_at='2026-09-01T00:22:00Z')
    def check_held_audit(self,audit):
        self.assertEqual(audit['counts'],{'total':3,'decided':1,'pending':2})
        pending=[r for r in audit['entries'] if r['state']=='pending']
        self.assertEqual(len(pending),2)
        self.assertTrue(all(r['decision'] is None for r in pending))
        decided=[r for r in audit['entries'] if r['state']=='decided']
        self.assertEqual(decided[0]['decision']['action'],'hold')
        self.assertEqual(decided[0]['decision']['outcome'],'insufficient_evidence')
    def test_mapping_match_does_not_clear_review_warning_or_hold(self):
        self.b.basis['entries'][0]['change_refs']=[]
        before=copy.deepcopy((self.b.basis,self.m.left,self.m.right,self.m.contract))
        audit=self.b.run_record()['audit'];quality=self.quality();mapping=self.m.run_case()
        self.assertEqual(mapping['status'],'DECLARATIONS_MATCH');self.assertEqual(mapping['operational_status'],'WITHHELD')
        self.assertEqual(quality['diagnostic_counts']['needs_human_review'],1)
        self.assertEqual(self.quality(),quality);self.assertEqual(self.b.run_record()['audit'],audit)
        self.check_held_audit(audit)
        self.assertEqual((self.b.basis,self.m.left,self.m.right,self.m.contract),before)
    def test_quality_no_warning_does_not_clear_mapping_hold(self):
        self.m.right['unit']='K';self.m.bind()
        first=self.m.run_case();quality=self.quality();audit=self.b.run_record()['audit'];last=self.m.run_case()
        self.assertEqual(first['status'],'HOLD');self.assertEqual(first['operational_status'],'WITHHELD');self.assertTrue(first['reasons'])
        self.assertEqual(last,first);self.assertEqual(quality['diagnostic_counts']['no_structural_warning'],1)
        self.check_held_audit(audit)
    def test_match_does_not_repair_missing_basis(self):
        self.b.basis['entries']=[]
        self.assertEqual(self.m.run_case()['status'],'DECLARATIONS_MATCH')
        for run in (self.b.run_record,self.quality):
            with self.assertRaises(ManufacturingReviewError):run()
        self.assertEqual(self.b.basis['entries'],[])
    def test_zero_submission_remains_pending_after_match(self):
        import json
        b=self.b;d=json.loads(b.decisions);d['decisions']=[];b.decisions=b.enc(d)
        from fabguard.manufacturing_review import _sha256
        b.basis['decisions_sha256']=_sha256(b.decisions);b.basis['entries']=[]
        self.m.run_case();q=self.quality();a=b.run_record()['audit']
        self.assertEqual(q['counts']['pending_observations'],3)
        self.assertEqual(q['counts']['submitted_decisions'],0)
        self.assertEqual(a['counts']['pending'],3)
        self.assertTrue(all(r['decision'] is None for r in a['entries']))
if __name__=='__main__':unittest.main()
