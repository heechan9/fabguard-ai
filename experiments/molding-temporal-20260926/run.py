"""KAMP-only exploratory study; canonical SECOM artifacts remain read-only."""
import argparse, hashlib, json, platform, subprocess, zipfile
from pathlib import Path
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import average_precision_score, fbeta_score
from fabguard.preprocessing import TrainColumnFilter
from fabguard.evaluation import classification_metrics, top_k_table

SEED=20260926
NAMES=['dummy','logistic','rf']
ZIP_HASH='f35b9cc904aaa57daf0feb0fb2462f7b7ba740ded8effa6ec61b6b7678496421'
ROOT=Path(__file__).parent

def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write_json(path,value): path.write_text(json.dumps(value,indent=2,ensure_ascii=False,default=str)+'\n')

def prepare(frame):
    original=len(frame); frame=frame.drop_duplicates().copy()
    if frame._id.duplicated().any(): raise ValueError('Conflicting records for same ID')
    if not frame.PassOrFail.isin(['Y','N']).all(): raise ValueError('Unknown labels')
    scope=(frame.EQUIP_CD=='S14') & frame.PART_NAME.isin(["CN7 W/S SIDE MLD'G LH","CN7 W/S SIDE MLD'G RH","RG3 MOLD'G W/SHLD, LH","RG3 MOLD'G W/SHLD, RH"])
    excluded=int((~scope).sum()); frame=frame[scope].copy()
    frame['timestamp']=pd.to_datetime(frame.TimeStamp,errors='raise')
    frame['day']=frame.timestamp.dt.strftime('%Y-%m-%d')
    frame['label']=frame.PassOrFail.map({'Y':0,'N':1})
    frame['group']=frame.EQUIP_CD+'|'+frame.TimeStamp
    numeric=[c for c in frame.columns if c.startswith(('Injection_','Filling_','Plasticizing_','Cycle_','Clamp_','Cushion_','Switch_','Max_','Average_','Barrel_','Hopper_','Mold_'))]
    if len(numeric)!=36: raise ValueError('Unexpected input schema')
    if not np.isfinite(frame[numeric].to_numpy(dtype=float)[~frame[numeric].isna().to_numpy()]).all(): raise ValueError('Infinite measurement')
    frame=frame.sort_values(['timestamp','_id']).reset_index(drop=True)
    return frame,numeric,dict(original_rows=original,exact_duplicates_removed=original-len(frame)-excluded,excluded_other_equipment_rows=excluded,rows=len(frame),fail=int(frame.label.sum()),sensor_columns=numeric,timezone='unspecified',mixed_label_groups=int((frame.groupby('group').label.nunique()>1).sum()))

def check_separation(fit,val,numeric):
    if fit.timestamp.max()>=val.timestamp.min(): raise ValueError('Time overlap')
    if set(fit.group)&set(val.group): raise ValueError('Group overlap')
    a=set(pd.util.hash_pandas_object(fit[numeric],index=False)); b=set(pd.util.hash_pandas_object(val[numeric],index=False))
    if a&b: raise ValueError('Identical sensor vectors cross split')

def model(name,numeric):
    steps=[('quality',TrainColumnFilter(.5)),('imputer',SimpleImputer(strategy='median',add_indicator=True))]
    if name=='logistic': steps.append(('scaler',StandardScaler()))
    pre=ColumnTransformer([('numeric',Pipeline(steps),numeric),('product',OneHotEncoder(handle_unknown='ignore',sparse_output=False),['PART_NAME'])],sparse_threshold=0)
    estimator={'dummy':lambda:DummyClassifier(strategy='prior'), 'logistic':lambda:LogisticRegression(C=.1,solver='liblinear',class_weight='balanced',max_iter=3000,random_state=SEED), 'rf':lambda:RandomForestClassifier(n_estimators=120,min_samples_leaf=8,max_features='sqrt',class_weight='balanced_subsample',random_state=SEED,n_jobs=-1)}[name]()
    return Pipeline([('preprocessing',pre),('model',estimator)])

def vector(y,p,ids):
    order=np.lexsort((ids,-p)); ys=y[order]; ps=p[order]; cum=np.cumsum(ys); ends=np.r_[np.flatnonzero(np.diff(ps)),len(y)-1]
    ap=np.sum(np.diff(np.r_[0,cum[ends]])*cum[ends]/(ends+1))/y.sum() if y.sum() else np.nan
    k=int(np.ceil(.1*len(y))); tp=ys[:k].sum(); precision=tp/k
    return np.array([ap,tp/y.sum() if y.sum() else np.nan,precision,precision/y.mean() if y.sum() else np.nan])

def run(archive):
    if digest(archive)!=ZIP_HASH: raise ValueError('Input archive hash mismatch')
    out=ROOT/'results'; out.mkdir(exist_ok=True)
    canonical={str(p):digest(p) for d in ['results/v1','results/phase1'] for p in Path(d).rglob('*') if p.is_file()}
    with zipfile.ZipFile(archive) as z:
        raw=z.read('dataset/labeled_data.csv')
        import io
        frame,numeric,audit=prepare(pd.read_csv(io.BytesIO(raw)))
    audit['csv_sha256']=hashlib.sha256(raw).hexdigest()
    fit=frame[frame.day<'2020-10-29']; test=frame[frame.day>='2020-10-29']
    check_separation(fit,test,numeric)
    audit['split']={name:dict(rows=len(d),fail=int(d.label.sum()),groups=d.group.nunique(),start=str(d.timestamp.min()),end=str(d.timestamp.max()),id_order_sha256=hashlib.sha256('\n'.join(d._id).encode()).hexdigest()) for name,d in [('development',fit),('later',test)]}
    write_json(out/'audit.json',audit)
    cv=[]; thresholds={}; selected_models={}
    for name in NAMES:
        yy=[]; pp=[]
        for day in ['2020-10-22','2020-10-23','2020-10-27']:
            a=fit[fit.day<day]; b=fit[fit.day==day]; check_separation(a,b,numeric)
            m=model(name,numeric).fit(a,a.label); p=m.predict_proba(b)[:,1]
            tk=top_k_table(b._id,b.label,p,[.1]).iloc[0].to_dict()
            cv.append(dict(candidate=name,validation_day=day,train_n=len(a),val_n=len(b),fail=int(b.label.sum()),ap=average_precision_score(b.label,p),**tk)); yy.extend(b.label);pp.extend(p)
        thresholds[name]=float(max(np.unique(pp),key=lambda t:(fbeta_score(yy,np.asarray(pp)>=t,beta=2),t)))
        selected_models[name]=model(name,numeric).fit(fit,fit.label)
    cv=pd.DataFrame(cv);cv.to_csv(out/'train_cv.csv',index=False)
    ranking=cv.groupby('candidate')[['ap','fail_capture_rate']].mean().reset_index()
    winner=ranking[ranking.candidate!='dummy'].sort_values(['ap','fail_capture_rate','candidate'],ascending=[False,False,True]).iloc[0].candidate
    write_json(out/'selection_before_later_prediction.json',dict(selected=winner,thresholds=thresholds,selection_scope='development chronological CV only'))
    predictions={n:m.predict_proba(test)[:,1] for n,m in selected_models.items()}
    metrics=[]; tops=[]; slices=[]
    for name,p in predictions.items():
        for source,t in [('fixed_0.5',.5),('development_oof_f2',thresholds[name])]:metrics.append(dict(candidate=name,threshold_source=source,**classification_metrics(test.label,p,t)))
        tk=top_k_table(test._id,test.label,p,[.05,.1,.2]);tk.insert(0,'candidate',name);tk['random_expected_captured']=tk.inspection_count*test.label.mean();tops.append(tk)
        for scope in ['day','PART_NAME']:
            for value in sorted(test[scope].unique()):
                mask=(test[scope]==value).to_numpy();d=test[mask];v=vector(d.label.to_numpy(),p[mask],d._id.to_numpy())
                slices.append(dict(candidate=name,scope=scope,value=value,n=len(d),fail=int(d.label.sum()),ap=v[0],top10_capture=v[1],top10_precision=v[2],top10_lift=v[3]))
    pd.DataFrame(metrics).to_csv(out/'threshold_metrics.csv',index=False);pd.concat(tops).to_csv(out/'top_k.csv',index=False);pd.DataFrame(slices).to_csv(out/'slices.csv',index=False)
    y=test.label.to_numpy(); ids=test._id.to_numpy(); days=test.day.to_numpy(); groups=[np.flatnonzero(days==d) for d in sorted(set(days))];rng=np.random.default_rng(SEED);boot={n:[] for n in NAMES}
    for _ in range(2000):
        ix=np.concatenate([groups[i] for i in rng.integers(0,len(groups),len(groups))])
        for name,p in predictions.items():boot[name].append(vector(y[ix],p[ix],ids[ix]))
    rows=[];base=np.asarray(boot['dummy']);basepoint=vector(y,predictions['dummy'],ids)
    for name in NAMES:
        b=np.asarray(boot[name]);point=vector(y,predictions[name],ids)
        for j,metric in enumerate(['ap','top10_capture','top10_precision','top10_lift']):
            lo,hi=np.nanquantile(b[:,j],[.025,.975]);dl,dh=np.nanquantile((b-base)[:,j],[.025,.975]);rows.append(dict(candidate=name,metric=metric,point=point[j],low=lo,high=hi,delta_dummy=point[j]-basepoint[j],delta_low=dl,delta_high=dh,valid_replicates=int(np.isfinite(b[:,j]).sum())))
    pd.DataFrame(rows).to_csv(out/'uncertainty.csv',index=False)
    assert canonical=={p:digest(p) for p in canonical}
    write_json(out/'manifest.json',dict(base='4e969ce40072a0ee5c47ac51487444b64c1fb00d',code_commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),zip_sha256=ZIP_HASH,seed=SEED,python=platform.python_version(),sklearn=sklearn.__version__,numpy=np.__version__,pandas=pd.__version__,independent_validation=False,canonical_unchanged=True,canonical_hashes=canonical,prediction_hashes={n:hashlib.sha256(p.astype('<f8').tobytes()).hexdigest() for n,p in predictions.items()},bootstrap='2000 paired day-cluster samples; zero-failure AP/capture/lift NA',command='PYTHONPATH=src python experiments/molding-temporal-20260926/run.py --archive PATH_TO_AUTHORIZED_ZIP'))
    print('Selected:',winner);print(pd.concat(tops).to_string(index=False));print(pd.DataFrame(metrics).to_string(index=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--archive',type=Path,required=True);run(parser.parse_args().archive)
