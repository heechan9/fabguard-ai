import tempfile, unittest, zipfile
from pathlib import Path
from fabguard.steel_reference_audit import FEATURES, LABELS, validate, audit

class AuditTests(unittest.TestCase):

    def good(self):
        r = [0.0] * 34
        r[12] = 1
        r[27] = 1
        return r

    def test_valid(self):
        self.assertEqual(len(validate([self.good()], FEATURES + LABELS)), 1)

    def test_swapped_schema(self):
        with self.assertRaises(ValueError):
            validate([self.good()], list(reversed(FEATURES + LABELS)))

    def test_empty(self):
        with self.assertRaises(ValueError):
            validate([], FEATURES + LABELS)

    def test_short_row(self):
        with self.assertRaises(ValueError):
            validate([self.good()[:-1]], FEATURES + LABELS)

    def test_nonfinite(self):
        for v in [float('nan'), float('inf'), -float('inf')]:
            r = self.good()
            r[4] = v
            with self.assertRaises(ValueError):
                validate([r], FEATURES + LABELS)

    def test_target_not_onehot(self):
        for v in [0, 0.5, 2]:
            r = self.good()
            r[27] = v
            with self.assertRaises(ValueError):
                validate([r], FEATURES + LABELS)

    def test_multihot(self):
        r = self.good()
        r[28] = 1
        with self.assertRaises(ValueError):
            validate([r], FEATURES + LABELS)

    def test_inverted_bounds(self):
        for j in [0, 2, 8]:
            r = self.good()
            r[j] = 1
            with self.assertRaises(ValueError):
                validate([r], FEATURES + LABELS)

    def test_invalid_steel_flags(self):
        r = self.good()
        r[11] = 1
        with self.assertRaises(ValueError):
            validate([r], FEATURES + LABELS)

    def test_unexpected_archive(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'bad.zip'
            with zipfile.ZipFile(p, 'w') as z:
                z.writestr('../outside', 'x')
            with self.assertRaises(ValueError):
                audit(p)

    def test_duplicate_conflict_reporting(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'toy.zip'
            r = self.good()
            s = self.good()
            s[27] = 0
            s[28] = 1
            with zipfile.ZipFile(p, 'w') as z:
                z.writestr('Faults27x7_var', '\n'.join(FEATURES + LABELS))
                z.writestr('Faults.NNA', '\n'.join((' '.join(map(str, x)) for x in [r, r, s])))
            out = audit(p)
            self.assertEqual(out['duplicate_rows_beyond_first'], 1)
            self.assertEqual(out['duplicate_features_beyond_first'], 2)
            self.assertEqual(out['conflicting_duplicate_feature_groups'], 1)
            self.assertFalse(out['structural_gate_passed'])
            self.assertFalse(out['training_performed'])

class ArchiveBoundaryTests(unittest.TestCase):
    def test_duplicate_member_rejected(self):
        import warnings
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'duplicate.zip'
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                with zipfile.ZipFile(p, 'w') as z:
                    z.writestr('Faults.NNA', '1')
                    z.writestr('Faults.NNA', '2')
                    z.writestr('Faults27x7_var', 'schema')
            with self.assertRaisesRegex(ValueError, 'archive members'):
                audit(p)

    def test_oversized_member_rejected_before_parsing(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'large.zip'
            with zipfile.ZipFile(p, 'w', compression=zipfile.ZIP_DEFLATED) as z:
                z.writestr('Faults.NNA', '0' * 1_000_001)
                z.writestr('Faults27x7_var', 'schema')
            with self.assertRaisesRegex(ValueError, 'Oversized'):
                audit(p)

    def test_archive_size_limit(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'too-big.zip'
            p.write_bytes(b'0' * 3_000_001)
            with self.assertRaisesRegex(ValueError, 'Oversized archive'):
                audit(p)

    def test_cli_does_not_overwrite_archive(self):
        from unittest.mock import patch
        from fabguard.steel_reference_audit import main
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'valid.zip'
            row = AuditTests().good()
            with zipfile.ZipFile(p, 'w') as z:
                z.writestr('Faults.NNA', ' '.join(map(str, row)))
                z.writestr('Faults27x7_var', '\n'.join(FEATURES + LABELS))
            original = p.read_bytes()
            with patch('sys.argv', ['audit', str(p), '--output', str(p)]):
                with self.assertRaises(SystemExit) as error:
                    main()
            self.assertEqual(error.exception.code, 2)
            self.assertEqual(p.read_bytes(), original)
            alias = Path(d) / 'alias.json'
            alias.hardlink_to(p)
            with patch('sys.argv', ['audit', str(p), '--output', str(alias)]):
                with self.assertRaises(SystemExit):
                    main()
            self.assertEqual(p.read_bytes(), original)
            collision = Path(d) / 'Faults.NNA'
            collision.write_bytes(original)
            import hashlib
            self.assertEqual(audit(collision)['sha256']['archive'], hashlib.sha256(original).hexdigest())

if __name__ == "__main__":
    unittest.main()
