"""Read-only standalone UCI Steel Plates Faults audit. No fitting or inference."""
import argparse
import collections
import hashlib
import io
import json
import math
import platform
import zipfile
from pathlib import Path
FEATURES = 'X_Minimum X_Maximum Y_Minimum Y_Maximum Pixels_Areas X_Perimeter Y_Perimeter Sum_of_Luminosity Minimum_of_Luminosity Maximum_of_Luminosity Length_of_Conveyer TypeOfSteel_A300 TypeOfSteel_A400 Steel_Plate_Thickness Edges_Index Empty_Index Square_Index Outside_X_Index Edges_X_Index Edges_Y_Index Outside_Global_Index LogOfAreas Log_X_Index Log_Y_Index Orientation_Index Luminosity_Index SigmoidOfAreas'.split()
LABELS = 'Pastry Z_Scratch K_Scatch Stains Dirtiness Bumps Other_Faults'.split()

def validate(rows, names):
    if names != FEATURES + LABELS:
        raise ValueError('Unexpected ordered schema')
    if not rows:
        raise ValueError('Empty dataset')
    for i, row in enumerate(rows):
        if len(row) != 34 or any((not math.isfinite(v) for v in row)):
            raise ValueError(f'Invalid width/missing/nonfinite row {i}')
        if any((v not in (0, 1) for v in row[27:])) or sum(row[27:]) != 1:
            raise ValueError(f'Invalid one-hot target row {i}')
        if row[0] > row[1] or row[2] > row[3] or row[8] > row[9]:
            raise ValueError(f'Inverted coordinate/luminosity bounds row {i}')
        if row[11] not in (0, 1) or row[12] not in (0, 1) or row[11] + row[12] != 1:
            raise ValueError(f'Invalid steel-type flags row {i}')
    return rows

def audit(path):
    # Bound the entire input, including ZIP comments/trailing bytes, and hash
    # exactly the bytes parsed instead of reopening a potentially changed path.
    with path.open('rb') as stream:
        archive = stream.read(3_000_001)
    if len(archive) > 3_000_000:
        raise ValueError('Oversized archive')
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if len(z.infolist()) != 2 or set(z.namelist()) != {'Faults.NNA', 'Faults27x7_var'}:
            raise ValueError('Unexpected archive members')
        if any((x.file_size > 1000000 for x in z.infolist())):
            raise ValueError('Oversized archive member')
        raw = z.read('Faults.NNA')
        dictionary = z.read('Faults27x7_var')
    names = dictionary.decode('ascii').split()
    rows = validate([tuple(map(float, line.split())) for line in raw.decode('ascii').splitlines() if line.strip()], names)
    groups = collections.defaultdict(set)
    for row in rows:
        groups[row[:27]].add(row[27:])
    ranges = {n: {'min': min((r[j] for r in rows)), 'max': max((r[j] for r in rows)), 'unique': len({r[j] for r in rows})} for j, n in enumerate(FEATURES)}
    return {
        'dataset': 'UCI Steel Plates Faults',
        'source': 'https://archive.ics.uci.edu/dataset/198/steel+plates+faults',
        'download': 'https://archive.ics.uci.edu/static/public/198/steel%2Bplates%2Bfaults.zip',
        'doi': '10.24432/C5J88N',
        'license': 'CC BY 4.0',
        'authors': ['M. Buscema', 'S. Terzi', 'W. Tastle'],
        'provenance_status': 'Source metadata describes official dataset; input identity is recorded, not authenticated',
        'python': platform.python_version(),
        'sha256': {
            'archive': hashlib.sha256(archive).hexdigest(),
            'members': {
                'Faults.NNA': hashlib.sha256(raw).hexdigest(),
                'Faults27x7_var': hashlib.sha256(dictionary).hexdigest(),
            },
        },
        'rows': len(rows),
        'feature_count': 27,
        'target_columns': LABELS,
        'missing_or_nonfinite': 0,
        'invalid_onehot': 0,
        'duplicate_rows_beyond_first': len(rows) - len(set(rows)),
        'duplicate_features_beyond_first': len(rows) - len(groups),
        'conflicting_duplicate_feature_groups': sum((len(v) > 1 for v in groups.values())),
        'class_counts': {n: int(sum((r[27 + j] for r in rows))) for j, n in enumerate(LABELS)},
        'observed_ranges_not_specification_limits': ranges,
        'split_status': 'NOT_SPLIT: timestamp/lot/equipment identifiers absent; no temporal/group generalization claim',
        'quality_scope': 'Structural audit only; not qualified for SECOM locked evaluation or semiconductor validation',
        'training_performed': False,
        'unit_status': 'Not inferred from feature names; consult source documentation before physical interpretation',
        'structural_gate_passed': len(rows) == len(groups) and all((len(v) == 1 for v in groups.values())),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument('archive', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    if (a.output.resolve() == a.archive.resolve()
            or (a.output.exists() and a.output.samefile(a.archive))):
        p.error('Output must not overwrite the input archive')
    result = audit(a.archive)
    a.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'observed_ranges_not_specification_limits'}, indent=2))
if __name__ == '__main__':
    main()
