"""The range-source runner must stop before touching an unverified archive."""
import json
from pathlib import Path
import tempfile
import unittest

from verification.run_robot_spc_ranges import run


class RangeRunnerTests(unittest.TestCase):
    def test_partial_train_block_is_rejected_before_archive_access(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            receipt = root/'receipt.json'
            receipt.write_text(json.dumps({'train_block_complete': False, 'errors': ['short read']}))
            with self.assertRaisesRegex(ValueError, 'incomplete'):
                run(root/'does-not-exist.7z', receipt, root/'output')
            self.assertFalse((root/'output').exists())

    def test_whole_archive_or_test_claim_is_not_silently_accepted(self):
        for field in ['archive_whole_bytes_verified', 'test_block_present']:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as d:
                root = Path(d)
                receipt = {'train_block_complete': True, 'errors': [],
                           'archive_whole_bytes_verified': False, 'test_block_present': False}
                receipt[field] = True
                (root/'receipt.json').write_text(json.dumps(receipt))
                with self.assertRaisesRegex(ValueError, 'partial train-only contract'):
                    run(root/'does-not-exist.7z', root/'receipt.json', root/'output')
                self.assertFalse((root/'output').exists())
