import copy
import json
from pathlib import Path
import unittest

from fabguard.maintenance_review import (
    DECISIONS_SCHEMA, ManufacturingReviewError, _canonical_bytes, _sha256,
    build_context_review, record_context_review,
)
from fabguard.manufacturing_review import build_review_package


class MaintenanceReviewTests(unittest.TestCase):
    ROOT = Path(__file__).resolve().parents[1]

    def setUp(self):
        self.events = (self.ROOT / 'examples/manufacturing/smt_synthetic_events.json').read_bytes()
        self.history = json.loads((self.ROOT / 'examples/manufacturing/maintenance_history_synthetic.json').read_bytes())
        self.cutoff = '2026-09-01T00:20:00Z'

    def build(self, history=None, events=None, cutoff=None):
        return build_context_review(events or self.events, self.encode(history or self.history), 10,
                                    as_of=cutoff or self.cutoff)

    @staticmethod
    def encode(value):
        return json.dumps(value, ensure_ascii=False, allow_nan=False).encode()

    def envelope(self, package, action='hold', outcome='insufficient_evidence', index=1):
        return self.encode({'schema_version': DECISIONS_SCHEMA,
            'context_package_sha256': _sha256(package), 'decisions': [{
                'review_id': json.loads(package)['observations'][index]['review_id'],
                'reviewer_role': 'process_engineer', 'decided_at': '2026-09-01T00:21:00Z',
                'outcome': outcome, 'action': action, 'rationale': '정비 뒤 기준선 적합성 확인 필요'}]})

    def record(self, package, envelope):
        return record_context_review(self.events, self.encode(self.history), package, envelope,
                                     recorded_at='2026-09-01T00:22:00Z')

    def test_change_holds_from_effective_time_without_refitting_or_changing_source(self):
        package = self.build()
        self.assertEqual([r['context_state'] for r in package['observations']], ['context_clear','withheld','withheld'])
        original, _ = build_review_package(self.events, 10)
        self.assertEqual(package['reference_limits'], {k: original['spc'][k] for k in ('center','lcl','ucl')})
        self.assertEqual(package['source_input_sha256'], _sha256(self.events))

    def test_a_normal_number_after_maintenance_is_still_withheld(self):
        source = json.loads(self.events)
        source['readings'][11]['reading']['solder_paste_volume_pct'] = 100
        row = self.build(events=self.encode(source))['observations'][1]
        self.assertEqual(row['reference_status'], 'within_limits')
        self.assertEqual(row['context_state'], 'withheld')

    def test_foreign_equipment_and_process_are_not_joined(self):
        for key in ('equipment_id','process_step'):
            history = copy.deepcopy(self.history)
            history['changes'][0][key] = 'OTHER'
            package = self.build(history)
            self.assertEqual([r['context_state'] for r in package['observations']],['context_clear','context_clear','withheld'])
            self.assertEqual(package['observations'][-1]['reasons'],['measurement_missing'])
            self.assertEqual(package['excluded_other_stream_changes'], ['PM-001'])

    def test_change_inside_baseline_blocks_every_later_row(self):
        for kind in ('maintenance','calibration','recipe_change'):
            history = copy.deepcopy(self.history)
            history['changes'][0].update(effective_at='2026-09-01T00:05:00Z', kind=kind)
            self.assertTrue(all('change_inside_baseline' in r['reasons'] for r in self.build(history)['observations']))

    def test_change_at_reference_end_is_inside_baseline(self):
        self.history['changes'][0]['effective_at'] = '2026-09-01T00:10:00Z'
        self.assertTrue(all(r['context_state']=='withheld' for r in self.build()['observations']))

    def test_incomplete_or_short_history_does_not_mean_no_changes(self):
        for update in ({'complete':False}, {'start':'2026-09-01T00:02:00Z'}, {'end':'2026-09-01T00:12:00Z'}):
            history = copy.deepcopy(self.history)
            history['coverage'].update(update)
            self.assertTrue(all('history_coverage_unverified' in r['reasons'] for r in self.build(history)['observations']))

    def test_future_snapshot_is_rejected_instead_of_leaking_late_knowledge(self):
        with self.assertRaisesRegex(ManufacturingReviewError,'unavailable'):
            self.build(cutoff='2026-09-01T00:14:00Z')
        self.history['changes'][0]['available_at'] = '2026-09-01T00:21:00Z'
        with self.assertRaisesRegex(ManufacturingReviewError,'postdates'):
            self.build()

    def test_measurements_cannot_postdate_cutoff(self):
        with self.assertRaisesRegex(ManufacturingReviewError,'measurement after'):
            self.build(cutoff='2026-09-01T00:12:00Z')

    def test_known_scheduled_change_does_not_invalidate_earlier_rows(self):
        self.history['changes'][0]['effective_at'] = '2026-09-01T00:30:00Z'
        package = self.build()
        self.assertEqual([r['context_state'] for r in package['observations']],['context_clear','context_clear','withheld'])
        self.assertEqual(package['timeline'][0]['period'],'scheduled')

    def test_mismatched_scope_role_and_malformed_history_fail_closed(self):
        for key,value in [('equipment_id','OTHER'), ('process_step','OTHER'), ('data_role','observed'), ('available_at','2026-09-01')]:
            history = copy.deepcopy(self.history)
            history[key] = value
            with self.assertRaises(ManufacturingReviewError): self.build(history)
        self.history['coverage']['complete'] = 'true'
        with self.assertRaises(ManufacturingReviewError): self.build()

    def test_duplicate_id_unknown_kind_and_duplicate_json_key_are_rejected(self):
        history = copy.deepcopy(self.history)
        history['changes'].append(copy.deepcopy(history['changes'][0]))
        with self.assertRaises(ManufacturingReviewError): self.build(history)
        self.history['changes'][0]['kind']='unknown'
        with self.assertRaises(ManufacturingReviewError): self.build()
        with self.assertRaises(ManufacturingReviewError):
            build_context_review(self.events,b'{"schema_version":1,"schema_version":2}',10,as_of=self.cutoff)

    def test_long_fields_and_nonfinite_json_are_rejected(self):
        history = copy.deepcopy(self.history)
        history['changes'][0]['description'] = 'x' * 2001
        with self.assertRaises(ManufacturingReviewError): self.build(history)
        with self.assertRaises(ManufacturingReviewError):
            build_context_review(self.events,b'{"value":NaN}',10,as_of=self.cutoff)

    def test_record_reuses_existing_audit_and_keeps_unreviewed_items_pending(self):
        package = self.encode(self.build())
        audit = self.record(package,self.envelope(package))
        self.assertEqual(audit['counts'],{'total':3,'decided':1,'pending':2})
        self.assertEqual(audit['context_package_sha256'],_sha256(package))

    def test_withheld_release_or_resolution_is_blocked(self):
        package = self.encode(self.build())
        for action,outcome in [('release','insufficient_evidence'),('no_action','insufficient_evidence'),('hold','false_alarm')]:
            with self.assertRaisesRegex(ManufacturingReviewError,'cannot be released'):
                self.record(package,self.envelope(package,action,outcome))

    def test_modified_package_or_changed_history_cannot_clear_a_hold(self):
        package = self.build()
        package['observations'][1].update(context_state='context_clear',reasons=[])
        raw = self.encode(package)
        with self.assertRaisesRegex(ManufacturingReviewError,'recomputed'):
            self.record(raw,self.envelope(raw,'release','false_alarm'))
        package = self.encode(self.build())
        self.history['changes'] = []
        with self.assertRaisesRegex(ManufacturingReviewError,'recomputed'):
            self.record(package,self.envelope(package))

    def test_exact_package_binding_and_decision_time_are_checked(self):
        package = self.encode(self.build())
        envelope = json.loads(self.envelope(package))
        envelope['context_package_sha256'] = '0'*64
        with self.assertRaisesRegex(ManufacturingReviewError,'exact context'):
            self.record(package,self.encode(envelope))
        envelope = json.loads(self.envelope(package))
        envelope['decisions'][0]['decided_at']='2026-09-01T00:19:00Z'
        with self.assertRaisesRegex(ManufacturingReviewError,'predates'):
            self.record(package,self.encode(envelope))


if __name__ == '__main__':
    unittest.main()
