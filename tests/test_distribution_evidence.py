import unittest
import pandas as pd
from fabguard.distribution_evidence import select_training, group_summary


class DistributionEvidenceTest(unittest.TestCase):
    def frame(self):
        return pd.DataFrame({'sample_id':['a','b','c','d','test'],
            'timestamp':pd.date_range('2020-01-01',periods=5), 'label':[0,0,1,1,1],
            'x':[1.,3.,5.,None,999.]})

    def test_test_values_and_labels_do_not_change_evidence(self):
        frame=self.frame(); manifest=frame.iloc[:4][['sample_id','timestamp','label']].copy()
        original=group_summary(select_training(frame,manifest),'x')
        frame.loc[4,['label','x']]=[-999,-1e20]
        self.assertEqual(original,group_summary(select_training(frame,manifest),'x'))
        self.assertEqual(original['groups']['fail']['missing_rate'],.5)
        self.assertIsNone(original['standardized_mean_difference'])

    def test_sign_sample_variance_and_standardization(self):
        frame=self.frame().iloc[:4].copy(); frame.loc[3,'x']=7.
        result=group_summary(frame,'x')
        self.assertAlmostEqual(result['mean_difference'],4.)
        self.assertAlmostEqual(result['standardized_mean_difference'],4/(2**.5))
        self.assertEqual(result['groups']['pass']['n_observed'],2)

    def test_all_missing_and_zero_variance_are_null(self):
        frame=self.frame().iloc[:4].copy();frame['x']=None
        self.assertIsNone(group_summary(frame,'x')['mean_difference'])
        frame['x']=1.
        self.assertEqual(group_summary(frame,'x')['standardized_difference_unavailable_reason'],'zero_pooled_variance')

    def test_manifest_mismatch_and_duplicates_are_rejected(self):
        frame=self.frame();manifest=frame.iloc[:4][['sample_id','timestamp','label']].copy()
        manifest.loc[0,'label']=1
        with self.assertRaisesRegex(ValueError,'labels differ'):select_training(frame,manifest)
        with self.assertRaisesRegex(ValueError,'duplicate'):select_training(frame,pd.concat([manifest,manifest]))

    def test_nonfinite_values_are_not_silently_dropped(self):
        frame=self.frame();frame.loc[0,'x']=float('inf')
        with self.assertRaisesRegex(ValueError,'nonfinite'):group_summary(frame,'x')


class MaximumSensitivityTest(unittest.TestCase):
    def test_group_specific_maximum_no_mutation_and_ties(self):
        from fabguard.distribution_evidence import maximum_sensitivity
        frame = pd.DataFrame({'sample_id': ['a', 'b', 'c', 'd', 'e'],
                              'label': [0, 0, 1, 1, 1],
                              'x': [100., 2., 40., 40., None]}, index=[0]*5)
        original = frame.copy(deep=True)
        result = maximum_sensitivity(frame, 'x')
        pd.testing.assert_frame_equal(frame, original)
        p, f = result['leave_one_group_maximum_out']
        self.assertEqual(p['excluded_value'], 100.)
        self.assertEqual(f['excluded_value'], 40.)
        self.assertEqual(f['excluded_sample_id'], 'c')
        self.assertEqual(f['maximum_tie_count'], 2)
        self.assertEqual(f['summary']['groups']['fail']['n_total'], 2)
        self.assertEqual(f['summary']['groups']['fail']['n_observed'], 1)
        self.assertAlmostEqual(f['summary']['mean_difference'], -11.)
        self.assertFalse(result['deletion_recommended'])

    def test_missing_singleton_and_nonfinite(self):
        from fabguard.distribution_evidence import maximum_sensitivity
        frame = pd.DataFrame({'sample_id': ['a', 'b'], 'label': [0, 1], 'x': [None, 3.]})
        result = maximum_sensitivity(frame, 'x')
        self.assertFalse(result['leave_one_group_maximum_out'][0]['available'])
        self.assertIsNone(result['leave_one_group_maximum_out'][1]['summary']['mean_difference'])
        frame.loc[0, 'x'] = float('inf')
        with self.assertRaisesRegex(ValueError, 'nonfinite'):
            maximum_sensitivity(frame, 'x')

    def test_test_rows_cannot_change_selected_sensitivity(self):
        from fabguard.distribution_evidence import maximum_sensitivity
        frame = DistributionEvidenceTest().frame()
        manifest = frame.iloc[:4][['sample_id', 'timestamp', 'label']].copy()
        before = maximum_sensitivity(select_training(frame, manifest), 'x')
        frame.loc[4, ['label', 'x']] = [0, 1e30]
        self.assertEqual(before, maximum_sensitivity(select_training(frame, manifest), 'x'))

    def test_saved_sensitivity_matches_baseline_and_one_row_arithmetic(self):
        import json
        from pathlib import Path
        root = Path(__file__).resolve().parents[1] / 'docs/review/session5-20261030'
        baseline = next(x for x in json.loads((root/'summary.json').read_text())['features']
                        if x['feature'] == 'feature_475')
        saved = json.loads((root/'feature_475_sensitivity.json').read_text())
        self.assertEqual(saved['baseline'], baseline)
        for scenario in saved['leave_one_group_maximum_out']:
            group = scenario['group']
            old = baseline['groups'][group]
            new = scenario['summary']['groups'][group]
            self.assertEqual(new['n_observed'], old['n_observed'] - 1)
            self.assertEqual(new['n_missing'], old['n_missing'])
            self.assertAlmostEqual(new['mean'],
                (old['mean'] * old['n_observed'] - scenario['excluded_value']) / new['n_observed'])
        self.assertAlmostEqual(saved['leave_one_group_maximum_out'][0]['excluded_value'], 39.3528)
        self.assertAlmostEqual(saved['leave_one_group_maximum_out'][1]['excluded_value'], 38.2143)
