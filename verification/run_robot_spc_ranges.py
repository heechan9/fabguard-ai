"""Run the frozen robot SPC on selected train members of a partial archive.

Never treats sparse/partial archive bytes as a verified complete archive.
No test members, feature tuning, model fitting or performance evaluation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zlib

from fabguard.robot_window_spc import config_digest, run_protocol_from_bytes

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'docs/review/pr173-validation-20261024'
EXPECTED_CONFIG = '55794547c6d4355a6f407a049bf973abd4e0a34d01a0c1e208477f4d34aef1ce'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run(archive, acquisition, output):
    config = json.loads((REVIEW / 'robot_config.json').read_text())
    plan = json.loads((REVIEW / 'robot_plan.json').read_text())
    if config_digest(config) != EXPECTED_CONFIG or plan['config_sha256'] != EXPECTED_CONFIG:
        raise ValueError('frozen config changed')
    receipt = json.loads(acquisition.read_text())
    if not receipt['train_block_complete'] or receipt['errors']:
        raise ValueError('train block acquisition incomplete')
    if receipt['archive_whole_bytes_verified'] or receipt['test_block_present']:
        raise ValueError('receipt does not describe this partial train-only contract')
    import py7zr  # optional robot extra, only after acquisition guards pass
    output.mkdir(parents=True, exist_ok=True)
    selected = {}
    for group in plan['groups']:
        for segment in group['segment_ids']:
            name = f'RoboticArm/train/ism330dhcx_acc_{segment}.parquet'
            selected[name] = (segment, group)
    if len(selected) != 20:
        raise ValueError('expected exactly 20 preselected train files')
    with py7zr.SevenZipFile(archive, 'r') as compressed:
        members = {m.filename: m for m in compressed.list()}
        if not set(selected) <= set(members):
            raise ValueError('missing selected archive members')
        compressed.extract(path=output / 'private_extract', targets=list(selected))
    sources, files, member_checks = {}, [], []
    for name, (segment, group) in sorted(selected.items()):
        path = output / 'private_extract' / name
        payload = path.read_bytes()
        member = members[name]
        if len(payload) != member.uncompressed or zlib.crc32(payload) != member.crc32:
            raise ValueError(f'archive member size/CRC mismatch: {name}')
        files.append({'file_id': segment, 'recording_group': group['recording_group'],
                      'role': group['role'], 'source_sha256': sha(payload),
                      'condition': {'op': 'weight15', 'env': 'BckgA'}})
        sources[segment] = payload
        member_checks.append({'file_id': segment, 'bytes': len(payload),
                              'crc32': member.crc32, 'sha256': sha(payload)})
    manifest = {'schema_version': 1, 'config_sha256': EXPECTED_CONFIG,
                'protocol_status': 'prespecified', 'holdout_status': 'reused_development_data',
                'expected_groups': {'reference': 1, 'calibration': 1, 'evaluation': 2}, 'files': files}
    # Freeze verified member hashes BEFORE the first Parquet/signal decode.
    (output / 'manifest_before_decode.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (output / 'member_checks.json').write_text(json.dumps(member_checks, indent=2)+'\n')
    report = run_protocol_from_bytes(manifest, config, sources, decoder='parquet')
    (output / 'report.json').write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    evidence = {'source': 'official Zenodo 12665499 HTTP ranges; selected train members only',
                'whole_archive_hash_verified': False, 'test_block_decoded': False,
                'member_size_crc_checks': len(member_checks), 'config_sha256': EXPECTED_CONFIG,
                'source_code_sha256': sha(Path(__file__).read_bytes()),
                'spc_module_sha256': sha((ROOT/'src/fabguard/robot_window_spc.py').read_bytes()),
                'source_amendment_sha256': sha((REVIEW/'SOURCE_ACQUISITION_AMENDMENT.md').read_bytes()),
                'manifest_before_decode_sha256': sha((output/'manifest_before_decode.json').read_bytes()),
                'report_sha256': sha((output/'report.json').read_bytes()),
                'run_status': report['run_status'], 'performance_verdict': 'not_evaluable',
                'limits': ['CRC32 is not cryptographic provenance authentication',
                          'Full archive MD5/SHA256 not verified',
                          'Known development groups; no independent holdout',
                          'No anomaly onset/end labels or verified stable-normal context']}
    (output / 'execution_evidence.json').write_text(json.dumps(evidence, indent=2)+'\n')
    print(json.dumps({'run_status': report['run_status'], 'reasons': report['reasons'],
                      'flags': report['flags'], 'member_checks': len(member_checks)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--acquisition', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    run(args.archive, args.acquisition, args.output_dir)
