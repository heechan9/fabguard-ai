from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class CollaborationReplayTest(unittest.TestCase):
    def test_standalone_cli_reports_all_three_expected_outcomes(self):
        script = Path(__file__).resolve().parents[1] / "examples" / "collaboration_replay.py"
        with tempfile.TemporaryDirectory() as cwd:
            result = subprocess.run(
                [sys.executable, "-B", str(script)], cwd=cwd, check=False,
                capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(list(Path(cwd).iterdir()), [])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), [
            "fixture=synthetic-roster/v1 sha256=0c694d85c06332abb44610894ee89285f07732616f32d80b89754671af550419",
            "MATCH", "MISSING", "SUBSTITUTED", "PASS",
        ])
