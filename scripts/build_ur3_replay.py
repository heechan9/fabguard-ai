"""Reproduce the UR3 read-only web asset from pinned UCI XLSX bytes (stdlib only).

No learning, imputation, sorting, resampling or inferred operating conditions.
The 5-second display gap rule is not an anomaly detection threshold.
"""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path
from statistics import median
import xml.etree.ElementTree as ET
import zipfile

ARCHIVE_SHA = '233334eeb5370e594ea621796ca2d693bd4980cc2bb24fa749b1b633a4993c8d'
XLSX_SHA = 'f0f10917de9056908a82cec1aa459ddf9da2d2db70d269b128f99241c8796091'
MEMBER = 'dataset_02052023.xlsx'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ROOT = Path(__file__).resolve().parents[1]
SHA = lambda b: hashlib.sha256(b).hexdigest()


def build(archive):
    raw = archive.read_bytes()
    if SHA(raw) != ARCHIVE_SHA:
        raise ValueError('UCI archive hash mismatch')
    with zipfile.ZipFile(archive) as z:
        xlsx = z.read(MEMBER)
    if SHA(xlsx) != XLSX_SHA:
        raise ValueError('XLSX hash mismatch')
    import io
    with zipfile.ZipFile(io.BytesIO(xlsx)) as z:
        strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    ignored = 0
    for row in sheet.findall('s:sheetData/s:row', NS):
        values = [None] * 24
        for cell in row:
            column = 0
            for char in ''.join(c for c in cell.get('r') if c.isalpha()):
                column = column * 26 + ord(char) - 64
            value = cell.find('s:v', NS)
            if column > 24:
                if value is not None:
                    raise ValueError('Unexpected data beyond the 24-column source schema')
                ignored += 1  # blank formatting cells, not additional data columns
                continue
            if value is not None:
                kind = cell.get('t')
                values[column - 1] = strings[int(value.text)] if kind == 's' else bool(int(value.text)) if kind == 'b' else float(value.text)
        rows.append(values)
    columns = rows.pop(0)
    if len(rows) != 7409 or columns[:2] != ['Num', 'Timestamp'] or columns[-3:] != ['cycle ', 'Robot_ProtectiveStop', 'grip_lost']:
        raise ValueError('Unexpected source shape')
    quoted = 0
    for row in rows:
        stamp = row[1]
        if stamp.startswith('"') and stamp.endswith('"'):
            row[1] = stamp[1:-1]
            quoted += 1
    times = [datetime.fromisoformat(r[1].replace('Z', '+00:00')) for r in rows]
    deltas = [(times[i] - times[i - 1]).total_seconds() for i in range(1, len(times))]
    if any(d <= 0 for d in deltas):
        raise ValueError('Source timestamps are not strictly increasing; do not silently sort')
    missing = {c: sum(r[i] is None for r in rows) for i, c in enumerate(columns)}
    cycles = Counter(r[21] for r in rows)
    audit = {
        'rows': len(rows), 'columns': len(columns), 'missing_by_column': missing,
        'sensor_missing_rows': sum(any(v is None for v in r[2:21]) for r in rows),
        'median_interval_s': median(deltas), 'min_interval_s': min(deltas), 'max_interval_s': max(deltas),
        'gap_display_rule_s': 5, 'gaps': [{'row': i + 2, 'seconds': d} for i, d in enumerate(deltas) if d > 5],
        'cycle_unique_values': len(cycles), 'cycle_repeat_rows': sum(v - 1 for v in cycles.values()),
        'cycle_decreases': [i + 1 for i in range(1, len(rows)) if rows[i][21] < rows[i - 1][21]],
        'quoted_timestamps_normalized': quoted, 'ignored_blank_formatting_cells': ignored,
        'recorded_protective_stop_true_rows': sum(r[22] is True for r in rows),
        'recorded_grip_lost_true_rows': sum(r[23] is True for r in rows),
    }
    return {
        'schema_version': 'fabguard-ur3-records/v1',
        'source': {
            'title': 'UR3 CobotOps', 'url': 'https://archive.ics.uci.edu/dataset/963/ur3+cobotops',
            'download_url': 'https://archive.ics.uci.edu/static/public/963/ur3+cobotops.zip',
            'doi': '10.24432/C5J891', 'license': 'CC BY 4.0',
            'license_url': 'https://creativecommons.org/licenses/by/4.0/',
            'creators': 'Tyrovolas, Aliev, Antonelli, Stylios (2024)',
            'retrieved_on_kst': '2026-10-25', 'archive_sha256': ARCHIVE_SHA, 'xlsx_sha256': XLSX_SHA,
            'member': MEMBER,
            'transformations': ['A:X data columns; blank formatting cells beyond X ignored',
                                'paired quotes removed from 863 UTC timestamp strings',
                                'numeric cells decoded as binary64; missing cells preserved as null',
                                'original row order retained; no imputation/resampling/deduplication'],
        },
        'columns': columns, 'rows': rows, 'audit': audit,
        'unknown_conditions': ['payload', 'commanded_speed', 'robot_pose', 'joint_positions', 'session_identity'],
        'performance': {'anomaly_recall': None, 'false_alarm_rate': None, 'detection_delay': None},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'web/robot/ur3/data.json')
    args = parser.parse_args()
    report = build(args.archive)
    data = (json.dumps(report, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    args.output.with_name('data-hash.mjs').write_text("// Pinned derived asset, generated by scripts/build_ur3_replay.py\nexport const DATA_SHA256 = '" + SHA(data) + "';\n")
    print(json.dumps({'data_sha256': SHA(data), 'audit': report['audit']}, indent=2))
