"""Check ranking definitions, chronological separation and frozen output integrity."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score
SPEC=importlib.util.spec_from_file_location('study',Path(__file__).with_name('run.py'))
M=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(M)

class StudyTests(unittest.TestCase):
    def test_ap_ties_match_reference(self):
        rng=np.random.default_rng(10)
        for _ in range(100):
            y=rng.integers(0,2,40); p=rng.integers(0,5,40)/5
            self.assertAlmostEqual(M.scores(y,p,np.arange(40))[0],average_precision_score(y,p))

    def test_same_timestamp_stays_on_one_side(self):
        f=pd.DataFrame({'timestamp':pd.to_datetime(np.repeat(pd.date_range('2020-01-01',periods=5),4))})
        for a,b in M.windows(f):
            self.assertLess(f.iloc[a-1].timestamp,f.iloc[a].timestamp)
            self.assertGreater(b,a)

    def test_unusable_timestamp_groups_fail_closed(self):
        f=pd.DataFrame({'timestamp':pd.to_datetime(['2020-01-01']*12)})
        with self.assertRaises(AssertionError): list(M.windows(f))

    def test_predictions_match_persisted_v1(self):
        p=pd.read_csv(M.OUT/'predictions.csv')
        M.baseline_guard(p,{name:p[name].to_numpy() for name in M.NAMES})

    def test_feature_selector_fits_inside_pipeline(self):
        model=M.pipeline('h2_rf_f40')
        self.assertEqual([n for n,_ in model.steps],['quality','imputer','selection','model'])
        self.assertFalse(hasattr(model.named_steps['selection'],'scores_'))

if __name__=='__main__': unittest.main()
