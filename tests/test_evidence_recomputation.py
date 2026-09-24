"""Mutations must fail without calling the model/evaluation implementation."""
import csv
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from verification.recompute_v1 import average_precision, read_csv, read_json, recompute
from verification.source_clarifications import validate_registry, verify_source

ROOT = Path(__file__).resolve().parents[1]


class RecomputeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.results = Path(self.temp.name) / "v1"
        shutil.copytree(ROOT / "results/v1", self.results)

    def csv_change(self, name, mutate):
        path = self.results / name
        rows = read_csv(path.read_bytes())
        headers = list(rows[0])
        mutate(rows)
        with path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)

    def test_canonical_results_and_read_only(self):
        before = {p.name: p.read_bytes() for p in self.results.iterdir() if p.is_file()}
        report = recompute(self.results)
        self.assertEqual(report["sample_count"], 392)
        self.assertEqual(report["metrics"]["fn"], 24)
        self.assertAlmostEqual(report["metrics"]["pr_auc_average_precision"], 0.09347718147533737)
        self.assertEqual([r["captured_fail"] for r in report["top_k"]], [4, 5, 7])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.results.iterdir() if p.is_file()})
        for name, digest in report["input_sha256"].items():
            self.assertEqual(digest, hashlib.sha256(before[name]).hexdigest())

    def test_average_precision_ties_use_complete_group(self):
        rows = [dict(score=0.8, label=1), dict(score=0.8, label=0), dict(score=0.2, label=1)]
        self.assertAlmostEqual(average_precision(rows), 7 / 12)
        self.assertEqual(average_precision(rows), average_precision(list(reversed(rows))))

    def test_committed_report_matches_recomputed_evidence(self):
        snapshot = read_json((ROOT / "results/verification/v1_recompute.json").read_bytes())
        report = recompute(self.results)
        for key, value in report.items():
            if key != "python":  # CI may use a different supported Python version.
                self.assertEqual(snapshot[key], value, key)

    def test_prediction_mutations_fail(self):
        original = (self.results / "priority_table.csv").read_bytes()
        cases = [("risk_score", "NaN"), ("risk_score", "Infinity"), ("risk_score", "1.1"),
                 ("risk_score", "0.5"), ("risk_score", "0.001"), ("prediction", "1"),
                 ("label", "1"), ("label", "2"), ("rank", "2"), ("rank", "1.1"),
                 ("model", "other-model"), ("timestamp", "2000-01-01"), ("sample_id", "unknown")]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                (self.results / "priority_table.csv").write_bytes(original)
                self.csv_change("priority_table.csv", lambda rows: rows[0].update({field: value}))
                with self.assertRaises(ValueError):
                    recompute(self.results)

    def test_duplicate_or_missing_samples_fail(self):
        original = (self.results / "priority_table.csv").read_bytes()
        for mutate in (lambda rows: rows.pop(), lambda rows: rows[1].update(sample_id=rows[0]["sample_id"])):
            (self.results / "priority_table.csv").write_bytes(original)
            self.csv_change("priority_table.csv", mutate)
            with self.assertRaises(ValueError):
                recompute(self.results)

    def test_metric_mutations_fail(self):
        for name, field in (("test_metrics.csv", "pr_auc_average_precision"),
                            ("test_metrics.csv", "fn"), ("top_k_test.csv", "lift"),
                            ("top_k_test.csv", "inspection_count")):
            with self.subTest(name=name, field=field):
                path = self.results / name
                original = path.read_bytes()
                def mutate(rows):
                    row = next((r for r in rows if r.get("family") == "random_forest"), rows[0])
                    row[field] = "123"
                self.csv_change(name, mutate)
                with self.assertRaises(ValueError):
                    recompute(self.results)
                path.write_bytes(original)

    def test_budget_omission_fails(self):
        self.csv_change("top_k_test.csv", lambda rows: rows.pop())
        with self.assertRaises(ValueError):
            recompute(self.results)

    def test_config_disagreement_fails(self):
        path = self.results / "config.json"
        config = json.loads(path.read_text())
        config["test_size"] = 391
        path.write_text(json.dumps(config))
        with self.assertRaises(ValueError):
            recompute(self.results)

    def test_duplicate_selected_metrics_fail(self):
        self.csv_change("test_metrics.csv", lambda rows: rows.append(next(r for r in rows if r["family"] == "random_forest")))
        with self.assertRaises(ValueError):
            recompute(self.results)

    def test_malformed_inputs_fail(self):
        for raw in (b'{"a":1,"a":2}', b'{"a":NaN}'):
            with self.assertRaises(ValueError):
                read_json(raw)
        for raw in (b'a,a\n1,2\n', b'a,b\n1\n', b'a,b\n1,2,3\n', b'a,b\n'):
            with self.assertRaises(ValueError):
                read_csv(raw)


class ClarificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "synthetic.csv"
        self.source.write_bytes(b"synthetic_volume\n3\n")
        self.record = dict(id="synthetic-1", dataset_id="synthetic-only",
                           source_sha256=hashlib.sha256(self.source.read_bytes()).hexdigest(),
                           field="volume_unit", previous_interpretation="litres",
                           corrected_interpretation="kilolitres", reason="Synthetic test correction",
                           evidence_reference="synthetic://test-fixture", reviewer="Synthetic test reviewer",
                           recorded_at="2026-09-23T00:00:00Z", status="confirmed", supersedes=None)
        self.registry = dict(schema="fabguard.source-clarifications.v1", records=[self.record])

    def test_empty_real_registry_has_no_source_validation(self):
        registry = read_json((ROOT / "docs/data/source_clarifications.json").read_bytes())
        report = validate_registry(registry)
        self.assertFalse(report["source_bytes_verified"])
        self.assertFalse(report["provider_identity_verified"])

    def test_binding_preserves_source(self):
        before = self.source.read_bytes()
        report = verify_source(self.registry, "synthetic-1", self.source)
        self.assertTrue(report["source_bytes_verified"])
        self.assertFalse(report["data_modified"])
        self.assertFalse(report["provider_identity_verified"])
        self.assertEqual(before, self.source.read_bytes())

    def test_wrong_source_fails(self):
        self.source.write_bytes(b"different source")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            verify_source(self.registry, "synthetic-1", self.source)

    def test_missing_evidence_or_invalid_hash_fails(self):
        for field, value in (("evidence_reference", ""), ("reviewer", ""),
                             ("source_sha256", "not-a-hash"), ("recorded_at", "2026-09-23"),
                             ("supersedes", "missing")):
            with self.subTest(field=field):
                old = self.record[field]
                self.record[field] = value
                with self.assertRaises(ValueError):
                    validate_registry(self.registry)
                self.record[field] = old

    def test_proposed_is_not_verified(self):
        self.record["status"] = "proposed"
        validate_registry(self.registry)
        with self.assertRaisesRegex(ValueError, "not confirmed"):
            verify_source(self.registry, "synthetic-1", self.source)

    def test_supersession_preserves_history(self):
        successor = dict(self.record, id="synthetic-2", supersedes="synthetic-1",
                         previous_interpretation="kilolitres", corrected_interpretation="daily kilolitres")
        self.registry["records"].append(successor)
        validate_registry(self.registry)
        with self.assertRaisesRegex(ValueError, "superseded"):
            verify_source(self.registry, "synthetic-1", self.source)
        verify_source(self.registry, "synthetic-2", self.source)
        self.assertEqual(len(self.registry["records"]), 2)

    def test_confirmation_appends_without_rewriting_proposal(self):
        self.record["status"] = "proposed"
        self.registry["records"].append(dict(self.record, id="synthetic-confirmed",
                                             status="confirmed", supersedes="synthetic-1"))
        verify_source(self.registry, "synthetic-confirmed", self.source)
        self.assertEqual(self.record["status"], "proposed")

    def test_duplicate_or_forked_records_fail(self):
        self.registry["records"].append(dict(self.record))
        with self.assertRaises(ValueError):
            validate_registry(self.registry)
        self.registry["records"][-1]["id"] = "synthetic-2"
        with self.assertRaisesRegex(ValueError, "duplicate clarification root"):
            validate_registry(self.registry)

    def test_forked_chain_and_scope_changes_fail(self):
        successor = dict(self.record, id="synthetic-2", supersedes="synthetic-1",
                         previous_interpretation="kilolitres", corrected_interpretation="daily kilolitres")
        self.registry["records"].append(successor)
        self.registry["records"].append(dict(successor, id="synthetic-3"))
        with self.assertRaisesRegex(ValueError, "forked"):
            validate_registry(self.registry)
        self.registry["records"].pop()
        successor["dataset_id"] = "different-dataset"
        with self.assertRaisesRegex(ValueError, "scope mismatch"):
            validate_registry(self.registry)

    def test_invalid_registry_root_fails(self):
        for value in (None, [], "invalid"):
            with self.assertRaisesRegex(ValueError, "must be an object"):
                validate_registry(value)


if __name__ == "__main__":
    unittest.main()
