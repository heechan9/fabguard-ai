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
    def check_runner(self, runner, forced_skip=None, score_error=None, mixed=False, config=None):
        from contextlib import ExitStack
        from pathlib import Path
        import tempfile
        import fabguard.advanced_experiment as module
        frame = pd.DataFrame({
            'sample_id': ['synthetic_%03d' % i for i in range(100)],
            'timestamp': pd.date_range('2020-01-01', periods=100),
            'feature_0': np.arange(100), 'label': [0, 1] * 50})
        if mixed:
            frame['label'] = [int(i in [0, 10, 20, 45, 55, 65, 75]) for i in range(100)]
        frame.attrs['hashes'] = {'synthetic': 'not-real-data'}
        train, holdout = frame.iloc[:80].copy(), frame.iloc[80:].copy()
        forbidden = set(holdout.sample_id)
        candidate = Candidate('synthetic_dummy', 'dummy', {})
        pipeline = Mock()
        pipeline.predict_proba.side_effect = lambda x: np.tile([.5, .5], (len(x), 1))
        seen = []
        def score(fit, validation, features, config):
            if score_error is not None:
                raise score_error
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
        if forced_skip is not None:
            replacements['temporal_fold_skip_reason'] = Mock(return_value=forced_skip)
        with ExitStack() as stack, tempfile.TemporaryDirectory() as tmp:
            for name, replacement in replacements.items():
                stack.enter_context(patch.object(module, name, replacement))
            if score_error is not None:
                with self.assertRaisesRegex(type(score_error), str(score_error)):
                    runner(config or ExperimentConfig(), output_dir=Path(tmp))
                self.assertEqual(list(Path(tmp).iterdir()), [])
                raise score_error
            manifest = runner(config or ExperimentConfig(), output_dir=Path(tmp))
            saved = pd.read_csv(Path(tmp) / 'walk_forward_metrics.csv')
            import json
            saved_manifest = json.loads((Path(tmp) / 'manifest.json').read_text())
            self.assertIs(type(saved_manifest['config']['cv_splits']), int)
        if mixed:
            self.assertEqual(len(seen), 2)
            self.assertEqual(saved['status'].tolist(), ['SKIPPED', 'SKIPPED', 'EVALUATED', 'EVALUATED'])
            self.assertEqual(manifest['walk_forward_skipped_folds'], 2)
            self.assertEqual(manifest['walk_forward_evaluated_folds'], 2)
            self.assertTrue(saved.loc[saved.status == 'SKIPPED', 'average_precision'].isna().all())
            self.assertEqual(saved.loc[saved.status == 'SKIPPED', 'skip_reason'].tolist(),
                             ['TRAIN_CLASS_SUPPORT_BELOW_CV_SPLITS'] * 2)
            return
        self.assertEqual(len(seen), 0 if forced_skip else 4)
        self.assertEqual(manifest['walk_forward_skipped_folds'], 4 if forced_skip else 0)
        self.assertEqual(manifest['walk_forward_evaluated_folds'], 0 if forced_skip else 4)
        if forced_skip:
            self.assertEqual(set(saved['status']), {'SKIPPED'})
            self.assertEqual(set(saved['skip_reason']), {forced_skip})
            self.assertNotIn('average_precision', saved.columns)
        self.assertEqual(manifest['walk_forward_scope'], 'original_training_period_only')
        self.assertEqual(manifest['walk_forward_selection'], 'each_fold_training_prefix_only')
        self.assertEqual(manifest['inner_selection_method'], 'repeated_stratified_cv_within_prefix')
        self.assertEqual(manifest['exposed_holdout_sections'],
                         ['calibration', 'inspection_cost', 'top_k_bootstrap', 'feature_drift'])

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


class OutputPreservationReview(unittest.TestCase):
    def test_existing_outputs_rejected_before_data_load(self):
        import tempfile
        from pathlib import Path
        from fabguard.advanced_experiment import run_advanced_experiment
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / 'archive'
            target.mkdir()
            evidence = target / 'saved.csv'
            evidence.write_bytes(b'synthetic original\n')
            with patch('fabguard.advanced_experiment.load_secom') as load:
                with self.assertRaisesRegex(ValueError, 'absent or empty'):
                    run_advanced_experiment(ExperimentConfig(), output_dir=target)
                load.assert_not_called()
                self.assertEqual(evidence.read_bytes(), b'synthetic original\n')
                with self.assertRaisesRegex(ValueError, 'absent or empty'):
                    run_advanced_experiment(ExperimentConfig(), output_dir=evidence)
                load.assert_not_called()


class TemporalSupportReview(unittest.TestCase):
    def test_sparse_class_support_reported(self):
        from fabguard.advanced_experiment import temporal_fold_skip_reason
        config=ExperimentConfig()
        val=pd.DataFrame({'label':[0,1]})
        for labels,expected in [([0]*10,'TRAIN_SINGLE_CLASS'),
                                ([0]*10+[1]*4,'TRAIN_CLASS_SUPPORT_BELOW_CV_SPLITS'),
                                ([0]*10+[1]*5,None)]:
            self.assertEqual(temporal_fold_skip_reason(pd.DataFrame({'label':labels}),val,config),expected)
        self.assertEqual(temporal_fold_skip_reason(pd.DataFrame({'label':[0,1]*5}),
                         pd.DataFrame({'label':[0,0]}),config),'VALIDATION_NO_FAIL')
    def test_invalid_cv_not_silently_skipped(self):
        from dataclasses import replace
        from fabguard.advanced_experiment import temporal_fold_skip_reason
        for value in [1,True,2.5]:
            with self.assertRaises(ValueError):
                temporal_fold_skip_reason(pd.DataFrame({'label':[0,1]*5}),
                    pd.DataFrame({'label':[0,1]}),replace(ExperimentConfig(),cv_splits=value))
    def test_skipped_windows_recorded_without_metrics(self):
        from fabguard.advanced_experiment import run_advanced_experiment
        RunnerScopeReview().check_runner(run_advanced_experiment,
                                        forced_skip='TRAIN_CLASS_SUPPORT_BELOW_CV_SPLITS')
    def test_fit_errors_not_caught_as_skips(self):
        fit=pd.DataFrame({'timestamp':pd.date_range('2020-01-01',periods=10),
                          'feature_0':range(10),'label':[0,1]*5})
        val=pd.DataFrame({'timestamp':[pd.Timestamp('2020-02-01')],
                          'feature_0':[11],'label':[1]})
        with patch('fabguard.advanced_experiment.selected_candidate',side_effect=RuntimeError('fit failure')):
            with self.assertRaisesRegex(RuntimeError,'fit failure'):
                score_temporal_fold(fit,val,['feature_0'],ExperimentConfig())

class CliOutputReview(unittest.TestCase):
    def test_missing_output_rejected_before_run(self):
        import contextlib,io
        from fabguard.advanced_experiment import main
        with patch('sys.argv',['fabguard-advanced']),patch('fabguard.advanced_experiment.run_advanced_experiment') as run,contextlib.redirect_stderr(io.StringIO()) as err:
            with self.assertRaises(SystemExit) as raised:main()
            self.assertEqual(raised.exception.code,2)
            self.assertIn('--output-dir',err.getvalue());run.assert_not_called()
    def test_explicit_output_forwarded(self):
        import contextlib,io
        from pathlib import Path
        from fabguard.advanced_experiment import main
        with patch('sys.argv',['fabguard-advanced','--output-dir','fresh-output']),patch('fabguard.advanced_experiment.run_advanced_experiment',return_value={}) as run,contextlib.redirect_stdout(io.StringIO()):
            main();self.assertEqual(run.call_args.kwargs['output_dir'],Path('fresh-output'))


class TemporalFollowupCoverage(unittest.TestCase):
    def test_runner_propagates_unexpected_score_error(self):
        from fabguard.advanced_experiment import run_advanced_experiment
        with self.assertRaisesRegex(RuntimeError,'synthetic unexpected fit failure'):
            RunnerScopeReview().check_runner(run_advanced_experiment,
                score_error=RuntimeError('synthetic unexpected fit failure'))
    def test_support_uses_configured_splits_and_reason_precedence(self):
        from dataclasses import replace
        from fabguard.advanced_experiment import temporal_fold_skip_reason
        config=replace(ExperimentConfig(),cv_splits=3)
        no_fail=pd.DataFrame({'label':[0,0]})
        for labels,expected in [([0]*8,'TRAIN_SINGLE_CLASS'),
                                ([0]*8+[1]*2,'TRAIN_CLASS_SUPPORT_BELOW_CV_SPLITS'),
                                ([0]*8+[1]*3,'VALIDATION_NO_FAIL')]:
            self.assertEqual(temporal_fold_skip_reason(pd.DataFrame({'label':labels}),
                             no_fail,config),expected)
        self.assertIsNone(temporal_fold_skip_reason(pd.DataFrame({'label':[0,1]*3}),
                          pd.DataFrame({'label':[0,1]}),config))


class LatestReviewCoverage(unittest.TestCase):
    def test_numpy_integral_cv_splits_supported(self):
        from dataclasses import replace
        from fabguard.advanced_experiment import temporal_fold_skip_reason
        for value in [np.int32(5), np.int64(5)]:
            self.assertIsNone(temporal_fold_skip_reason(pd.DataFrame({'label':[0,1]*5}),
                pd.DataFrame({'label':[0,1]}), replace(ExperimentConfig(), cv_splits=value)))
    def test_real_support_helper_mixed_windows(self):
        from fabguard.advanced_experiment import run_advanced_experiment
        RunnerScopeReview().check_runner(run_advanced_experiment, mixed=True)

    def test_numpy_split_count_manifest_is_json_number(self):
        from dataclasses import replace
        from fabguard.advanced_experiment import run_advanced_experiment
        RunnerScopeReview().check_runner(run_advanced_experiment,
            config=replace(ExperimentConfig(),cv_splits=np.int64(5)))
