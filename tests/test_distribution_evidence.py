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
