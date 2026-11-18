import copy
import hashlib
import unittest
from fabguard.review_receipts import diagnose_review_receipts


class ReviewReceiptTests(unittest.TestCase):
    def setUp(self):
        self.commit = 'a' * 40
        self.raw = b'synthetic log only\n'
        self.digest = hashlib.sha256(self.raw).hexdigest()
        self.evidence = {self.digest: self.raw}
        self.receipt = dict(reviewer='reviewer-a', source_commit=self.commit,
                            mode='executed', command=['python', '-m', 'unittest'],
                            exit_code=0, evidence_sha256=self.digest)

    def check(self, receipt=None):
        return diagnose_review_receipts(self.commit, ['reviewer-a', 'reviewer-b'],
                                       [self.receipt if receipt is None else receipt], self.evidence)

    def test_success_is_only_declared(self):
        r = self.check()
        self.assertEqual(r['reviews'][0]['status'], 'EXECUTION_SUCCESS_DECLARED')
        self.assertEqual(r['reviews'][1]['status'], 'MISSING')
        self.assertFalse(r['operational_approval'])
        self.assertFalse(r['execution_authenticated'])
        self.assertNotIn('synthetic log', str(r))

    def test_failed(self):
        self.receipt['exit_code'] = 1
        self.assertEqual(self.check()['reviews'][0]['status'], 'EXECUTION_FAILURE_DECLARED')

    def test_static(self):
        self.receipt.update(mode='static', command=None, exit_code=None)
        self.assertEqual(self.check()['reviews'][0]['status'], 'STATIC_EVIDENCE_LINKED')

    def test_not_run(self):
        self.receipt.update(mode='not_run', command=None, exit_code=None, evidence_sha256=None)
        self.assertEqual(self.check()['reviews'][0]['status'], 'NOT_RUN')

    def test_stale(self):
        self.receipt['source_commit'] = 'b' * 40
        self.assertEqual(self.check()['reviews'][0]['status'], 'STALE_SOURCE')

    def test_stale_failure_preserved(self):
        self.receipt.update(source_commit="b" * 40, exit_code=1)
        row = self.check()["reviews"][0]
        self.assertEqual(row["status"], "STALE_SOURCE")
        self.assertEqual(row["declared_status"], "EXECUTION_FAILURE_DECLARED")

    def test_missing_bytes(self):
        self.evidence.clear()
        with self.assertRaises(ValueError): self.check()

    def test_changed_bytes(self):
        self.evidence[self.digest] = b'changed'
        with self.assertRaises(ValueError): self.check()

    def test_duplicate_receipt(self):
        with self.assertRaises(ValueError):
            diagnose_review_receipts(self.commit, ['reviewer-a'], [self.receipt]*2, self.evidence)

    def test_bad_receipt_fields(self):
        for key, value in [('reviewer', 'other'), ('exit_code', False), ('command', []),
                           ('source_commit', 'abc'), ('mode', 'PASS'), ('evidence_sha256', [])]:
            with self.subTest(key=key):
                r = dict(self.receipt); r[key] = value
                with self.assertRaises(ValueError): self.check(r)

    def test_static_and_not_run_cannot_claim_execution(self):
        for mode in ['static', 'not_run']:
            r = dict(self.receipt, mode=mode)
            with self.assertRaises(ValueError): self.check(r)

    def test_bad_envelope(self):
        for expected in [[], ['reviewer-a']*2, [' '], [1], 'reviewer-a']:
            with self.assertRaises(ValueError):
                diagnose_review_receipts(self.commit, expected, [], {})

    def test_immutability(self):
        before = copy.deepcopy((self.receipt, self.evidence))
        r = self.check(); r['reviews'][0]['status'] = 'changed'
        self.assertEqual(before, (self.receipt, self.evidence))
        self.assertEqual(self.check()['reviews'][0]['status'], 'EXECUTION_SUCCESS_DECLARED')

    def test_empty_receipts(self):
        r=diagnose_review_receipts(self.commit, ['reviewer-a'], [], {})
        self.assertEqual(r['reviews'][0]['status'], 'MISSING')

    def test_forged_success_not_authenticated(self):
        # Arbitrary bytes and false success still link: explicitly NOT authenticity.
        self.assertFalse(self.check()['execution_authenticated'])


if __name__ == '__main__': unittest.main()
