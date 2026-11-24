"""Synthetic-only tests; no imports or reads of production data."""
import math
import unittest
from unittest.mock import patch
import study as s


class StudyTests(unittest.TestCase):
    def test_reference_sample_sd_and_invalid_counting(self):
        self.assertEqual(s.fit_reference([0, 2, None, float('nan'), True, '2']), (1, math.sqrt(2)))

    def test_bad_reference(self):
        for values in ([], [None]*10, [1], [2]*10, [float('inf'), None]):
            with self.subTest(values=values), self.assertRaises(ValueError):
                s.fit_reference(values)

    def test_bad_configuration(self):
        for field, value in [('scale', 0), ('lam', 0), ('lam', 2), ('k', -1),
                             ('threshold', 0), ('center', float('nan')), ('method', 'other')]:
            args = dict(values=[0], center=0, scale=1, method='ewma', threshold=3)
            args[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                s.monitor(**args)

    def test_nist_ewma_recurrence(self):
        rows = s.monitor([52, 47, 53], 50, 2.0539, 'ewma', 100, lam=.3)
        expected = [50.6, 49.52, 50.564]
        for row, e in zip(rows, expected):
            self.assertAlmostEqual(row['statistic'], abs(e-50)/2.0539/math.sqrt(.3/1.7), places=12)

    def test_cusum_hand_calculation(self):
        rows = s.monitor([1, 1, -2, -1], 0, 1, 'cusum', 100)
        self.assertEqual([r['statistic'] for r in rows], [.5, 1, 1.5, 2])

    def test_lambda_one_equals_shewhart(self):
        for method in ('shewhart', 'ewma'):
            rows = s.monitor([0, -2, 4, None, 1], 0, 1, method, 3, lam=1)
            if method == 'shewhart':
                expected = rows
            else:
                self.assertEqual(rows, expected)

    def test_symmetry(self):
        for method in s.METHODS:
            a = s.monitor([.2, 2, 2, -3, -2], 0, 1, method, 2)
            b = s.monitor([-.2, -2, -2, 3, 2], 0, 1, method, 2)
            self.assertEqual(a, b)

    def test_strict_boundary_and_reset(self):
        rows = s.monitor([1, 1, 1, 1], 0, 1, 'cusum', 1)
        self.assertEqual([r['status'] for r in rows], ['within', 'within', 'alarm', 'within'])
        self.assertEqual(rows[-1]['statistic'], .5)

    def test_invalid_resets_and_preserves_ticks(self):
        invalids = [None, float('nan'), float('inf'), -float('inf'), True, '1', 10**400]
        for method in s.METHODS:
            rows = s.monitor([2]+invalids+[2], 0, 1, method, 100)
            self.assertEqual([r['tick'] for r in rows], list(range(9)))
            self.assertTrue(all(r['status'] == 'invalid' for r in rows[1:-1]))
            self.assertEqual(rows[0]['statistic'], rows[-1]['statistic'])

    def test_no_detection_is_not_zero_delay(self):
        rows = s.monitor([0]*600, 0, 1, 'shewhart', 3)
        self.assertEqual(s.metrics(rows, True)['missed'], True)
        self.assertIsNone(s.metrics(rows, True)['delay'])
        self.assertIsNone(s.metrics(rows, False)['missed'])
        rows[205]['status'] = 'alarm'
        self.assertEqual(s.metrics(rows, True)['delay'], 5)

    def test_scenario_pairing_and_gap(self):
        noise = s.normal(30000, 600)
        up, down = s.scenario(noise, 'step_up'), s.scenario(noise, 'step_down')
        self.assertEqual(up[:200], noise[:200])
        self.assertAlmostEqual(up[200]-down[200], 2)
        ramp = s.scenario(noise, 'ramp_up')
        self.assertEqual(ramp[200], noise[200])
        self.assertAlmostEqual(ramp[399]-noise[399], 1)
        invalid = s.scenario(noise, 'step_up_invalid')
        self.assertTrue(all(x is None for x in invalid[190:210]))

    def test_calibration_first_pass_and_failure(self):
        self.assertEqual(s.calibrate([0]*20000, 0, 1, 'shewhart'), (2.5, 0))
        self.assertEqual(s.calibrate([100]*100, 0, 1, 'shewhart'), (None, None))

    def test_no_oracle_reset_at_onset(self):
        rows = s.monitor([0]*199+[1, 1, 1], 0, 1, 'cusum', 1)
        self.assertEqual(rows[201]['status'], 'alarm')

    def test_canonical_hash_and_determinism(self):
        self.assertEqual(s.normal(12, 10), s.normal(12, 10))
        self.assertEqual(s.digest([None, float('nan'), float('inf')]),
                         s.digest([None, float('nan'), float('inf')]))
        self.assertNotEqual(s.digest([None]), s.digest([0]))

    def test_run_separates_calibration_from_evaluation(self):
        seen = []
        def cal(values, center, scale, method):
            seen.append(list(values))
            return 3, 0
        with patch.dict(s.CONFIG, seeds=[0], reference_n=20, calibration_n=30), \
             patch.object(s, 'calibrate', side_effect=cal):
            result = s.run()
        self.assertEqual(len(seen), 3)
        self.assertTrue(all(x == s.normal(20000, 30) for x in seen))
        self.assertEqual(len(result['per_seed']), 21)
        self.assertTrue(all(r['reference_total'] == 20 and r['reference_valid'] == 20
                            and r['reference_invalid'] == 0 for r in result['calibration']))

    def test_persisted_invalid_reference_counts(self):
        original = s.normal
        def generated(seed, n):
            return [0, 2, None, float('nan')] if seed == 10000 else original(seed, n)
        with patch.dict(s.CONFIG, seeds=[0], reference_n=4, calibration_n=30), \
             patch.object(s, 'normal', side_effect=generated), \
             patch.object(s, 'calibrate', return_value=(3, 0)):
            result = s.run()
        self.assertTrue(all(r['reference_total'] == 4 and r['reference_valid'] == 2
                            and r['reference_invalid'] == 2 for r in result['calibration']))

    def test_unavailable_and_conditional_summary(self):
        base = dict(seed=0, scenario='step_up', method='cusum', available=True,
                    false_alarms=0, normal_valid=200, normal_ticks=200, total_ticks=600,
                    invalid=0, delay=None, missed=True)
        with patch.dict(s.CONFIG, seeds=[0, 1]):
            out = s.summarize([base, dict(base, seed=1, delay=5, missed=False)])
        row = next(r for r in out if r['scenario'] == 'step_up' and r['method'] == 'cusum')
        self.assertEqual(row['miss_fraction'], .5)
        self.assertEqual(row['delay_median'], 5)
        self.assertEqual(row['detected'], 1)
        with patch.dict(s.CONFIG, seeds=[0]):
            out = s.summarize([dict(base, available=False)])
        row = next(r for r in out if r['scenario'] == 'step_up' and r['method'] == 'cusum')
        self.assertEqual(row['unavailable_seeds'], 1)
        self.assertIsNone(row['miss_fraction'])


if __name__ == '__main__':
    unittest.main()
