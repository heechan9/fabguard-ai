"""Read-only BOSCH candidate audit; no fitting, scoring, interpolation or downloads.

Run in an isolated environment with numpy and netCDF4; not a runtime dependency.
Supply the official record JSON and selected source files in --source-dir.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

FILES = ('Dictionary_process.nc', 'Process_data.nc', 'Si_Oxide_etch_89_points.csv',
         'Si_Oxide_etch_9_points.csv', 'Lot_status.xlsx', 'Readme.pdf', 'Wafer_layout.pdf')


def verify_sources(root):
    metadata_bytes = (root / 'bosch-metadata.json').read_bytes()
    metadata = json.loads(metadata_bytes)
    if metadata.get('id') != 17122442:
        raise ValueError('wrong Zenodo record')
    manifest = []
    by_name = {f['key']: f for f in metadata['files']}
    for name in FILES:
        b = (root / name).read_bytes()
        f = by_name[name]
        if len(b) != f['size'] or 'md5:' + hashlib.md5(b).hexdigest() != f['checksum']:
            raise ValueError('source verification failed: ' + name)
        manifest.append({'file': name, 'bytes': len(b), 'md5': f['checksum'],
                         'sha256': hashlib.sha256(b).hexdigest(), 'url': f['links']['self']})
    return manifest, hashlib.sha256(metadata_bytes).hexdigest(), metadata['metadata'].get('license')


def read_metrology(path, process_keys):
    with path.open(newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    if not rows or not {'experiment_key', 'lot_number', 'X', 'Y'}.issubset(rows[0]):
        raise ValueError('empty or incomplete metrology table')
    keys = Counter(r['experiment_key'] for r in rows if r['experiment_key'])
    locations = Counter((r['experiment_key'], r['X'], r['Y']) for r in rows if r['experiment_key'])
    return {'rows': len(rows), 'keyed_rows': sum(keys.values()), 'wafer_keys': len(keys),
            'blank_key_rows': sum(not r['experiment_key'] for r in rows),
            'rows_per_wafer_distribution': dict(Counter(keys.values())),
            'duplicate_wafer_coordinate_rows': sum(n-1 for n in locations.values() if n > 1),
            'blank_cells_by_column': {k: sum(r[k] == '' for r in rows) for k in rows[0]},
            'matched_process_keys': len(set(keys) & process_keys),
            'process_without_measurements': sorted(process_keys - set(keys)),
            'measurements_without_process': sorted(set(keys) - process_keys),
            'lots': sorted({r['lot_number'] for r in rows if r['experiment_key']}, key=int)}


def audit(root):
    manifest, metadata_hash, license_info = verify_sources(root)
    import numpy as np
    import netCDF4
    groups = []
    feature_schemas = {}
    with netCDF4.Dataset(root / 'Dictionary_process.nc') as d:
        decoder = d['data'][:]
    with netCDF4.Dataset(root / 'Process_data.nc') as d:
        for name, g in d.groups.items():
            match = re.fullmatch(r'Day_(\d{4})_(\d{2})_(\d{2})_Wafer_(\d{2})', name)
            if not match:
                raise ValueError('unrecognized process key: ' + name)
            a, b, c, w = match.groups()
            t = np.asarray(g['times'][:]); dt = np.diff(t)
            encoded = g['data'][:]
            if np.ma.getmaskarray(encoded).any() or encoded.max() >= len(decoder):
                raise ValueError('masked or out-of-range dictionary index: ' + name)
            decoded = decoder[encoded]
            features = list(g['feature'][:])
            schema_hash = hashlib.sha256(json.dumps(features).encode()).hexdigest()
            feature_schemas[schema_hash] = features
            groups.append({'group': name, 'experiment_key': f'{a}-{b}-{c}_{w}',
                           'rows': len(t), 'feature_count': len(g['feature']),
                           'feature_schema_sha256': schema_hash,
                           'time_units': g['times'].units, 'calendar': g['times'].calendar,
                           'time_start': float(t[0]), 'time_end': float(t[-1]),
                           'median_interval_s': float(np.median(dt)),
                           'max_interval_s': float(dt.max()),
                           'nonincreasing_intervals': int((dt <= 0).sum()),
                           'intervals_gt_0_3s': int((dt > .3).sum()),
                           'nonfinite_decoded_values': int((~np.isfinite(decoded)).sum())})
    keys = {g['experiment_key'] for g in groups}
    if len(keys) != len(groups):
        raise ValueError('duplicate process key')
    return {'scope': 'candidate_input_audit_only_no_model_or_performance_evaluation',
            'record': 'https://zenodo.org/records/17122442', 'license': license_info,
            'metadata_sha256': metadata_hash, 'files': manifest,
            'environment': {'netCDF4': netCDF4.__version__, 'numpy': np.__version__},
            'process': {'wafer_groups': len(groups), 'rows': sum(g['rows'] for g in groups),
                        'feature_count_distribution': dict(Counter(g['feature_count'] for g in groups)),
                        'nonincreasing_intervals': sum(g['nonincreasing_intervals'] for g in groups),
                        'intervals_gt_0_3s': sum(g['intervals_gt_0_3s'] for g in groups),
                        'interval_rule': 'descriptive cadence check only, not anomaly threshold',
                        'feature_schemas': feature_schemas, 'groups': groups},
            'metrology': {name: read_metrology(root / name, keys) for name in FILES if name.endswith('.csv')},
            'performance': {'false_alarm_rate': None, 'anomaly_recall': None, 'detection_delay': None},
            'unverified': ['absolute_timestamp_semantics', 'ET_and_final_yield_not_provided',
                           'anomaly_onsets_not_verified', 'OES_not_downloaded',
                           'causal_conditioning_effect_not_established']}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-dir', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    result = audit(args.source_dir)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('candidate audit written; no model evaluation:', args.output)
