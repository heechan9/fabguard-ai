import unittest
from unittest.mock import patch, Mock
import numpy as np
import pandas as pd
from fabguard.advanced_evaluation import walk_forward_slices
from fabguard.advanced_experiment import score_temporal_fold
from fabguard.config import ExperimentConfig
from fabguard.modeling import Candidate

class TemporalReview(unittest.TestCase):
    def test_shared_tie_boundary(self):
        t=pd.to_datetime(['2020-01-%02d'%d for d in [1,2,3,4,5,6,8,8,9,10]])
        folds=walk_forward_slices(t,initial_train_fraction=.5,folds=2)
        self.assertEqual([b.tolist() for a,b in folds],[[5],[6,7,8,9]])
        self.assertFalse(set(folds[0][1]) & set(folds[1][1]))
        for a,b in folds: self.assertLess(t[a].max(),t[b].min())
    def test_unsorted(self):
        t=pd.date_range('2020-01-01',periods=20)[::-1]
        folds=walk_forward_slices(t,folds=3)
        ids=[]
        for a,b in folds:
            self.assertLess(t[a].max(),t[b].min());ids.extend(b)
        self.assertEqual(len(ids),len(set(ids)))
    def test_degenerate(self):
        for t in [[],[pd.NaT],pd.to_datetime(['2020-01-01']*10)]:
            with self.assertRaises(ValueError): walk_forward_slices(t)
    def test_selection_sees_only_prefix(self):
        fit=pd.DataFrame({'timestamp':pd.date_range('2020-01-01',periods=4),'feature_0':[1,2,3,4],'label':[0,1,0,1]})
        val=pd.DataFrame({'timestamp':pd.date_range('2020-02-01',periods=2),'feature_0':[99,98],'label':[1,0]})
        candidate=Candidate('dummy','dummy',{});pipe=Mock();pipe.predict_proba.return_value=np.array([[.2,.8],[.7,.3]])
        with patch('fabguard.advanced_experiment.selected_candidate',return_value=candidate) as select,patch('fabguard.advanced_experiment.build_pipeline',return_value=pipe):
            score_temporal_fold(fit,val,['feature_0'],ExperimentConfig())
            self.assertIs(select.call_args.args[0],fit)
            pd.testing.assert_frame_equal(pipe.fit.call_args.args[0],fit[['feature_0']])
            pd.testing.assert_frame_equal(pipe.predict_proba.call_args.args[0],val[['feature_0']])
            val.label=[0,1]
            score_temporal_fold(fit,val,['feature_0'],ExperimentConfig())
            self.assertIs(select.call_args.args[0],fit)
    def test_time_reversal_rejected_before_selection(self):
        f=pd.DataFrame({'timestamp':[pd.Timestamp('2020-01-01')]})
        with patch('fabguard.advanced_experiment.selected_candidate') as select:
            with self.assertRaises(ValueError): score_temporal_fold(f,f,[],ExperimentConfig())
            select.assert_not_called()
