"""Synthetic-only tests: no benchmark labels, files, model or held-out rows."""

import copy
import json
import unittest

from fabguard.robot_screening import (FEATURE_COLUMNS, METADATA, assess_batch,
                                     assess_features, manifest_digest, validate_manifest)


BINDING = {"model_sha256": "a" * 64, "feature_csv_sha256": "b" * 64,
           "protocol": "disjoint_recording_groups"}


def fixture():
    row = dict(zip(METADATA, ("synthetic-inspection", "weight00", "BckgA")))
    row.update({column: 1.0 for column in FEATURE_COLUMNS})
    manifest = {"schema_version": 1, **BINDING, "feature_columns": list(FEATURE_COLUMNS),
                "training_membership": [
                    {"segment_id": "synthetic-training", "recording_group": "synthetic-group",
                     "domain_shift_op": "weight00", "domain_shift_env": "BckgA"}]}
    manifest["manifest_sha256"] = manifest_digest(manifest)
    return row, manifest


class RobotScreeningTest(unittest.TestCase):
    def assess(self, row=None, manifest=None, **binding):
        default_row, default_manifest = fixture()
        return assess_features(default_row if row is None else row,
                               default_manifest if manifest is None else manifest,
                               **(BINDING | binding))

    def test_good_synthetic_contract_never_scores_or_declares_normal(self):
        report = self.assess()
        self.assertEqual(report["gate_status"], "passed")
        self.assertEqual(report["condition_status"], "seen_in_training")
        self.assertEqual(report["overall_status"], "abstain")
        self.assertIsNone(report["score"])
        self.assertIsNone(report["batch_rank"])
        self.assertEqual(report["raw_sensor_quality"], "not_evaluated")
        self.assertEqual(report["time_sync"], "not_verifiable")
        self.assertEqual(set(report), {"segment_id", "input_status", "input_reasons", "valid_fractions",
                         "raw_sensor_quality", "time_sync", "manifest_status", "manifest_reasons",
                         "condition_status", "condition_reasons", "gate_status", "overall_status",
                         "overall_reasons", "score", "batch_rank", "claim_boundary"})
        json.dumps(report, allow_nan=False)

    def test_feature_schema_matches_unchanged_benchmark_extraction(self):
        import numpy as np
        from fabguard.robot_benchmark import SENSORS, channel_features
        columns = []
        for sensor, channels in SENSORS.items():
            for channel in channels:
                suffix = channel.split(" ")[0].replace("[", "").replace("]", "").replace("_", "")
                columns.extend(channel_features(np.array([1.0, 2.0]), f"{sensor}_{suffix}"))
        self.assertEqual(tuple(columns), FEATURE_COLUMNS)
        self.assertEqual(len(columns), 42)

    def test_missing_feature_and_unknown_condition_both_survive(self):
        row, _ = fixture()
        del row[FEATURE_COLUMNS[0]]
        row["domain_shift_op"] = "weight99"
        report = self.assess(row)
        self.assertIn(f"{FEATURE_COLUMNS[0]}:missing", report["input_reasons"])
        self.assertEqual(report["condition_status"], "unknown_value")
        self.assertIn("domain_shift_op:unknown_value", report["overall_reasons"])

    def test_missing_and_unknown_condition_reasons_coexist(self):
        row, _ = fixture()
        row["domain_shift_op"] = None
        row["domain_shift_env"] = "unknown"
        report = self.assess(row)
        self.assertEqual(report["condition_status"], "missing")
        self.assertEqual(len(report["condition_reasons"]), 2)
        self.assertEqual(report["input_status"], "feature_contract_passed")

    def test_conditions_exact_vocabulary_not_normalized(self):
        for value in ("Weight00", "weight00 ", " weight00", "weight99", 0, [], {}):
            with self.subTest(value=value):
                row, _ = fixture()
                row["domain_shift_op"] = value
                self.assertEqual(self.assess(row)["condition_status"], "unknown_value")
        for value in (None, "", " "):
            row, _ = fixture()
            row["domain_shift_env"] = value
            self.assertEqual(self.assess(row)["condition_status"], "missing")

    def test_known_untrained_combination_is_not_unknown(self):
        row, manifest = fixture()
        for op, env in (("weight20", "BckgA"), ("weight25", "BckgB"), ("weight00", "BckgC")):
            row.update(domain_shift_op=op, domain_shift_env=env)
            report = self.assess(row, manifest)
            self.assertEqual(report["condition_status"], "known_untrained")
            self.assertEqual(report["gate_status"], "withheld")

    def test_protocol_specific_membership_changes_coverage_not_verdict(self):
        row, strict = fixture()
        row["domain_shift_op"] = "weight20"
        published = copy.deepcopy(strict)
        published["protocol"] = "published_split"
        published["model_sha256"] = "c" * 64
        published["training_membership"].append({
            "segment_id": "synthetic-published-only", "recording_group": "synthetic-other-group",
            "domain_shift_op": "weight20", "domain_shift_env": "BckgA"})
        published["manifest_sha256"] = manifest_digest(published)
        self.assertEqual(self.assess(row, strict)["condition_status"], "known_untrained")
        report = self.assess(row, published, protocol="published_split", model_sha256="c" * 64)
        self.assertEqual(report["condition_status"], "seen_in_training")
        self.assertEqual(report["overall_status"], "abstain")
        self.assertIsNone(report["score"])

    def test_feature_order_required_metadata_order_irrelevant(self):
        row, _ = fixture()
        reordered = {**{key: row[key] for key in reversed(METADATA)},
                     **{key: row[key] for key in FEATURE_COLUMNS}}
        self.assertEqual(self.assess(reordered)["gate_status"], "passed")
        reversed_features = {**{key: row[key] for key in METADATA},
                             **{key: row[key] for key in reversed(FEATURE_COLUMNS)}}
        self.assertIn("feature_columns_missing_or_reordered", self.assess(reversed_features)["input_reasons"])

    def test_rejects_all_label_and_unexpected_columns(self):
        for column in ("anomaly_label", "split_label", "split", "label", "score", "extra"):
            row, _ = fixture()
            row[column] = "normal"
            self.assertIn("unexpected_columns", self.assess(row)["input_reasons"])

    def test_rejects_nonnumeric_nonfinite_and_huge_integer(self):
        for value in (None, "1", "nan", True, [], {}, float("nan"), float("inf"), -float("inf"), 10**1000):
            with self.subTest(value_type=type(value).__name__):
                row, _ = fixture()
                row[FEATURE_COLUMNS[0]] = value
                report = self.assess(row)
                self.assertEqual(report["input_status"], "invalid")
                self.assertEqual(report["gate_status"], "withheld")
                json.dumps(report, allow_nan=False)

    def test_all_nonmean_statistics_have_mathematical_bounds(self):
        for column in FEATURE_COLUMNS:
            row, _ = fixture()
            row[column] = -0.1
            report = self.assess(row)
            self.assertEqual(report["gate_status"], "passed" if column.endswith("_mean") else "withheld")

    def test_each_channel_partial_missingness_withheld_without_imputation(self):
        for column in FEATURE_COLUMNS:
            if not column.endswith("_valid_fraction"):
                continue
            for value in (0, 0.5, 0.999999, 1.1):
                row, _ = fixture()
                row[column] = value
                self.assertEqual(self.assess(row)["gate_status"], "withheld")

    def test_manifest_required_even_for_good_input(self):
        row, _ = fixture()
        for manifest in (None, [], "", 42, {}):
            report = assess_features(row, manifest, **BINDING)
            self.assertEqual(report["manifest_status"], "invalid")
            self.assertEqual(report["condition_status"], "not_evaluated")
            self.assertEqual(report["gate_status"], "withheld")

    def test_unknown_condition_still_reported_without_manifest(self):
        row, _ = fixture()
        row["domain_shift_op"] = "invalid"
        report = assess_features(row)
        self.assertEqual(report["condition_status"], "unknown_value")
        self.assertTrue(report["manifest_reasons"])

    def test_model_data_and_protocol_bindings_independent(self):
        for key, value in (("model_sha256", "c" * 64), ("feature_csv_sha256", "d" * 64),
                           ("protocol", "published_split")):
            report = self.assess(**{key: value})
            self.assertIn(f"{key}_mismatch", report["manifest_reasons"])
            self.assertEqual(report["gate_status"], "withheld")

    def test_invalid_expected_binding_cannot_match_its_way_to_pass(self):
        row, manifest = fixture()
        manifest["model_sha256"] = "bad"
        manifest["manifest_sha256"] = manifest_digest(manifest)
        report = self.assess(row, manifest, model_sha256="bad")
        self.assertIn("invalid_expected_binding", report["manifest_reasons"])

    def test_manifest_feature_order_must_match_even_with_fresh_hash(self):
        _, manifest = fixture()
        manifest["feature_columns"].reverse()
        manifest["manifest_sha256"] = manifest_digest(manifest)
        self.assertIn("feature_schema_mismatch", self.assess(manifest=manifest)["manifest_reasons"])

    def test_manifest_digest_is_canonical_and_tampering_detected(self):
        _, manifest = fixture()
        reordered = dict(reversed(list(manifest.items())))
        self.assertEqual(manifest_digest(manifest), manifest_digest(reordered))
        manifest["training_membership"][0]["domain_shift_op"] = "weight20"
        self.assertIn("manifest_digest_mismatch", self.assess(manifest=manifest)["manifest_reasons"])

    def test_malformed_manifest_membership_fail_closed(self):
        for members in ([], None, {}, [None], [{}], [{"segment_id": "a"}]):
            _, manifest = fixture()
            manifest["training_membership"] = members
            manifest["manifest_sha256"] = manifest_digest(manifest)
            self.assertTrue(validate_manifest(manifest, **BINDING))

    def test_duplicate_training_ids_and_invalid_conditions_rejected(self):
        _, manifest = fixture()
        manifest["training_membership"] *= 2
        manifest["manifest_sha256"] = manifest_digest(manifest)
        self.assertIn("training_member_duplicate", self.assess(manifest=manifest)["manifest_reasons"])
        for key, value in (("domain_shift_op", "weight99"), ("recording_group", ""), ("segment_id", [])):
            _, manifest = fixture()
            manifest["training_membership"][0][key] = value
            manifest["manifest_sha256"] = manifest_digest(manifest)
            self.assertTrue(validate_manifest(manifest, **BINDING))

    def test_unknown_fields_wrong_version_and_non_json_manifest_rejected(self):
        for key, value in (("extra", 1), ("schema_version", True), ("schema_version", 2),
                           ("training_membership", {1, 2})):
            _, manifest = fixture()
            manifest[key] = value
            self.assertTrue(validate_manifest(manifest, **BINDING))

    def test_non_json_array_manifest_fields_abstain_instead_of_raising(self):
        import numpy as np
        bad = np.array(["bad", "bad"])
        for key in ("feature_columns", "protocol"):
            _, manifest = fixture()
            manifest[key] = bad
            self.assertEqual(self.assess(manifest=manifest)["gate_status"], "withheld")
        for key in ("domain_shift_op", "domain_shift_env"):
            _, manifest = fixture()
            manifest["training_membership"][0][key] = bad
            self.assertEqual(self.assess(manifest=manifest)["gate_status"], "withheld")
        for key in BINDING:
            self.assertEqual(self.assess(**{key: bad})["gate_status"], "withheld")
        _, manifest = fixture()
        manifest["feature_columns"] = [bad]
        self.assertEqual(self.assess(manifest=manifest)["gate_status"], "withheld")

    def test_nonmapping_row_is_not_evaluated_for_conditions(self):
        for row in (None, [], "bad", 1):
            report = assess_features(row)
            self.assertEqual(report["condition_status"], "not_evaluated")
            self.assertIn("row_not_mapping", report["input_reasons"])

    def test_duplicate_ids_withhold_all_occurrences_not_other_rows(self):
        row, manifest = fixture()
        other = copy.deepcopy(row)
        other["segment_id"] = "another-synthetic-inspection"
        reports = assess_batch([row, row, other], manifest, **BINDING)
        self.assertEqual([r["gate_status"] for r in reports], ["withheld", "withheld", "passed"])
        self.assertTrue(all(r["score"] is None and r["batch_rank"] is None for r in reports))
        self.assertTrue(all("duplicate_segment_id" in r["input_reasons"] for r in reports[:2]))

    def test_empty_or_nonlist_batch_rejected(self):
        for rows in ([], None, {}, (fixture()[0],)):
            with self.assertRaises(ValueError):
                assess_batch(rows)

    def test_input_and_manifest_not_mutated(self):
        row, manifest = fixture()
        before = copy.deepcopy((row, manifest))
        assess_batch([row, row], manifest, **BINDING)
        self.assertEqual((row, manifest), before)


if __name__ == "__main__":
    unittest.main()
