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

class RunnerScopeReview(unittest.TestCase):
    def check_runner(self, runner):
        from contextlib import ExitStack
        from pathlib import Path
        import tempfile
        import fabguard.advanced_experiment as module
        frame = pd.DataFrame({
            'sample_id': ['synthetic_%03d' % i for i in range(100)],
            'timestamp': pd.date_range('2020-01-01', periods=100),
            'feature_0': np.arange(100), 'label': [0, 1] * 50})
        frame.attrs['hashes'] = {'synthetic': 'not-real-data'}
        train, holdout = frame.iloc[:80].copy(), frame.iloc[80:].copy()
        forbidden = set(holdout.sample_id)
        candidate = Candidate('synthetic_dummy', 'dummy', {})
        pipeline = Mock()
        pipeline.predict_proba.side_effect = lambda x: np.tile([.5, .5], (len(x), 1))
        seen = []
        def score(fit, validation, features, config):
            self.assertFalse((set(fit.sample_id) | set(validation.sample_id)) & forbidden)
            seen.append((set(fit.sample_id), set(validation.sample_id)))
            return candidate, np.full(len(validation), .5)
        replacements = {
            'load_secom': Mock(return_value=frame),
            'time_holdout': Mock(return_value=(train, holdout)),
            'selected_candidate': Mock(return_value=candidate),
            'build_pipeline': Mock(return_value=pipeline),
            'prefit_calibrator': Mock(return_value=pipeline),
            'calibration_metrics': Mock(return_value={}),
            'inspection_cost_table': Mock(return_value=pd.DataFrame()),
            'bootstrap_top_k_interval': Mock(return_value=pd.DataFrame()),
            'drift_table': Mock(return_value=pd.DataFrame()),
            'score_temporal_fold': score,
        }
        with ExitStack() as stack, tempfile.TemporaryDirectory() as tmp:
            for name, replacement in replacements.items():
                stack.enter_context(patch.object(module, name, replacement))
            manifest = runner(ExperimentConfig(), output_dir=Path(tmp))
        self.assertEqual(len(seen), 4)
        self.assertEqual(manifest['walk_forward_scope'], 'original_training_period_only')
        self.assertEqual(manifest['walk_forward_selection'], 'each_fold_training_prefix_only')

    def test_runner_excludes_holdout_from_walk_forward(self):
        from fabguard.advanced_experiment import run_advanced_experiment
        self.check_runner(run_advanced_experiment)

    def test_guard_detects_whole_frame_regression(self):
        import inspect
        import fabguard.advanced_experiment as module
        source = inspect.getsource(module.run_advanced_experiment)
        self.assertIn('ordered = train.sort_values', source)
        # Compile one deliberate regression only in memory; production source stays unchanged.
        namespace = dict(module.__dict__)
        exec(compile(source.replace('ordered = train.sort_values',
                                    'ordered = frame.sort_values'), '<synthetic-regression>', 'exec'),
             module.__dict__, namespace)
        with self.assertRaises(AssertionError):
            self.check_runner(namespace['run_advanced_experiment'])
