"""Build frozen-feature, train-only descriptions. No model fit or test scoring."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from fabguard.data import load_secom
from fabguard.distribution_evidence import select_training, group_summary

ROOT=Path(__file__).resolve().parents[1]
FEATURES=['feature_059','feature_247','feature_519','feature_065','feature_475']
PINNED_INPUTS={'results/v1/train_split.csv': 'd47b5254102519050844e21f0076537644d45dfe7262d596ad5c7887e6e81aec', 'results/v1/final_model_importance.csv': '844cdc475f21263b26f6078617e3bce7613aba7432979c7424b80d0b18accb4e'}


def build(data_dir, output):
    hashes={}
    for name, expected in PINNED_INPUTS.items():
        p=ROOT/name; hashes[name]=hashlib.sha256(p.read_bytes()).hexdigest()
        if hashes[name]!=expected:raise ValueError('frozen explanation input changed: '+name)
    ranking=pd.read_csv(ROOT/'results/v1/final_model_importance.csv')
    if ranking.feature.head(5).tolist()!=FEATURES:raise ValueError('frozen feature order changed')
    manifest=pd.read_csv(ROOT/'results/v1/train_split.csv')
    full=load_secom(data_dir)
    source_hashes=full.attrs['hashes']
    train=select_training(full,manifest)
    if len(train)!=1175:raise ValueError('frozen training denominator changed')
    del full  # No test distributions or scores are calculated.
    output.mkdir(parents=True,exist_ok=True)
    report={'scope':'reused_training_data_descriptive_only', 'feature_order':FEATURES,
            'train_n':len(train), 'train_pass':int((train.label==0).sum()),'train_fail':int((train.label==1).sum()),
            'train_start':str(train.timestamp.min()),'train_end':str(train.timestamp.max()),
            'test_statistics_computed':False,'model_fit':False,'performance_changed':False,
            'source_sha256':source_hashes,'frozen_input_sha256':hashes,
            'seed':None,'seed_reason':'no_stochastic_algorithm',
            'environment':{'python':platform.python_version(),'pandas':pd.__version__,'numpy':np.__version__,'matplotlib':matplotlib.__version__},
            'features':[group_summary(train,f) for f in FEATURES]}
    (output/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    rows=[]
    for r in report['features']:
        for group,g in r['groups'].items():
            rows.append({'feature':r['feature'],'group':group,**{k:v for k,v in g.items() if k!='quantiles'},
                         'fail_minus_pass_mean_difference':r['mean_difference'],
                         'standardized_difference':r['standardized_mean_difference']})
    pd.DataFrame(rows).to_csv(output/'group_summary.csv',index=False)
    months=[]
    for month,sub in train.groupby(train.timestamp.dt.strftime('%Y-%m')):
        for feature in FEATURES:
            r=group_summary(sub,feature)
            for group,g in r['groups'].items():
                months.append({'month':month,'feature':feature,'group':group,**{k:v for k,v in g.items() if k!='quantiles'},'fail_minus_pass_mean_difference':r['mean_difference']})
    pd.DataFrame(months).to_csv(output/'monthly_summary.csv',index=False)
    plt.rcParams.update({'svg.fonttype':'none','svg.hashsalt':'fabguard-session5','font.size':9,'axes.spines.top':False,'axes.spines.right':False})
    for feature in FEATURES:
        fig,axes=plt.subplots(1,2,figsize=(9,3.2))
        observed=[train.loc[train.label==label,feature].dropna().to_numpy() for label in [0,1]]
        joined=np.concatenate(observed)
        if not len(joined):raise ValueError('no observed data for plot')
        bins=np.histogram_bin_edges(joined,bins=16)
        for values,label,color in zip(observed,['Pass','Fail'],['#176a91','#d58a31']):
            if len(values):axes[0].hist(values,bins=bins,density=True,histtype='step',linewidth=1.7,label=f'{label}: observed n={len(values)}',color=color)
        axes[0].set(xlabel='Anonymous measured value (physical unit unknown)',ylabel='Density',title='Observed distributions; same bins')
        axes[0].legend(fontsize=8)
        axes[1].boxplot(observed,showfliers=True)
        axes[1].set_xticks([1,2],['Pass','Fail'])
        axes[1].set(ylabel='Anonymous measured value',title='Box: Q1 / median / Q3; whiskers: 1.5 IQR')
        fig.suptitle(feature+' | frozen training samples only',fontsize=12)
        fig.tight_layout()
        fig.savefig(output/(feature+'.svg'),metadata={'Date':None,'Creator':'FabGuard descriptive evidence'})
        svg=output/(feature+'.svg')
        svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
        plt.close(fig)
    print(json.dumps({'status':'descriptive_evidence_written','train_n':len(train),'train_fail':report['train_fail'],'features':FEATURES,'output':str(output)},indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--data-dir',type=Path,required=True)
    p.add_argument('--output',type=Path,default=ROOT/'docs/review/session5-20261030')
    a=p.parse_args();build(a.data_dir,a.output)
