import importlib.util
from pathlib import Path
import unittest
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score
s=importlib.util.spec_from_file_location('molding_study',Path(__file__).with_name('run.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class StudyTest(unittest.TestCase):
    def test_ap_and_tie_ranking(self):
        rng=np.random.default_rng(40)
        for _ in range(50):
            y=rng.integers(0,2,40);p=rng.integers(0,5,40)/5
            self.assertAlmostEqual(m.vector(y,p,np.arange(40))[0],average_precision_score(y,p))
        self.assertEqual(m.vector(np.array([1,0]),np.array([.5,.5]),np.array(['b','a']))[1],0)

    def test_no_failure_is_undefined(self):
        result=m.vector(np.zeros(10),np.arange(10),np.arange(10))
        self.assertTrue(np.isnan(result[[0,1,3]]).all());self.assertEqual(result[2],0)

    def test_group_overlap_rejected(self):
        a=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-01')],'group':['same'],'x':[1]})
        b=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-02')],'group':['same'],'x':[2]})
        with self.assertRaisesRegex(ValueError,'Group overlap'):m.check_separation(a,b,['x'])

    def test_repeated_sensors_across_times_rejected(self):
        a=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-01')],'group':['a'],'x':[1]})
        b=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-02')],'group':['b'],'x':[1]})
        with self.assertRaisesRegex(ValueError,'sensor vectors'):m.check_separation(a,b,['x'])

    def test_temporal_overlap_rejected(self):
        a=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-02')],'group':['a'],'x':[1]})
        b=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-01')],'group':['b'],'x':[2]})
        with self.assertRaisesRegex(ValueError,'Time overlap'):m.check_separation(a,b,['x'])

    def test_preprocessing_excludes_post_inspection_columns_and_fits_training_only(self):
        a=pd.DataFrame({'x':[1.,2.,3.,4.],'PART_NAME':['LH','RH','LH','RH'],'Reason':['a','b','c','d']})
        fitted=m.model('logistic',['x']).fit(a,[0,1,0,1])
        pre=fitted.named_steps['preprocessing'];before=pre.transform(a)
        a['Reason']=['secret']*4
        np.testing.assert_array_equal(pre.transform(a),before)
        imputer=pre.named_transformers_['numeric'].named_steps['imputer'];self.assertEqual(imputer.statistics_[0],2.5)
        later=a.copy();later.x=1e6;pre.transform(later);self.assertEqual(imputer.statistics_[0],2.5)

if __name__=='__main__':unittest.main()
