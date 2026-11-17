"""Adversarial checks of persisted V1 evidence, not new model evaluation."""
import csv
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'verification/recompute_v1.py'


class V1ArtifactContractTests(unittest.TestCase):
    def check_case(self, mutation=None, optimized=False):
        with tempfile.TemporaryDirectory() as directory:
            results = Path(directory) / 'v1'
            shutil.copytree(ROOT / 'results/v1', results)
            if mutation == 'threshold':
                path = results / 'manifest.json'
                manifest = json.loads(path.read_text(encoding='utf-8'))
                manifest['threshold'] = 0.6
                path.write_text(json.dumps(manifest), encoding='utf-8')
            elif mutation:
                name = 'top_k_test.csv' if mutation.startswith('top_') else 'priority_table.csv'
                path = results / name
                with path.open(encoding='utf-8', newline='') as handle:
                    reader = csv.DictReader(handle)
                    fields, rows = reader.fieldnames, list(reader)
                if mutation == 'label':
                    rows[0]['label'] = '1'
                elif mutation == 'duplicate_rank':
                    rows[0]['rank'] = '2'
                elif mutation == 'same_label_rank_swap':
                    self.assertEqual(rows[0]['label'], rows[1]['label'])
                    rows[0]['rank'], rows[1]['rank'] = rows[1]['rank'], rows[0]['rank']
                elif mutation == 'score_order':
                    rows[0]['risk_score'], rows[1]['risk_score'] = rows[1]['risk_score'], rows[0]['risk_score']
                elif mutation == 'timestamp':
                    rows[0]['timestamp'] = '2099-01-01 00:00:00'
                elif mutation == 'prediction':
                    rows[0]['prediction'] = '1'
                elif mutation == 'nonfinite':
                    rows[0]['risk_score'] = 'nan'
                elif mutation == 'top_budget':
                    rows[1]['inspection_count'] = '41'
                elif mutation == 'top_fraction':
                    rows[1]['k_fraction'] = '0.9'
                elif mutation == 'top_deleted':
                    rows.pop()
                elif mutation == 'top_duplicate':
                    rows[2] = rows[1].copy()
                elif mutation == 'top_precision':
                    rows[1]['precision'] = '0.99'
                else:
                    self.fail('unknown mutation')
                with path.open('w', encoding='utf-8', newline='') as handle:
                    writer = csv.DictWriter(handle, fields)
                    writer.writeheader()
                    writer.writerows(rows)
            command = [sys.executable] + (['-O'] if optimized else [])
            result = subprocess.run(command + [str(SCRIPT), '--results', str(results)],
                                    capture_output=True, text=True, timeout=30)
            if mutation is None:
                self.assertEqual(result.returncode, 0, result.stderr)
                report = json.loads(result.stdout)
                self.assertEqual(report['status'], 'consistent')
                self.assertEqual([r['inspection_count'] for r in report['top_k']], [20, 40, 79])
                self.assertEqual(report['metrics']['fn'], 24)
                self.assertAlmostEqual(report['metrics']['pr_auc_average_precision'], 0.09347718147533737)
            else:
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn('Evidence audit failed:', result.stderr)
                self.assertEqual(result.stdout, '')

    def test_saved_artifacts_normal_and_optimized(self):
        for optimized in (False, True):
            with self.subTest(optimized=optimized):
                self.check_case(optimized=optimized)

    def test_mutations_fail_normal_and_optimized(self):
        for mutation in ('label', 'duplicate_rank', 'same_label_rank_swap', 'score_order',
                         'timestamp', 'prediction', 'nonfinite', 'top_budget', 'top_fraction',
                         'top_deleted', 'top_duplicate', 'top_precision', 'threshold'):
            for optimized in (False, True):
                with self.subTest(mutation=mutation, optimized=optimized):
                    self.check_case(mutation, optimized)


if __name__ == '__main__':
    unittest.main()
