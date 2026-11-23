"""Security boundaries that must survive configuration updates."""
import json
from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]


class SecurityConfigurationTests(unittest.TestCase):
    def test_deployment_blocks_scripts_and_embedding_without_breaking_local_data(self):
        config = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8'))
        rules = [rule for rule in config['headers'] if rule['source'] == '/(.*)']
        self.assertEqual(len(rules), 1)
        headers = {item['key'].lower(): item['value'] for item in rules[0]['headers']}
        directives = {parts[0]: parts[1:] for directive in headers['content-security-policy'].split(';')
                      if (parts := directive.split())}
        self.assertEqual(directives['script-src'], ["'self'"])
        self.assertEqual(directives['frame-ancestors'], ["'none'"])
        self.assertEqual(directives['object-src'], ["'none'"])
        self.assertEqual(directives['base-uri'], ["'none'"])
        self.assertEqual(directives['connect-src'], ["'self'"])
        self.assertEqual(headers['x-frame-options'], 'DENY')
        self.assertEqual(headers['x-content-type-options'], 'nosniff')
        # A self-only script policy also blocks inline error-handler attributes.
        app = (ROOT / 'web/app.js').read_text(encoding='utf-8')
        self.assertNotIn('onclick="location.reload()"', app)
        self.assertIn("querySelector('#retry-load').addEventListener('click'", app)

    def test_every_external_workflow_action_is_immutable(self):
        for path in (ROOT / '.github/workflows').glob('*.yml'):
            workflow = yaml.safe_load(path.read_text(encoding='utf-8'))
            for job in workflow.get('jobs', {}).values():
                steps = job.get('steps', [])
                for item in [job, *steps]:
                    uses = item.get('uses')
                    if uses and not uses.startswith('./'):
                        self.assertRegex(uses, r'^[\w./-]+@[0-9a-f]{40}$', str(path))

    def test_robot_extra_excludes_known_vulnerable_archive_versions(self):
        import tomllib
        project = tomllib.loads((ROOT / 'pyproject.toml').read_text(encoding='utf-8'))
        robot = project['project']['optional-dependencies']['robot']
        self.assertIn('py7zr>=1.1.3,<2', robot)


if __name__ == '__main__':
    unittest.main()
