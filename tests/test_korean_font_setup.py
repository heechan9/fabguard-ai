"""Hermetic command-contract tests; not a real apt/browser integration result."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

# Full-suite setup: python -m pip install ".[test]" (missing parser is not skipped).
import yaml

ROOT = Path(__file__).resolve().parents[1]


class StrictWorkflowLoader(yaml.BaseLoader):
    """String-only loader with duplicate mapping keys rejected."""
    def construct_mapping(self, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key, str) or key in result:
                raise yaml.constructor.ConstructorError(None, None,
                    'duplicate or non-string workflow key', key_node.start_mark)
            result[key] = self.construct_object(value_node, deep=deep)
        return result


class KoreanFontSetupTests(unittest.TestCase):
    def run_setup(self, initial=False, install=True, charset='ac00-d7a3', apt_fail=False, update_fail=False, platform='Ubuntu', arch='amd64', key=True, codename='noble', install_fail=False):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'font.ttc').touch()
            if key:
                (root / 'keyring.gpg').touch()
            script = root / 'candidate.sh'
            script.write_text((ROOT / 'verification/prepare_korean_fonts.sh').read_text().replace(
                '/usr/share/keyrings/ubuntu-archive-keyring.gpg', str(root / 'keyring.gpg')))
            # Test-only literal substitution: production script has no trust-root override.
            if initial:
                (root / 'ready').touch()
            commands = {
                'fc-list': '[ -e "$MOCK/ready" ] && echo "Noto Sans CJK KR"; exit 0',
                'fc-match': 'case "$*" in *index*) printf 0 ;; *) printf "%s" "$MOCK/font.ttc" ;; esac',
                'fc-query': 'printf "%s\\n" "$CHARSET"',
                'lsb_release': 'if [ "$1" = -is ]; then echo "$PLATFORM"; else echo "$CODENAME"; fi',
                'dpkg': 'echo "$ARCH"',
                'sudo': 'exec "$@"',
                'timeout': 'printf "%s\\n" "$*" >> "$MOCK/bounds"; shift 2; exec "$@"',
                'apt-get': '''printf '%s\\n' "$*" >> "$MOCK/apt"
for arg in "$@"; do
 case "$arg" in
  Dir::Etc::sourcelist=*) cp "${arg#*=}" "$MOCK/sources" ;;
 esac
done
case " $* " in
  *' update '*) [ "$UPDATE_FAIL" = 0 ] || exit 100 ;;
  *' --download-only '*) [ "$APT_FAIL" = 0 ] || exit 100 ;;
  *' --no-download '*) [ "$INSTALL_FAIL" = 0 ] || exit 100
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
                       UPDATE_FAIL=str(int(update_fail)), PLATFORM=platform, ARCH=arch, CODENAME=codename, INSTALL_FAIL=str(int(install_fail)))
            result = subprocess.run(['bash', str(script)],
                                    env=env, capture_output=True, text=True, timeout=5)
            logs = {n: (root/n).read_text() if (root/n).exists() else '' for n in ('apt', 'bounds', 'sources')}
            return result, logs

    def test_verified_preinstalled_font_avoids_download(self):
        result, logs = self.run_setup(initial=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(logs['apt'], '')

    def test_install_is_bounded_and_preserves_apt_auth_defaults(self):
        result, logs = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(logs['apt'].splitlines()), 3)
        for value in ['--kill-after=10s 90s', '--kill-after=10s 240s', '--kill-after=10s 60s', 'Acquire::Retries=1',
                      'Acquire::http::Timeout=20', 'Acquire::https::Timeout=20', 'DPkg::Lock::Timeout=20']:
            self.assertIn(value, logs['bounds'])
        self.assertNotIn('allow-unauthenticated', logs['apt'])
        self.assertNotIn('trusted=yes', logs['apt'])

    def test_official_scoped_sources_and_download_before_install(self):
        result, logs = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('https://archive.ubuntu.com/ubuntu', logs['sources'])
        self.assertIn('https://security.ubuntu.com/ubuntu', logs['sources'])
        self.assertIn('Suites: noble noble-updates', logs['sources'])
        self.assertIn('Suites: noble-security', logs['sources'])
        self.assertEqual(logs['sources'].count('Signed-By:'), 2)
        for value in ('Dir::Etc::sourceparts=', 'Dir::State::lists=',
                      'Dir::Cache::archives=', 'APT::Update::Error-Mode=any'):
            self.assertIn(value, logs['apt'])
        self.assertIn('--download-only', logs['apt'].splitlines()[1])
        self.assertIn('--no-download', logs['apt'].splitlines()[2])
        self.assertIn('--no-remove', logs['apt'].splitlines()[2])

    def test_unknown_platform_arch_or_missing_key_stops_before_apt(self):
        for kwargs in ({'platform': 'Debian'}, {'arch': 'arm64'}, {'key': False}, {'codename': 'jammy'}):
            with self.subTest(kwargs=kwargs):
                result, logs = self.run_setup(**kwargs)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(logs['apt'], '')

    def test_download_failure_never_reaches_install(self):
        result, logs = self.run_setup(apt_fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('--no-download', logs['apt'])

    def test_install_failure_is_not_swallowed(self):
        result, logs = self.run_setup(install_fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('--no-download', logs['apt'])
        self.assertEqual(len(logs['apt'].splitlines()), 3)

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
        self.assertIn('timeout-minutes: 8', text)
        self.assertIn('bash verification/prepare_korean_fonts.sh', text)
        self.assertNotIn('continue-on-error', text)
        self.assertEqual(text.count('timeout 360s node'), 5)
        self.assertEqual(text.count('timeout 240s node'), 2)
        self.assertEqual(text.count('timeout 180s node'), 3)


    def test_ur3_workflow_reuses_bounded_setup_without_reducing_coverage(self):
        text = (ROOT / '.github/workflows/ur3-replay-ui.yml').read_text()
        # BaseLoader safely keeps scalar spelling, including the GitHub key 'on',
        # instead of interpreting YAML 1.1 'on' as boolean True.
        workflow = yaml.load(text, Loader=StrictWorkflowLoader)
        self.assertEqual(workflow['on']['pull_request']['paths'],
                         ['web/**', 'scripts/build_ur3_replay.py',
                          'verification/check_ur3_replay.cjs',
                          'verification/prepare_korean_fonts.sh',
                          '.github/workflows/ur3-replay-ui.yml'])
        browser = workflow['jobs']['browser']
        self.assertEqual(browser['strategy']['matrix'], {'width': ['1366', '360', '390']})
        self.assertEqual(browser['timeout-minutes'], '20')
        self.assertEqual(browser['strategy']['fail-fast'], 'false')
        self.assertNotIn('if', browser)
        self.assertNotIn('continue-on-error', browser)
        steps = browser['steps']
        font_steps = [step for step in steps
                      if step.get('name') == 'Bounded authenticated Korean font preparation']
        self.assertEqual(len(font_steps), 1)
        font = font_steps[0]
        self.assertEqual(font['run'], 'bash verification/prepare_korean_fonts.sh')
        self.assertEqual(font['timeout-minutes'], '8')
        self.assertNotIn('if', font)
        self.assertNotIn('continue-on-error', font)
        audits = [step for step in steps
                  if step.get('name') == 'Loopback-only UR3 and existing feature regression']
        self.assertEqual(len(audits), 1)
        audit = audits[0]
        self.assertLess(steps.index(font), steps.index(audit))
        self.assertNotIn('if', audit)
        self.assertNotIn('continue-on-error', audit)
        active = [line.strip() for line in audit['run'].splitlines()
                  if line.strip() and not line.lstrip().startswith('#')]
        for name, folder, seconds in [('ur3_replay', 'ur3', 240), ('robot_sort_cell', 'robot', 360),
                                     ('context_review', 'context', 180), ('theme_ui', 'theme', 360),
                                     ('transfer_robot', 'transfer', 360)]:
            expected = (f'FABGUARD_UI_OUTPUT="$RUNNER_TEMP/ur3-evidence/{folder}" '
                        f'timeout {seconds}s node verification/check_{name}.cjs')
            self.assertIn(expected, active)
        self.assertFalse(any('sudo apt-get' in step.get('run', '') for step in steps))
        checkout = [step for step in steps if step.get('uses') == 'actions/checkout@v4']
        self.assertEqual(len(checkout), 1)
        self.assertEqual(checkout[0]['with']['persist-credentials'], 'false')
        source = workflow['jobs']['source']
        self.assertNotIn('if', source)
        self.assertNotIn('continue-on-error', source)
        rebuilds = [step for step in source['steps'] if step.get('name') ==
                    'Rebuild from pinned UCI original without new dependencies']
        self.assertEqual(len(rebuilds), 1)
        rebuild = rebuilds[0]
        self.assertNotIn('if', rebuild)
        self.assertNotIn('continue-on-error', rebuild)
        inherited_shell = workflow.get('defaults', {}).get('run', {}).get('shell', 'bash')
        job_shell = source.get('defaults', {}).get('run', {}).get('shell', inherited_shell)
        self.assertEqual(rebuild.get('shell', job_shell), 'bash')
        self.assertEqual(source['runs-on'], 'ubuntu-24.04')
        source_active = [line.strip() for line in rebuild['run'].splitlines()
                         if line.strip() and not line.lstrip().startswith('#')]
        self.assertEqual(source_active, [
            'python -c "import urllib.request; urllib.request.urlretrieve(\'https://archive.ics.uci.edu/static/public/963/ur3+cobotops.zip\', \'/tmp/ur3-source.zip\')"',
            'python scripts/build_ur3_replay.py --archive /tmp/ur3-source.zip --output "$RUNNER_TEMP/ur3-derived/data.json" > "$RUNNER_TEMP/ur3-audit.json"',
            'cmp web/robot/ur3/data.json "$RUNNER_TEMP/ur3-derived/data.json"',
            'cmp web/robot/ur3/data-hash.mjs "$RUNNER_TEMP/ur3-derived/data-hash.mjs"',
        ])

    def test_workflow_loader_rejects_duplicate_keys(self):
        with self.assertRaises(yaml.constructor.ConstructorError):
            yaml.load('jobs:\n  browser:\n    timeout-minutes: 10\n    timeout-minutes: 20\n',
                      Loader=StrictWorkflowLoader)

    def test_workflow_loader_is_string_only_not_python_object_construction(self):
        value = yaml.load('on: !!python/object/apply:os.system ["NOT_A_COMMAND"]',
                          Loader=StrictWorkflowLoader)
        self.assertEqual(value, {'on': ['NOT_A_COMMAND']})
