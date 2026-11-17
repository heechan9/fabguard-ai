import copy
import json
import unittest
import test_decision_basis as basis_fixture
from fabguard.decision_basis_quality import summarize_basis_quality
from fabguard.manufacturing_review import ManufacturingReviewError, _sha256


class BasisQualityTests(unittest.TestCase):
    def setUp(self):
        fixture = basis_fixture.DecisionBasisTests()
        fixture.setUp()
        self.f = fixture

    def report(self):
        f = self.f
        return summarize_basis_quality(f.events, f.history, f.package, f.decisions,
                                       f.enc(f.basis), recorded_at='2026-09-01T00:22:00Z')

    def test_denominators_and_not_correctness(self):
        r = self.report()
        self.assertEqual(r['counts'], {'observations': 3, 'submitted_decisions': 1,
                         'pending_observations': 2, 'validated_basis_entries': 1})
        self.assertEqual(r['submitted_decision_coverage'], {'numerator': 1, 'denominator': 3, 'fraction': 1/3})
        self.assertEqual(r['diagnostic_counts']['no_structural_warning'], 1)
        self.assertEqual(r['evidence_declarations'], {'inferred': 1, 'observed': 0, 'unverified': 0})
        self.assertIn('not a PASS', r['claim_boundary'])
        self.assertEqual(r['decisions_input_sha256'], _sha256(self.f.decisions))

    def test_empty_reference_warns_without_changing_audit_or_inputs(self):
        self.f.basis['entries'][0]['change_refs'] = []
        before = copy.deepcopy(self.f.basis)
        r = self.report()
        self.assertEqual(r['diagnostic_counts']['needs_human_review'], 1)
        self.assertEqual(self.f.basis, before)
        self.assertEqual(self.f.run_record()['audit']['counts']['decided'], 1)

    def test_missing_measurement_structural_hint_both_sides(self):
        f = self.f
        f.basis['entries'][0]['reason_code'] = 'measurement_missing'
        self.assertEqual(self.report()['diagnostic_counts']['needs_human_review'], 1)
        row = json.loads(f.package)['observations'][2]
        d = json.loads(f.decisions)
        d['decisions'][0]['review_id'] = row['review_id']
        f.decisions = f.enc(d)
        f.basis['decisions_sha256'] = _sha256(f.decisions)
        f.basis['entries'][0].update(review_id=row['review_id'], observation_sha256=_sha256(f.enc(row)), change_refs=[])
        self.assertEqual(self.report()['diagnostic_counts']['no_structural_warning'], 1)

    def test_not_assessed_and_evidence_declarations(self):
        for reason in ('other', 'additional_inspection', 'reference_only'):
            for grade in ('observed', 'inferred', 'unverified'):
                with self.subTest(reason=reason, grade=grade):
                    self.f.basis['entries'][0].update(reason_code=reason, evidence_status=grade)
                    r = self.report()
                    self.assertEqual(r['diagnostic_counts']['not_assessed'], 1)
                    self.assertEqual(r['evidence_declarations'][grade], 1)
                    self.assertEqual(r['diagnostic_counts']['no_structural_warning'], 0)

    def test_no_decisions_is_not_full_coverage(self):
        f = self.f
        d = json.loads(f.decisions); d['decisions'] = []
        f.decisions = f.enc(d)
        f.basis.update(decisions_sha256=_sha256(f.decisions), entries=[])
        r = self.report()
        self.assertEqual(r['counts']['pending_observations'], 3)
        self.assertNotIn('basis_coverage_given_valid_submission', r)
        self.assertIsNone(r['submission_attempt_history']['rejection_fraction'])
        self.assertEqual(r['submitted_decision_coverage']['fraction'], 0)

    def test_invalid_missing_and_future_time_rejected_not_scored(self):
        original = copy.deepcopy(self.f.basis)
        for mutation in ('missing', 'future', 'foreign_ref', 'tampered_hash'):
            self.f.basis = copy.deepcopy(original)
            if mutation == 'missing': self.f.basis['entries'] = []
            elif mutation == 'future': self.f.basis['entries'][0]['captured_at'] = '2026-09-01T00:23:00Z'
            elif mutation == 'foreign_ref': self.f.basis['entries'][0]['change_refs'] = ['unknown']
            else: self.f.basis['decisions_sha256'] = '0'*64
            with self.subTest(mutation=mutation), self.assertRaises(ManufacturingReviewError):
                self.report()

    def test_unknown_attempt_population_not_zero_or_one_hundred_percent(self):
        r = self.report()
        self.assertNotIn('basis_coverage_given_valid_submission', r)
        history = r['submission_attempt_history']
        self.assertEqual(history['status'], 'unknown')
        for key in ('total_attempts', 'rejected_attempts', 'rejection_fraction'):
            self.assertIsNone(history[key])
        self.assertIn('No submission-attempt ledger', history['reason'])
        self.assertEqual(r['submitted_decision_coverage']['denominator'], 3)
        self.assertEqual(r['counts']['pending_observations'], 2)

    def test_rejected_attempt_then_valid_does_not_claim_attempt_history(self):
        original = copy.deepcopy(self.f.basis)
        self.f.basis['entries'] = []
        with self.assertRaises(ManufacturingReviewError):
            self.report()
        self.f.basis = original
        r = self.report()
        self.assertIsNone(r['submission_attempt_history']['rejected_attempts'])
        self.assertIsNone(r['submission_attempt_history']['total_attempts'])
        self.assertEqual(r['counts']['pending_observations'], 2)
