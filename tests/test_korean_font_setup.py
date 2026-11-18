"""Hermetic command-contract tests; not a real apt/browser integration result."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class KoreanFontSetupTests(unittest.TestCase):
    def run_setup(self, initial=False, install=True, charset='ac00-d7a3', apt_fail=False, update_fail=False):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'font.ttc').touch()
            if initial:
                (root / 'ready').touch()
            commands = {
                'fc-list': '[ -e "$MOCK/ready" ] && echo "Noto Sans CJK KR"; exit 0',
                'fc-match': 'case "$*" in *index*) printf 0 ;; *) printf "%s" "$MOCK/font.ttc" ;; esac',
                'fc-query': 'printf "%s\\n" "$CHARSET"',
                'sudo': 'exec "$@"',
                'timeout': 'printf "%s\\n" "$*" >> "$MOCK/bounds"; shift 2; exec "$@"',
                'apt-get': '''printf '%s\\n' "$*" >> "$MOCK/apt"
case " $* " in
  *' update '*) [ "$UPDATE_FAIL" = 0 ] || exit 100 ;;
  *' install '*) [ "$APT_FAIL" = 0 ] || exit 100
                 [ "$INSTALL" = 0 ] || touch "$MOCK/ready" ;;
esac
''',
            }
            for name, body in commands.items():
                p = root / name
                p.write_text('#!/bin/bash\n' + body + '\n')
                p.chmod(0o755)
            env = dict(os.environ, PATH=str(root)+':'+os.environ['PATH'], MOCK=str(root),
                       INSTALL=str(int(install)), CHARSET=charset, APT_FAIL=str(int(apt_fail)),
                       UPDATE_FAIL=str(int(update_fail)))
            result = subprocess.run(['bash', str(ROOT / 'verification/prepare_korean_fonts.sh')],
                                    env=env, capture_output=True, text=True, timeout=5)
            logs = {n: (root/n).read_text() if (root/n).exists() else '' for n in ('apt', 'bounds')}
            return result, logs

    def test_verified_preinstalled_font_avoids_download(self):
        result, logs = self.run_setup(initial=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(logs['apt'], '')

    def test_install_is_bounded_and_preserves_apt_auth_defaults(self):
        result, logs = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(logs['apt'].splitlines()), 2)
        for value in ['--kill-after=10s 90s', '--kill-after=10s 300s', 'Acquire::Retries=1',
                      'Acquire::http::Timeout=20', 'Acquire::https::Timeout=20', 'DPkg::Lock::Timeout=20']:
            self.assertIn(value, logs['bounds'])
        self.assertNotIn('allow-unauthenticated', logs['apt'])
        self.assertNotIn('trusted=yes', logs['apt'])

    def test_install_failure_is_not_swallowed(self):
        result, _ = self.run_setup(apt_fail=True)
        self.assertNotEqual(result.returncode, 0)

    def test_update_failure_stops_before_install(self):
        result, logs = self.run_setup(update_fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(' install ', logs['apt'])

    def test_successful_install_without_font_fails(self):
        result, _ = self.run_setup(install=False)
        self.assertNotEqual(result.returncode, 0)

    def test_partial_or_invalid_charset_fails(self):
        for charset in ('ac00-d7a2', '20-7e', '', 'invalid', 'd7a3-ac00'):
            with self.subTest(charset=charset):
                result, _ = self.run_setup(initial=True, charset=charset)
                self.assertNotEqual(result.returncode, 0)

    def test_split_complete_charset_passes(self):
        result, _ = self.run_setup(initial=True, charset='ac00-bfff c000-d7a3')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_workflow_preserves_all_cases_and_browser_budgets(self):
        text = (ROOT / '.github/workflows/release-browser.yml').read_text()
        self.assertIn('kind: [robot, context, silver, theme, transfer, floor-agv, ur3, oht, offline-report]', text)
        self.assertIn('width: [1366, 390, 360]', text)
        self.assertIn('max-parallel: 4', text)
        self.assertIn('timeout-minutes: 7', text)
        self.assertIn('bash verification/prepare_korean_fonts.sh', text)
        self.assertNotIn('continue-on-error', text)
        self.assertEqual(text.count('timeout 360s node'), 5)
        self.assertEqual(text.count('timeout 240s node'), 2)
        self.assertEqual(text.count('timeout 180s node'), 3)
