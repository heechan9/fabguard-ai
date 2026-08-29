from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from fabguard.skeleton import (
    build_example_priority_row,
    read_priority_table,
    write_priority_table,
)


class SkeletonTest(unittest.TestCase):
    def test_priority_table_round_trip(self) -> None:
        with TemporaryDirectory() as directory:
            output = Path(directory) / "priority.csv"
            write_priority_table(build_example_priority_row(), output)
            rows = read_priority_table(output)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["sample_id"], "SECOM_DEMO_0001")
        self.assertEqual(rows[0]["rank"], "1")
        self.assertIn("not proven causes", rows[0]["limitation"])


if __name__ == "__main__":
    unittest.main()

