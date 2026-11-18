"""CLI integration regressions only; reuse existing fixtures and validators.

Co-reporting is not an authenticated physical observation join or approval gate.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import test_decision_basis as bf
import test_semantic_mapping as mf
from fabguard.decision_basis import record_decision_basis
from fabguard.decision_basis_quality import summarize_basis_quality
from fabguard.semantic_mapping import diagnose_mapping
from fabguard.manufacturing_review import _sha256

RECORDED = '2026-09-01T00:22:00Z'


class MappingReviewCLIBoundaries(unittest.TestCase):
    def setUp(self):
        self.b = bf.DecisionBasisTests(); self.b.setUp()
        self.m = mf.MappingTests(); self.m.setUp()

    def originals(self):
        b = self.b
        return (b.events, b.history, b.package, b.decisions, b.enc(b.basis))

    def run_cli(self, *, bad_left=None, expected_exit=0, prior_output=None):
        """Call the real public CLI in an isolated directory; never replace a validator."""
        with tempfile.TemporaryDirectory(prefix='fg-mapping-boundary-') as tmp:
            root = Path(tmp)
            originals = self.originals()
            raws = dict(zip(('events','history','package','decisions','basis'), originals))
            raws.update(left=mf.enc(self.m.left) if bad_left is None else bad_left,
                        right=mf.enc(self.m.right), contract=mf.enc(self.m.contract))
            cmd = [sys.executable, '-B', '-m', 'fabguard.decision_basis']
            paths = {}
            for name, raw in raws.items():
                paths[name] = root/(name+'.json'); paths[name].write_bytes(raw)
                cmd += ['--'+('mapping-'+name if name in ('left','right','contract') else name), str(paths[name])]
            output = root/'review.json'
            if prior_output is not None: output.write_bytes(prior_output)
            cmd += ['--output',str(output),'--recorded-at',RECORDED,'--include-diagnostics',
                    '--mapping-as-of',self.m.args['as_of'],
                    '--mapping-caller-id',self.m.args['caller_id'],
                    '--mapping-purpose',self.m.args['purpose']]
            result = subprocess.run(cmd, capture_output=True)
            after = {name:path.read_bytes() for name,path in paths.items()}
            logdir = os.environ.get('FG_BOUNDARY_LOG_DIR')
            if logdir:
                logroot = Path(logdir); logroot.mkdir(parents=True,exist_ok=True)
                stem = self._testMethodName
                (logroot/(stem+'.stdout')).write_bytes(result.stdout)
                (logroot/(stem+'.stderr')).write_bytes(result.stderr)
                (logroot/(stem+'.json')).write_text(json.dumps({
                    'command':cmd,'exit':result.returncode,'expected_exit':expected_exit,
                    'input_sha256_before':{n:hashlib.sha256(v).hexdigest() for n,v in raws.items()},
                    'input_sha256_after':{n:hashlib.sha256(v).hexdigest() for n,v in after.items()},
                    'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest() if output.exists() else None,
                    'output':json.loads(output.read_bytes()) if result.returncode==0 and output.exists() else None,
                    'prior_output_preserved':output.read_bytes()==prior_output if prior_output is not None else None,
                },ensure_ascii=False,indent=2)+'\n')
            self.assertEqual(result.returncode, expected_exit, result.stderr)
            self.assertEqual(after, raws)
            if expected_exit != 0:
                self.assertIn(b'decision basis refused:',result.stderr)
                if prior_output is None: self.assertFalse(output.exists())
                else: self.assertEqual(output.read_bytes(),prior_output)
                return None
            report = json.loads(output.read_bytes())
            # Whole validated component outputs survive the actual serialization path.
            self.assertEqual(report['basis_audit'], record_decision_basis(*originals,recorded_at=RECORDED))
            self.assertEqual(report['quality'], summarize_basis_quality(*originals,recorded_at=RECORDED))
            self.assertEqual(report['mapping'], diagnose_mapping(raws['left'],raws['right'],raws['contract'],**self.m.args))
            self.assertEqual(set(report), {'schema_version','basis_audit','quality','mapping','mapping_input_status',
                                          'observation_linkage_status','operational_status','review_input_sha256','claim_boundary'})
            self.assertEqual(report['schema_version'],'fabguard-review-diagnostics/v1')
            self.assertEqual(report['operational_status'],'WITHHELD')
            self.assertEqual(report['mapping_input_status'],'PROVIDED')
            self.assertEqual(report['observation_linkage_status'],'NOT_ESTABLISHED')
            self.assertEqual(report['mapping']['operational_status'],'WITHHELD')
            self.assertEqual(report['mapping']['authority_status'],'unverified_declaration')
            self.assertEqual(report['mapping']['source_independence'],'unverified')
            self.assertEqual(report['review_input_sha256'],{name:_sha256(raws[name]) for name in ('events','history','package','decisions','basis')})
            audit = report['basis_audit']['audit']
            submitted = len(json.loads(raws['decisions'])['decisions'])
            self.assertEqual(audit['counts'],{'total':3,'decided':submitted,'pending':3-submitted})
            observation_ids = [row['review_id'] for row in json.loads(raws['package'])['observations']]
            submitted_ids = {row['review_id'] for row in json.loads(raws['decisions'])['decisions']}
            self.assertCountEqual([row['review_id'] for row in audit['entries']], observation_ids)
            self.assertCountEqual([row['review_id'] for row in audit['entries'] if row['state'] == 'pending'],
                                  [rid for rid in observation_ids if rid not in submitted_ids])
            self.assertEqual(len(audit['entries']), 3)
            self.assertEqual(sum(row['state'] == 'pending' for row in audit['entries']), 3-submitted)
            for row in audit['entries']:
                if row['state']=='pending': self.assertIsNone(row['decision'])
                else:
                    self.assertEqual(row['decision']['action'],'hold')
                    self.assertEqual(row['decision']['outcome'],'insufficient_evidence')
            history = report['quality']['submission_attempt_history']
            self.assertEqual(history['status'],'unknown')
            for key in ('total_attempts','rejected_attempts','rejection_fraction'): self.assertIsNone(history[key])
            self.assertEqual(report['quality']['counts']['pending_observations'],3-submitted)
            return report

    def assert_mapping_hold(self, report, reason):
        self.assertEqual(report['mapping']['status'],'HOLD')
        self.assertIn(reason,report['mapping']['reasons'])

    def test_cli_unit_missing_retains_mapping_hold_and_review_warning(self):
        del self.m.left['unit']; self.m.bind()
        self.b.basis['entries'][0]['change_refs']=[]
        r=self.run_cli()
        self.assert_mapping_hold(r,'left:unit:unknown_or_invalid')
        self.assertEqual(r['quality']['diagnostic_counts']['needs_human_review'],1)

    def test_cli_future_available_time_hold_survives_good_structural_quality(self):
        self.m.right['available_at']='2026-01-01T02:00:01Z'; self.m.bind()
        r=self.run_cli()
        self.assert_mapping_hold(r,'right:time_outside_contract')
        self.assertEqual(r['quality']['diagnostic_counts']['no_structural_warning'],1)

    def test_cli_expired_contract_hold_survives_serialization(self):
        self.m.args['as_of']=self.m.contract['valid_until']
        self.assert_mapping_hold(self.run_cli(),'contract:time_outside_contract')

    def test_cli_wrong_caller_is_not_inferred_from_contract(self):
        self.m.args['caller_id']='other-synthetic-caller'
        self.assert_mapping_hold(self.run_cli(),'caller_id:not_bound')

    def test_cli_wrong_purpose_is_not_inferred_from_contract(self):
        self.m.args['purpose']='other-synthetic-purpose'
        self.assert_mapping_hold(self.run_cli(),'purpose:not_bound')

    def test_cli_malformed_mapping_cannot_publish_success_or_replace_prior_output(self):
        self.run_cli(bad_left=b'{"duplicate":1,"duplicate":2}',expected_exit=2,
                     prior_output=b'EXISTING_SYNTHETIC_RESULT_MUST_REMAIN\n')

    def test_cli_mapping_match_cannot_repair_invalid_review_basis(self):
        self.assertEqual(self.m.run_case()['status'],'DECLARATIONS_MATCH')
        self.b.basis['entries']=[]
        self.run_cli(expected_exit=2,prior_output=b'EXISTING_SYNTHETIC_RESULT_MUST_REMAIN\n')

    def test_cli_zero_submission_retains_three_pending_and_unknown_attempts(self):
        decisions=json.loads(self.b.decisions); decisions['decisions']=[]
        self.b.decisions=self.b.enc(decisions)
        self.b.basis['decisions_sha256']=_sha256(self.b.decisions);self.b.basis['entries']=[]
        r=self.run_cli()
        self.assertEqual(r['mapping']['status'],'DECLARATIONS_MATCH')
        self.assertEqual(r['quality']['submitted_decision_coverage'],{'numerator':0,'denominator':3,'fraction':0.0})
        self.assertEqual(r['quality']['counts']['validated_basis_entries'],0)
        self.assertIs(type(r['quality']['counts']['validated_basis_entries']), int)
        coverage = r['quality']['submitted_decision_coverage']
        self.assertIs(type(coverage['numerator']), int)
        self.assertIs(type(coverage['denominator']), int)
        self.assertIs(type(coverage['fraction']), float)

    def test_cli_unverified_evidence_does_not_become_observed_or_approved(self):
        self.b.basis['entries'][0]['evidence_status']='unverified'
        r=self.run_cli()
        self.assertEqual(r['basis_audit']['basis_entries'][0]['evidence_status'],'unverified')
        self.assertEqual(r['quality']['evidence_declarations']['unverified'],1)
        self.assertEqual(r['quality']['evidence_declarations']['observed'],0)


if __name__=='__main__': unittest.main(verbosity=2)
