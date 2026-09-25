import importlib.util
from pathlib import Path
import unittest
import numpy as np
import pandas as pd
s=importlib.util.spec_from_file_location('strengthening',Path(__file__).with_name('run.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class StrengtheningTest(unittest.TestCase):
    def test_clipping_bounds_do_not_learn_evaluation_values(self):
        c=m.TrainClip().fit(np.arange(100.).reshape(-1,1))
        before=(c.low_.copy(),c.high_.copy())
        np.testing.assert_allclose(c.transform([[-1e9],[1e9]]).ravel(),[.99,98.01])
        np.testing.assert_array_equal(c.low_,before[0]);np.testing.assert_array_equal(c.high_,before[1])

    def test_product_prior_shrinkage_and_unseen_product(self):
        model=m.ProductPrior().fit(pd.DataFrame({'PART_NAME':['a','a','b','b']}),[1,0,0,0])
        p=model.predict_proba(pd.DataFrame({'PART_NAME':['a','b','unseen']}))[:,1]
        np.testing.assert_allclose(p,[6/22,5/22,.25])

    def test_threshold_rejects_oversized_tied_alert_group(self):
        p=np.ones(20)*.5
        t=m.budget_threshold(np.r_[1,np.zeros(19)],p)
        self.assertGreater(t,.5);self.assertEqual(sum(p>=t),0)
        p=np.arange(20)/20
        self.assertLessEqual(sum(p>=m.budget_threshold(np.r_[np.zeros(19),1],p)),2)

    def test_sensor_only_model_ignores_product_and_inspection_reason(self):
        a=pd.DataFrame({'x':np.arange(20.),'PART_NAME':['a','b']*10,'Reason':['bad']*20})
        fitted=m.model('rf_no_product',['x']).fit(a,[0,1]*10)
        original=fitted.predict_proba(a)
        a.PART_NAME='unseen';a.Reason='changed'
        np.testing.assert_allclose(fitted.predict_proba(a),original)
        self.assertFalse(any('PART_NAME' in n for n in fitted.named_steps['preprocessing'].get_feature_names_out()))

    def test_imputation_precedes_clip_and_learns_training_only(self):
        a=pd.DataFrame({'x':[1.,2.,np.nan,4.,5.,6.],'PART_NAME':['a','b']*3})
        fitted=m.model('clipped_logistic',['x']).fit(a,[0,1]*3)
        numeric=fitted.named_steps['preprocessing'].named_transformers_['numeric']
        bounds=numeric.named_steps['clip'].high_.copy()
        later=a.copy();later.x=1e9
        self.assertTrue(np.isfinite(fitted.predict_proba(later)).all())
        np.testing.assert_array_equal(numeric.named_steps['clip'].high_,bounds)
        self.assertEqual(numeric.named_steps['imputer'].statistics_[0],4.)

    def test_original_artifact_hashes_unchanged(self):
        import json
        manifest=json.loads((Path(__file__).parent/'results/manifest.json').read_text())
        for path,digest in manifest['original_artifact_hashes'].items():
            p=Path(path)
            if p.is_absolute():
                p=Path('experiments')/str(p).split('/experiments/',1)[1]
            self.assertEqual(m.v1.digest(p),digest,str(p))

if __name__=='__main__':unittest.main()
