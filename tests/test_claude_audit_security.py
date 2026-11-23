"""Guard the credential boundary of owner-requested PR audits."""
from pathlib import Path
import shlex
import unittest

from tests.test_korean_font_setup import StrictWorkflowLoader
import yaml

ROOT = Path(__file__).resolve().parents[1]


class ClaudeAuditSecurityTest(unittest.TestCase):
    def test_pr_content_cannot_become_runner_configuration_or_executable_tools(self):
        workflow = yaml.load(
            (ROOT / '.github/workflows/claude-pr-audit.yml').read_text(encoding='utf-8'),
            Loader=StrictWorkflowLoader,
        )
        self.assertEqual(workflow['on'], {'issue_comment': {'types': ['created']}})
        job = workflow['jobs']['claude-audit']
        self.assertIn("github.event.comment.user.login == 'heechan9'", job['if'])
        self.assertEqual(workflow['permissions'], {'contents': 'read', 'pull-requests': 'write'})
        checkout, _, review = job['steps']
        self.assertEqual(checkout['with']['ref'], '${{ github.sha }}')
        self.assertFalse(checkout['with']['persist-credentials'])
        inputs = review['with']
        self.assertEqual(inputs['github_token'], '${{ github.token }}')
        # A prompt selects agent mode; tag mode would check out the PR head.
        self.assertTrue(inputs['prompt'].strip())
        self.assertNotIn('github.event.comment.body', inputs['prompt'])
        args = shlex.split(inputs['claude_args'])
        self.assertEqual(args[args.index('--tools') + 1], '')
        self.assertEqual(args[args.index('--permission-mode') + 1], 'plan')
        self.assertEqual(set(args[args.index('--allowedTools') + 1].split(',')), {
            'mcp__github__get_pull_request', 'mcp__github__get_pull_request_diff',
            'mcp__github__get_pull_request_files', 'mcp__github__add_issue_comment',
        })
        self.assertEqual(inputs['restrict_untrusted_prs'], 'true')


if __name__ == '__main__':
    unittest.main()
