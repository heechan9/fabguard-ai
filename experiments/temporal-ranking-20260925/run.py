"""Frozen, exploratory experiment. Run from repository root with PYTHONPATH=src."""
from pathlib import Path
import hashlib, json, platform, subprocess
import numpy as np
import pandas as pd
import sklearn
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, fbeta_score
from fabguard.config import ExperimentConfig
from fabguard.data import load_secom, time_holdout
from fabguard.modeling import candidates, build_pipeline
from fabguard.evaluation import classification_metrics, top_k_table

OUT = Path(__file__).parent / 'results'
CFG = ExperimentConfig()
NAMES = ['dummy_prior', 'l1_logistic_c_0.01', 'random_forest_depth_none_leaf_8', 'h1_l2_c_0.1', 'h2_rf_f40']
RF = NAMES[2]

def pipeline(name):
    base = NAMES[1] if name == NAMES[3] else RF if name == NAMES[4] else name
    model = build_pipeline(next(c for c in candidates(CFG) if c.name == base), CFG)
    if name == NAMES[3]:
        model.steps[-1] = ('model', LogisticRegression(C=.1, penalty='l2', solver='liblinear', class_weight='balanced', max_iter=3000, random_state=CFG.random_seed))
    if name == NAMES[4]:
        model.steps.insert(-1, ('selection', SelectKBest(f_classif, k=40)))
    return model

def windows(frame):
    n = len(frame)
    bounds = [n//2, 2*n//3, 5*n//6, n]
    for i in range(3):
        while bounds[i] and frame.iloc[bounds[i]-1].timestamp == frame.iloc[bounds[i]].timestamp:
            bounds[i] -= 1
    for a,b in zip(bounds, bounds[1:]):
        assert frame.iloc[a-1].timestamp < frame.iloc[a].timestamp
        yield a,b

def scores(y, p, ids):
    # Group equal scores for AP; score desc / ID asc for budget selection.
    order = np.lexsort((ids, -p))
    yy, pp = y[order], p[order]
    cumulative = np.cumsum(yy)
    ends = np.r_[np.flatnonzero(np.diff(pp)), len(pp)-1]
    ap = np.sum(np.diff(np.r_[0,cumulative[ends]]) * cumulative[ends]/(ends+1)) / y.sum() if y.sum() else np.nan
    k = int(np.ceil(len(y)*.1)); found = yy[:k].sum()
    return np.array([ap, found/y.sum() if y.sum() else np.nan, found/k, (found/k)/y.mean() if y.sum() else np.nan])

def baseline_guard(test, predictions):
    saved = pd.read_csv('results/v1/test_metrics.csv').set_index('candidate')
    for name in NAMES[:3]:
        assert abs(average_precision_score(test.label, predictions[name])-saved.loc[name,'pr_auc_average_precision']) < 1e-12, name
    canonical = pd.read_csv('results/v1/priority_table.csv').set_index('sample_id')
    assert np.allclose(predictions[RF], canonical.loc[test.sample_id, 'risk_score'], rtol=0, atol=1e-12)

def main():
    OUT.mkdir(exist_ok=True)
    originals = {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for d in ['results/v1','results/phase1'] for p in Path(d).rglob('*') if p.is_file()}
    frame = load_secom(Path('data/raw')); train,test = time_holdout(frame)
    assert (len(train),len(test)) == (1175,392)
    for part, data in [('train',train),('test',test)]:
        assert data.sample_id.tolist() == pd.read_csv(f'results/v1/{part}_split.csv').sample_id.tolist()
    features = [c for c in frame if c.startswith('feature_')]
    rows=[]; thresholds={}; fitted={}
    for name in NAMES:
        oof_y=[]; oof_p=[]
        for fold,(a,b) in enumerate(windows(train),1):
            fit, val = train.iloc[:a],train.iloc[a:b]
            m=pipeline(name).fit(fit[features],fit.label)
            p=m.predict_proba(val[features])[:,1]
            top=top_k_table(val.sample_id,val.label,p,[.1]).iloc[0].to_dict()
            rows.append(dict(candidate=name,fold=fold,train_n=a,val_n=b-a,val_fail=int(val.label.sum()),train_end=str(fit.timestamp.max()),val_start=str(val.timestamp.min()),val_end=str(val.timestamp.max()),ap=average_precision_score(val.label,p),**top))
            oof_y.extend(val.label); oof_p.extend(p)
        thresholds[name]=float(max(np.unique(oof_p),key=lambda t:(fbeta_score(oof_y,np.array(oof_p)>=t,beta=2),t)))
        fitted[name]=pipeline(name).fit(train[features],train.label)
    cv=pd.DataFrame(rows); cv.to_csv(OUT/'train_temporal_cv.csv',index=False)
    ranked=cv.groupby('candidate')[['ap','fail_capture_rate']].mean().reset_index()
    winner=ranked[ranked.candidate != 'dummy_prior'].sort_values(['ap','fail_capture_rate','candidate'],ascending=[False,False,True]).iloc[0].candidate
    selection=dict(selected=winner,thresholds=thresholds,rule='train temporal mean AP, then capture; holdout excluded',exploratory=True)
    # Write selection before requesting any held-out predictions.
    (OUT/'selection_before_holdout.json').write_text(json.dumps(selection,indent=2))
    predictions={name:m.predict_proba(test[features])[:,1] for name,m in fitted.items()}
    baseline_guard(test,predictions)
    pred=test[['sample_id','timestamp','label']].copy()
    metrics=[]; tops=[]; periods=[]
    for name,p in predictions.items():
        pred[name]=p
        for label,t in [('fixed_0.5',.5),('train_oof_f2',thresholds[name])]:
            metrics.append(dict(candidate=name,threshold_source=label,**classification_metrics(test.label,p,t)))
        top=top_k_table(test.sample_id,test.label,p,[.05,.1,.2]); top.insert(0,'candidate',name)
        top['random_expected_captured']=top.inspection_count*test.label.mean(); tops.append(top)
        for i,idx in enumerate(np.array_split(np.arange(len(test)),4),1):
            sub=test.iloc[idx]; tk=top_k_table(sub.sample_id,sub.label,p[idx],[.1]).iloc[0].to_dict()
            periods.append(dict(candidate=name,period=i,start=str(sub.timestamp.min()),end=str(sub.timestamp.max()),n=len(idx),fail=int(sub.label.sum()),ap=average_precision_score(sub.label,p[idx]),**tk))
    pred.to_csv(OUT/'predictions.csv',index=False)
    pd.DataFrame(metrics).to_csv(OUT/'threshold_metrics.csv',index=False)
    pd.concat(tops).to_csv(OUT/'top_k.csv',index=False)
    pd.DataFrame(periods).to_csv(OUT/'temporal_variability.csv',index=False)
    y=test.label.to_numpy(); ids=test.sample_id.to_numpy(); n=len(y); intervals=[]
    for block in [20,10,40]:
        rng=np.random.default_rng(CFG.random_seed)
        boot={name:[] for name in NAMES}
        for _ in range(2000):
            starts=rng.integers(0,n,int(np.ceil(n/block)))
            idx=((starts[:,None]+np.arange(block))%n).ravel()[:n]
            for name in NAMES: boot[name].append(scores(y[idx],predictions[name][idx],ids[idx]))
        ref=np.asarray(boot[RF])
        for name in NAMES:
            values=np.asarray(boot[name]); point=scores(y,predictions[name],ids)
            delta=values-ref; dp=point-scores(y,predictions[RF],ids)
            for j,metric in enumerate(['ap','top10_capture','top10_precision','top10_lift']):
                lo,hi=np.nanquantile(values[:,j],[.025,.975]); dl,dh=np.nanquantile(delta[:,j],[.025,.975])
                intervals.append(dict(candidate=name,block_length=block,metric=metric,point=point[j],low=lo,high=hi,delta_vs_rf=dp[j],delta_low=dl,delta_high=dh,valid_replicates=int(np.isfinite(values[:,j]).sum())))
    pd.DataFrame(intervals).to_csv(OUT/'bootstrap.csv',index=False)
    assert originals == {p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in originals}
    manifest=dict(base='627542999ef229a89b2c4cb592ae2a03e41bade0',code_commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),seed=CFG.random_seed,python=platform.python_version(),numpy=np.__version__,pandas=pd.__version__,sklearn=sklearn.__version__,raw_hashes=frame.attrs['hashes'],canonical_hashes=originals,baseline_reproduced=True,independent_validation=False,command='PYTHONPATH=src python experiments/temporal-ranking-20260925/run.py')
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps(selection,indent=2)); print(pd.concat(tops).to_string(index=False))

if __name__ == '__main__': main()
