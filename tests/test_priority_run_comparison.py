import csv
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('priority_compare', ROOT/'verification/compare_priority_runs.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PriorityComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.a = Path(self.temp.name)/'a.csv'
        self.b = Path(self.temp.name)/'b.csv'
        self.rows = [dict(sample_id=str(i), timestamp='2008-10-01', risk_score=s,
                          rank=i+1, prediction=0, label=0, model='frozen')
                     for i, s in enumerate([.8, .7, .2])]
        self.write(self.a, self.rows)
        self.write(self.b, self.rows)

    def write(self, path, rows):
        with path.open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(self.rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def check(self, **kwargs):
        return module.compare(self.a, self.b, score_atol=kwargs.get('atol', 0), top_k=kwargs.get('k', 1))

    def test_identity_and_read_only(self):
        before = self.a.read_bytes(), self.b.read_bytes()
        self.assertEqual(self.check()['status'], 'MATCH')
        self.assertEqual(before, (self.a.read_bytes(), self.b.read_bytes()))
        self.assertFalse(self.check()['performance_evaluated'])

    def test_collects_all_differences_and_top_k(self):
        self.rows[0].update(rank=2, risk_score=.6)
        self.rows[1].update(rank=1, prediction=1)
        self.write(self.b, self.rows)
        report = self.check()
        self.assertEqual(report['status'], 'DIFFERENT')
        self.assertEqual(len(report['differences']), 2)
        self.assertIn('top_k_member', report['differences'][0]['changes'])

    def test_row_order_is_not_identity(self):
        self.write(self.b, list(reversed(self.rows)))
        self.assertEqual(self.check()['status'], 'MATCH')

    def test_explicit_tolerance_does_not_hide_rank_or_prediction(self):
        self.rows[0]['risk_score'] = .80001
        self.write(self.b, self.rows)
        self.assertEqual(self.check(atol=.001)['status'], 'MATCH')
        self.rows[0]['prediction'] = 1
        self.write(self.b, self.rows)
        self.assertEqual(self.check(atol=.001)['status'], 'DIFFERENT')

    def test_contract_mutations_block(self):
        original = [dict(r) for r in self.rows]
        for field, value in [('sample_id','1'), ('timestamp','other'), ('label',1),
                             ('model','other'), ('rank',2), ('risk_score','nan'),
                             ('risk_score',1.1), ('prediction',2)]:
            with self.subTest(field=field, value=value):
                rows = [dict(r) for r in original]
                rows[0][field] = value
                self.write(self.b, rows)
                with self.assertRaises(ValueError): self.check()
        self.write(self.b, original[:-1])
        with self.assertRaises(ValueError): self.check()

    def test_malformed_quoted_csv_is_blocked_by_cli(self):
        header = 'sample_id,timestamp,risk_score,rank,prediction,label,model\n'
        self.a.write_text(header + '0,2008-10-01,0.8,1,0,0,frozen', encoding='utf-8')
        for malformed in ['"frozen', '"fro"zen']:
            with self.subTest(model=malformed):
                self.b.write_text(header + '0,2008-10-01,0.8,1,0,0,' + malformed,
                                  encoding='utf-8')
                before = self.a.read_bytes(), self.b.read_bytes()
                result = subprocess.run(
                    [sys.executable, str(ROOT/'verification/compare_priority_runs.py'),
                     '--reference', str(self.a), '--actual', str(self.b),
                     '--score-atol', '0', '--top-k', '1'],
                    capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(json.loads(result.stdout)['status'], 'BLOCKED')
                self.assertEqual(before, (self.a.read_bytes(), self.b.read_bytes()))

    def test_invalid_configuration_blocks(self):
        for atol in [-1, float('nan'), float('inf')]:
            with self.assertRaises(ValueError): self.check(atol=atol)
        for k in [0, 4, True]:
            with self.assertRaises(ValueError): self.check(k=k)


if __name__ == '__main__':
    unittest.main()
