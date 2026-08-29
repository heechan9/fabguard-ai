from pathlib import Path
import unittest

import pandas as pd

from fabguard.config import OFFICIAL_HASHES
from fabguard.data import audit_frame, load_secom, validate_raw_files


class DataTest(unittest.TestCase):
    def test_small_audit(self) -> None:
        frame = pd.DataFrame({
            "sample_id": ["a", "b"],
            "feature_000": [1.0, None],
            "feature_001": [5.0, 5.0],
            "timestamp": pd.to_datetime(["2026-01-01", "2026-01-02"]),
            "label": [0, 1],
        })
        result = audit_frame(frame)
        self.assertEqual(result["samples"], 2)
        self.assertEqual(result["fail_count"], 1)
        self.assertEqual(result["missing_cells"], 1)
        self.assertEqual(result["uninformative_features"], 2)

    @unittest.skipUnless(Path("data/raw/secom.data").exists(), "official data not present")
    def test_official_data_contract(self) -> None:
        hashes = validate_raw_files(Path("data/raw"))
        self.assertEqual(hashes, OFFICIAL_HASHES)
        frame = load_secom(Path("data/raw"))
        self.assertEqual(frame.shape, (1567, 593))
        self.assertEqual(int(frame["label"].sum()), 104)


if __name__ == "__main__":
    unittest.main()
