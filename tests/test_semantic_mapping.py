import copy
import json
import unittest
from fabguard.semantic_mapping import diagnose_mapping, ENDPOINT, SEMANTICS, TIMES
from fabguard.manufacturing_review import ManufacturingReviewError, _sha256


def enc(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


class MappingTests(unittest.TestCase):
    def setUp(self):
        self.left = dict(schema_version='fabguard-mapping-source/v1', data_role='synthetic',
            source_id='synthetic-A', namespace='test:A', equipment_id='A-1', property_id='temp-A',
            physical_asset_id='synthetic-asset-1', semantic_id='synthetic-temperature', unit='Cel',
            definition_version='v1', process_step='test-step', recipe_id='test-recipe', recipe_version='r1',
            observed_at='2026-01-01T01:00:00Z', available_at='2026-01-01T01:01:00Z',
            valid_from='2026-01-01T00:00:00Z', valid_until='2026-01-02T00:00:00Z')
        self.right = dict(self.left, source_id='synthetic-B', namespace='test:B', equipment_id='B-2', property_id='temp-B')
        self.contract = dict(schema_version='fabguard-mapping-contract/v1', data_role='synthetic',
            mapping_id='test-map', mapping_version='v1', authority_id='synthetic-reviewer',
            authority_evidence_ref='synthetic:fixture-only', caller_id='test', purpose='offline-test',
            declared_at='2026-01-01T00:00:00Z', valid_from='2026-01-01T00:00:00Z',
            valid_until='2026-01-02T00:00:00Z')
        self.bind()
        self.args = dict(as_of='2026-01-01T02:00:00Z', caller_id='test', purpose='offline-test')

    def bind(self):
        for label in ('left', 'right'):
            source = getattr(self, label)
            self.contract[label] = {k: source.get(k) for k in ENDPOINT}
            self.contract[label + '_sha256'] = _sha256(enc(source))

    def run_case(self):
        return diagnose_mapping(enc(self.left), enc(self.right), enc(self.contract), **self.args)

    def hold(self):
        result = self.run_case()
        self.assertEqual(result['status'], 'HOLD')
        self.assertTrue(result['reasons'])
        self.assertEqual(result['operational_status'], 'WITHHELD')

    def test_matching_declarations_still_withheld(self):
        r = self.run_case()
        self.assertEqual(r['status'], 'DECLARATIONS_MATCH')
        self.assertEqual(r['operational_status'], 'WITHHELD')
        self.assertEqual(r['authority_status'], 'unverified_declaration')
        self.assertEqual(r['source_independence'], 'unverified')
        self.assertEqual(r['evaluation_context'], self.args)

    def test_no_mutation_or_output_alias(self):
        before = copy.deepcopy((self.left, self.right, self.contract))
        result = self.run_case(); result['reasons'].append('edited')
        self.assertEqual(before, (self.left, self.right, self.contract))
        self.assertEqual(self.run_case()['reasons'], [])

    def test_same_name_does_not_map_equipment(self):
        self.right['equipment_id'] = self.left['equipment_id']; self.hold()

    def test_unit_alias_conversion_not_inferred(self):
        self.right['unit'] = 'degC'; self.bind(); self.hold()

    def test_same_source_is_not_two_sources(self):
        self.right['source_id'] = self.left['source_id']; self.bind(); self.hold()

    def test_exact_bytes_binding(self):
        self.assertEqual(diagnose_mapping(enc(self.left)+b' ', enc(self.right), enc(self.contract), **self.args)['status'], 'HOLD')

    def test_invalid_json_raises(self):
        for raw in (b'[]', b'{', b'{"a":1,"a":2}', b'{"x":NaN}'):
            with self.subTest(raw=raw), self.assertRaises(ManufacturingReviewError):
                diagnose_mapping(raw, enc(self.right), enc(self.contract), **self.args)

    def test_missing_contract_is_hold(self):
        self.contract = {}; self.hold()

    def test_no_implicit_operational_mode(self):
        self.left['data_role'] = self.right['data_role'] = self.contract['data_role'] = 'observed'
        self.bind(); self.hold()

    def test_equivalent_offset_timestamp(self):
        self.right['observed_at'] = '2026-01-01T10:00:00+09:00'; self.bind()
        self.assertEqual(self.run_case()['status'], 'DECLARATIONS_MATCH')

    def test_observation_mismatch(self):
        self.right['observed_at'] = '2026-01-01T00:59:59Z'; self.bind(); self.hold()

    def test_expiry_boundary(self):
        self.args['as_of'] = self.contract['valid_until']; self.hold()

    def test_future_availability(self):
        self.right['available_at'] = '2026-01-01T02:00:01Z'; self.bind(); self.hold()

    def test_availability_before_observation(self):
        self.right['available_at'] = '2026-01-01T00:59:59Z'; self.bind(); self.hold()

    def test_future_declaration(self):
        self.contract['declared_at'] = '2026-01-01T02:00:01Z'; self.hold()

    def test_contract_not_valid_at_observation(self):
        self.contract['valid_from'] = self.contract['declared_at'] = '2026-01-01T01:30:00Z'; self.hold()

    def test_inverted_source_interval(self):
        self.left['valid_from'] = self.left['valid_until']; self.bind(); self.hold()

    def test_unknown_fields(self):
        self.contract['approved'] = True; self.hold()

    def test_wrong_caller_and_purpose(self):
        for k in ('caller_id', 'purpose'):
            with self.subTest(k=k):
                old = self.args[k]; self.args[k] = 'other'; self.hold(); self.args[k] = old

    def test_all_semantic_mismatches(self):
        for key in SEMANTICS:
            with self.subTest(key=key):
                old = self.right[key]; self.right[key] = 'mismatch'; self.bind(); self.hold(); self.right[key] = old

    def test_missing_endpoint_fields(self):
        for key in ENDPOINT:
            with self.subTest(key=key):
                old = self.left.pop(key); self.bind(); self.hold(); self.left[key] = old

    def test_bad_endpoint_types(self):
        for value in (None, '', ' ', ' x', True, 123, [], {}):
            with self.subTest(value=value):
                self.left['equipment_id'] = value; self.bind(); self.hold()

    def test_unknown_authority_contract(self):
        for key in ('authority_id', 'authority_evidence_ref', 'mapping_id', 'mapping_version'):
            with self.subTest(key=key):
                old = self.contract[key]; self.contract[key] = None; self.hold(); self.contract[key] = old

    def test_bad_times_hold(self):
        for value in (None, '', '2026-01-01', '2026-01-01T01:00:00', True, [], '9999-12-31T23:59:59-23:00'):
            for key in TIMES:
                with self.subTest(value=value, key=key):
                    old=self.left[key]; self.left[key]=value; self.bind(); self.hold(); self.left[key]=old

    def test_bad_cutoff(self):
        self.args['as_of'] = None; self.hold()

if __name__ == '__main__':
    unittest.main()
