"""Exploratory diagnostics and two fixed hypotheses; never replaces v1 outputs."""
import argparse, importlib.util, io, json, hashlib, subprocess, zipfile
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.metrics import average_precision_score, fbeta_score
SPEC=importlib.util.spec_from_file_location('molding_v1',Path(__file__).parents[1]/'run.py')
v1=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(v1)
ROOT=Path(__file__).parent
NAMES=['product_prior','logistic','rf','clipped_logistic','rf_no_product']

class TrainClip(BaseEstimator,TransformerMixin):
    def fit(self,X,y=None):
        self.low_=np.quantile(X,.01,axis=0);self.high_=np.quantile(X,.99,axis=0);return self
    def transform(self,X):return np.clip(X,self.low_,self.high_)
    def get_feature_names_out(self,input_features=None):return np.asarray(input_features,dtype=object)

class ProductPrior:
    def fit(self,X,y):
        self.prior_=float(np.mean(y));d=pd.DataFrame({'product':X.PART_NAME.to_numpy(),'y':np.asarray(y)});g=d.groupby('product').y.agg(['sum','count'])
        self.rates_=((g['sum']+20*self.prior_)/(g['count']+20)).to_dict();return self
    def predict_proba(self,X):
        p=X.PART_NAME.map(self.rates_).fillna(self.prior_).to_numpy();return np.column_stack([1-p,p])

def model(name,features):
    if name=='product_prior':return ProductPrior()
    m=v1.model('logistic' if name=='clipped_logistic' else 'rf' if name=='rf_no_product' else name,features)
    pre=m.named_steps['preprocessing']
    if name=='clipped_logistic':pre.transformers[0][1].steps.insert(-1,('clip',TrainClip()))
    if name=='rf_no_product':pre.transformers=pre.transformers[:1]
    return m

def budget_threshold(y,p):
    p=np.asarray(p);cap=int(np.ceil(.1*len(p)));levels=np.r_[np.unique(p),np.nextafter(p.max(),np.inf)]
    return float(max((t for t in levels if np.sum(p>=t)<=cap),key=lambda t:(fbeta_score(y,p>=t,beta=2),t)))

def rank_metrics(d,p,fraction=.1):
    r=v1.top_k_table(d._id,d.label,p,[fraction]).iloc[0].to_dict()
    r['ap']=average_precision_score(d.label,p) if d.label.sum() else np.nan
    if not d.label.sum():r.update(fail_capture_rate=np.nan,lift=np.nan)
    return r

def run(archive):
    if v1.digest(archive)!=v1.ZIP_HASH:raise ValueError('Wrong input hash')
    out=ROOT/'results';out.mkdir(exist_ok=True)
    protected={str(p):v1.digest(p) for folder in [v1.ROOT/'results',Path('results/v1'),Path('results/phase1')] for p in folder.rglob('*') if p.is_file()}
    with zipfile.ZipFile(archive) as z:d,features,audit=v1.prepare(pd.read_csv(io.BytesIO(z.read('dataset/labeled_data.csv'))))
    fit=d[d.day<'2020-10-29'];later=d[d.day>='2020-10-29'];v1.check_separation(fit,later,features)
    cv=[];thresholds={};fitted={}
    for name in NAMES:
        yy=[];pp=[]
        for day in ['2020-10-22','2020-10-23','2020-10-27']:
            a=fit[fit.day<day];b=fit[fit.day==day];v1.check_separation(a,b,features)
            m=model(name,features).fit(a,a.label);p=m.predict_proba(b)[:,1]
            cv.append(dict(candidate=name,day=day,**rank_metrics(b,p)));yy.extend(b.label);pp.extend(p)
        thresholds[name]=budget_threshold(yy,pp)
        fitted[name]=model(name,features).fit(fit,fit.label)
    cv=pd.DataFrame(cv);cv.to_csv(out/'development_cv.csv',index=False)
    ranking=cv.groupby('candidate')[['ap','fail_capture_rate']].mean().reset_index().sort_values(['ap','fail_capture_rate','candidate'],ascending=[False,False,True]);winner=ranking.iloc[0].candidate
    v1.write_json(out/'selection_before_prediction.json',dict(selected=winner,thresholds=thresholds,scope='development only; OOF alerts <=ceil10% constraint'))
    preds={name:m.predict_proba(later)[:,1] for name,m in fitted.items()}
    old=pd.read_csv(v1.ROOT/'results/threshold_metrics.csv').query("threshold_source=='fixed_0.5'").set_index('candidate')
    # Existing models are reproduced, not replaced. RF parallel summation can vary at machine precision.
    for name in ['rf','logistic']:
        assert abs(average_precision_score(later.label,preds[name])-old.loc[name,'pr_auc_average_precision'])<1e-12
    tops=[];threshold_rows=[];slices=[];daily=[];drop_day=[];ties=[];prob=[]
    for name,p in preds.items():
        for frac in [.05,.1,.2]:tops.append(dict(candidate=name,**rank_metrics(later,p,frac)))
        for kind,t in [('fixed_0.5',.5),('oof_10pct_cap',thresholds[name])]:threshold_rows.append(dict(candidate=name,policy=kind,**v1.classification_metrics(later.label,p,t)))
        prob.append(dict(candidate=name,split='later',min=float(p.min()),max=float(p.max()),unique_scores=len(np.unique(p)),fraction_ge_half=float(np.mean(p>=.5)),fraction_ge_0999=float(np.mean(p>=.999))))
        for scope in ['day','PART_NAME']:
            for val in sorted(later[scope].unique()):
                mask=(later[scope]==val).to_numpy();row=dict(candidate=name,scope=scope,value=val,n=int(mask.sum()),**rank_metrics(later[mask],p[mask]));slices.append(row)
                if scope=='day':daily.append(row)
        for day in sorted(later.day.unique()):
            mask=(later.day!=day).to_numpy();drop_day.append(dict(candidate=name,excluded_day=day,n=int(mask.sum()),**rank_metrics(later[mask],p[mask])))
        rng=np.random.default_rng(v1.SEED);captures=[];k=int(np.ceil(.1*len(later)));y=later.label.to_numpy()
        for _ in range(200):
            order=np.lexsort((rng.random(len(p)),-p));captures.append(int(y[order[:k]].sum()))
        ties.append(dict(candidate=name,replicates=200,k=k,captured_min=min(captures),captured_median=float(np.median(captures)),captured_max=max(captures)))
    daily_frame=pd.DataFrame(daily)
    totals=daily_frame.groupby('candidate')[['inspection_count','captured_fail','false_inspections','total_fail']].sum().reset_index()
    totals['capture']=totals.captured_fail/totals.total_fail;totals['precision']=totals.captured_fail/totals.inspection_count;totals['lift']=totals.precision/later.label.mean()
    tables={'top_k':tops,'thresholds':threshold_rows,'slices':slices,'daily_budget_detail':daily,'leave_one_day_out':drop_day,'tie_sensitivity':ties,'probability_diagnostics':prob}
    for file,rows in tables.items():pd.DataFrame(rows).to_csv(out/(file+'.csv'),index=False)
    totals.to_csv(out/'daily_budget_totals.csv',index=False)
    # Diagnostic only; no candidate settings depend on these held-out measurements.
    drift=[]
    for col in features:
        lo,hi=fit[col].min(),fit[col].max();drift.append(dict(feature=col,train_min=lo,train_max=hi,later_outside_training_fraction=float(((later[col]<lo)|(later[col]>hi)).mean())))
    pd.DataFrame(drift).to_csv(out/'feature_range_diagnostics.csv',index=False)
    linear=[]
    for name in ['logistic','clipped_logistic']:
        m=fitted[name];pre=m.named_steps['preprocessing'];names=pre.get_feature_names_out();coef=m.named_steps['model'].coef_[0]
        for split,frame in [('fit',fit),('later',later)]:
            transformed=pre.transform(frame);contribution=transformed*coef
            for j,feature in enumerate(names):linear.append(dict(candidate=name,split=split,feature=feature,mean_signed_logit=float(contribution[:,j].mean()),mean_absolute_logit=float(abs(contribution[:,j]).mean()),max_abs_transformed=float(abs(transformed[:,j]).max())))
    pd.DataFrame(linear).to_csv(out/'linear_diagnostics.csv',index=False)
    # Reuse original paired day cluster design; preserve whole days and group membership.
    groups=[np.flatnonzero(later.day.to_numpy()==day) for day in sorted(later.day.unique())];rng=np.random.default_rng(v1.SEED)
    y=later.label.to_numpy();ids=later._id.to_numpy();boot={n:[] for n in NAMES}
    for _ in range(2000):
        ix=np.concatenate([groups[i] for i in rng.integers(0,len(groups),len(groups))])
        for name,p in preds.items():boot[name].append(v1.vector(y[ix],p[ix],ids[ix]))
    intervals=[]
    for name in NAMES:
        a=np.asarray(boot[name]);point=v1.vector(y,preds[name],ids)
        for ref in ['rf','product_prior']:
            delta=a-np.asarray(boot[ref]);dp=point-v1.vector(y,preds[ref],ids)
            for j,metric in enumerate(['ap','top10_capture','top10_precision','top10_lift']):
                lo,hi=np.nanquantile(a[:,j],[.025,.975]);dl,dh=np.nanquantile(delta[:,j],[.025,.975])
                intervals.append(dict(candidate=name,reference=ref,metric=metric,point=point[j],low=lo,high=hi,delta=dp[j],delta_low=dl,delta_high=dh,valid=int(np.isfinite(a[:,j]).sum())))
    pd.DataFrame(intervals).to_csv(out/'paired_uncertainty.csv',index=False)
    assert protected=={p:v1.digest(p) for p in protected}
    v1.write_json(out/'manifest.json',dict(code_commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),zip_sha256=v1.ZIP_HASH,seed=v1.SEED,python=v1.platform.python_version(),sklearn=v1.sklearn.__version__,numpy=np.__version__,pandas=pd.__version__,original_artifact_hashes=protected,originals_unchanged=True,independent_validation=False,original_model_ap_reproduced=True,command='PYTHONPATH=src python experiments/molding-temporal-20260926/strengthening/run.py --archive AUTHORIZED_ZIP'))
    print('development selection:',winner);print(pd.DataFrame(tops).query('k_fraction==0.1').to_string(index=False));print(totals.to_string(index=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--archive',type=Path,required=True);run(parser.parse_args().archive)
