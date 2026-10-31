"""Read-only check of the pinned SECOM review snapshot; no model execution."""
import csv
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = '78a8f61bf8319a5da01f4b2eb81fa6778cd7fde5'
CSV_SHA = '73a14b4a64a257f32ddef5924d79f3e6729ba9db6f0c402acdfe0c1708d6c563'
SNAPSHOT_SHA = 'e6655814c70bef890231a27497e2610604a6f0e9a000011e9d617c2937b622db'

def main():
    raw = (ROOT / 'results/v1/priority_table.csv').read_bytes()
    if hashlib.sha256(raw).hexdigest() != CSV_SHA:
        raise ValueError('Original priority CSV changed; do not silently repin evidence')
    rows = []
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8')), strict=True):
        rows.append(dict(sample_id=row['sample_id'], rank=int(row['rank']),
                         risk_score=float(row['risk_score']), prediction=int(row['prediction']),
                         retrospective_label=int(row['label']), model=row['model'],
                         evidence_scope=row['evidence_scope'], measurement_timestamp=row['timestamp']))
    doc = dict(source_repo_sha=SOURCE_SHA, priority_table_sha256=CSV_SHA, rows=rows)
    expected = (json.dumps(doc, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
    actual = (ROOT / 'web/review/source.json').read_bytes()
    if actual != expected or hashlib.sha256(actual).hexdigest() != SNAPSHOT_SHA:
        raise ValueError('Bundled source does not match pinned original CSV')
    print('Pinned review snapshot matches all 392 saved rows; no inference performed.')

if __name__ == '__main__':
    main()
