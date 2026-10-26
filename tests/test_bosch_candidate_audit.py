"""Input identity and join accounting, without optional NetCDF dependencies."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('candidate_audit', Path(__file__).parents[1] / 'scripts/audit_bosch_candidate.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class CandidateAuditTest(unittest.TestCase):
    def test_blank_keys_orphans_and_duplicates_are_not_silently_joined(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'measurements.csv'
            p.write_text('experiment_key,lot_number,X,Y\na,1,0,0\na,1,0,0\n,1,1,1\nz,2,2,2\n')
            r = audit.read_metrology(p, {'a', 'b'})
            self.assertEqual(r['blank_key_rows'], 1)
            self.assertEqual(r['matched_process_keys'], 1)
            self.assertEqual(r['duplicate_wafer_coordinate_rows'], 1)
            self.assertEqual(r['process_without_measurements'], ['b'])
            self.assertEqual(r['measurements_without_process'], ['z'])
            self.assertEqual(r['rows'], 4)

    def test_empty_table_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'empty.csv'; p.write_text('experiment_key,lot_number,X,Y\n')
            with self.assertRaisesRegex(ValueError, 'empty or incomplete'):
                audit.read_metrology(p, set())

    def test_corrupt_source_rejected_before_decode(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d); name = audit.FILES[0]
            (p / 'bosch-metadata.json').write_text(json.dumps({'id': 17122442, 'files': [
                {'key': name, 'size': 3, 'checksum': 'md5:wrong'}]}))
            (p / name).write_bytes(b'bad')
            with self.assertRaisesRegex(ValueError, 'source verification failed'):
                audit.verify_sources(p)

    def test_wrong_record_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d); (p / 'bosch-metadata.json').write_text('{"id": 1}')
            with self.assertRaisesRegex(ValueError, 'wrong Zenodo record'):
                audit.verify_sources(p)
