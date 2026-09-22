import copy
import json
from pathlib import Path
import unittest

from fabguard.manufacturing_review import (
    AUDIT_SCHEMA,
    DECISION_SCHEMA,
    EVENT_SCHEMA,
    ManufacturingReviewError,
    QUEUE_SCHEMA,
    build_review_package,
    record_review_decisions,
)


class ManufacturingReviewTests(unittest.TestCase):
    ROOT = Path(__file__).resolve().parents[1]
    @staticmethod
    def source():
        values = [99, 101] * 5 + [100, 130, None]
        readings = []
        for index, value in enumerate(values, 1):
            readings.append({
                "asset_code": "SPI-DEMO-01",
                "user_ts": f"2026-09-01T00:{index:02d}:00Z",
                "reading": {"solder_paste_volume_pct": value},
                "manufacturing": {
                    "lot_id": "SMT-DEMO-L001",
                    "unit_id": f"PCB-{index:03d}",
                    "equipment_id": "SPI-DEMO-01",
                    "process_step": "solder_paste_inspection",
                    "run_id": "RUN-DEMO-001",
                    "recipe_id": "DEMO-SPI",
                    "recipe_version": "v1",
                    "spec_version": "demo-v1",
                    "units": {"solder_paste_volume_pct": "percent"},
                },
            })
        return {
            "schema_version": EVENT_SCHEMA,
            "source_id": "fabguard-smt-3d-synthetic",
            "data_role": "synthetic",
            "measurement": {"name": "solder_paste_volume_pct", "unit": "percent"},
            "readings": readings,
        }

    @staticmethod
    def encode(value):
        return json.dumps(value, allow_nan=False).encode()

    def test_builds_fledge_spc_review_queue_with_traceability(self):
        report, queue = build_review_package(self.encode(self.source()), 10)
        self.assertEqual(report["status"], "review_queue_built")
        self.assertEqual(report["fledge_contract"]["normalized_readings"], 13)
        self.assertEqual(report["spc"]["counts"]["above_limit"], 1)
        self.assertEqual(report["spc"]["counts"]["unknown"], 1)
        self.assertEqual(queue["schema_version"], QUEUE_SCHEMA)
        self.assertEqual([item["screening_status"] for item in queue["items"]],
                         ["above_limit", "unknown"])
        self.assertEqual(queue["items"][0]["trace"]["unit_id"], "PCB-012")
        self.assertEqual(queue["items"][0]["priority_class"], "P1_LIMIT_SIGNAL")
        self.assertEqual(len(queue["items"][0]["event_evidence_sha256"]), 64)
        self.assertNotIn("_tier", queue["items"][0])

    def test_frozen_baseline_is_not_changed_by_monitoring_values(self):
        first, _ = build_review_package(self.encode(self.source()), 10)
        changed = self.source()
        changed["readings"][11]["reading"]["solder_paste_volume_pct"] = 1000
        second, _ = build_review_package(self.encode(changed), 10)
        for key in ("center", "mean_moving_range", "lcl", "ucl"):
            self.assertEqual(first["spc"][key], second["spc"][key])

    def test_rejects_incomplete_or_inconsistent_manufacturing_lineage(self):
        cases = []
        missing = self.source()
        del missing["readings"][0]["manufacturing"]["recipe_version"]
        cases.append(missing)
        mismatched_asset = self.source()
        mismatched_asset["readings"][0]["manufacturing"]["equipment_id"] = "OTHER"
        cases.append(mismatched_asset)
        mixed_recipe = self.source()
        mixed_recipe["readings"][-1]["manufacturing"]["recipe_version"] = "v2"
        cases.append(mixed_recipe)
        wrong_unit = self.source()
        wrong_unit["readings"][0]["manufacturing"]["units"]["solder_paste_volume_pct"] = "kg"
        cases.append(wrong_unit)
        for source in cases:
            with self.subTest(source=source["readings"][0]), self.assertRaises(ManufacturingReviewError):
                build_review_package(self.encode(source), 10)

    def test_records_human_decision_and_preserves_pending_items(self):
        _, queue = build_review_package(self.encode(self.source()), 10)
        review_id = queue["items"][0]["review_id"]
        decisions = {
            "schema_version": DECISION_SCHEMA,
            "decisions": [{
                "review_id": review_id,
                "reviewer_role": "process_engineer",
                "decided_at": "2026-09-01T01:00:00Z",
                "outcome": "insufficient_evidence",
                "action": "reinspect",
                "rationale": "Synthetic signal requires an independent measurement.",
            }],
        }
        audit = record_review_decisions(
            self.encode(queue), self.encode(decisions), recorded_at="2026-09-01T01:05:00Z"
        )
        self.assertEqual(audit["schema_version"], AUDIT_SCHEMA)
        self.assertEqual(audit["counts"], {"total": 2, "decided": 1, "pending": 1})
        self.assertEqual(audit["entries"][0]["state"], "decided")
        self.assertEqual(audit["entries"][1]["state"], "pending")
        self.assertIn("automatically retrain", audit["claim_boundary"])

    def test_decisions_fail_closed_on_unknown_duplicate_or_future_review(self):
        _, queue = build_review_package(self.encode(self.source()), 10)
        decision = {
            "review_id": queue["items"][0]["review_id"],
            "reviewer_role": "quality_engineer",
            "decided_at": "2026-09-01T01:00:00Z",
            "outcome": "false_alarm",
            "action": "release",
            "rationale": "Independent inspection found no issue.",
        }
        invalid_sets = []
        unknown = copy.deepcopy(decision)
        unknown["review_id"] = "unknown"
        invalid_sets.append([unknown])
        invalid_sets.append([decision, copy.deepcopy(decision)])
        future = copy.deepcopy(decision)
        future["decided_at"] = "2026-09-01T02:00:00Z"
        invalid_sets.append([future])
        bad_outcome = copy.deepcopy(decision)
        bad_outcome["outcome"] = "auto_retrain"
        invalid_sets.append([bad_outcome])
        for values in invalid_sets:
            payload = {"schema_version": DECISION_SCHEMA, "decisions": values}
            with self.subTest(values=values), self.assertRaises(ManufacturingReviewError):
                record_review_decisions(
                    self.encode(queue), self.encode(payload), recorded_at="2026-09-01T01:05:00Z"
                )

    def test_review_audit_rejects_tampered_queue_evidence(self):
        _, queue = build_review_package(self.encode(self.source()), 10)
        queue["items"][0]["value"] = 129
        decisions = {"schema_version": DECISION_SCHEMA, "decisions": []}
        with self.assertRaises(ManufacturingReviewError):
            record_review_decisions(
                self.encode(queue), self.encode(decisions), recorded_at="2026-09-01T01:05:00Z"
            )

    def test_rejects_wrong_root_schema_and_unusable_baseline(self):
        wrong = self.source()
        wrong["schema_version"] = "unknown"
        with self.assertRaises(ManufacturingReviewError):
            build_review_package(self.encode(wrong), 10)
        with self.assertRaises(ManufacturingReviewError):
            build_review_package(self.encode(self.source()), 9)
        with self.assertRaises(ManufacturingReviewError):
            build_review_package(b'{"schema_version": NaN}', 10)

    def test_repository_examples_reproduce_a_review_audit(self):
        event_raw = (self.ROOT / "examples/manufacturing/smt_synthetic_events.json").read_bytes()
        decisions_raw = (self.ROOT / "examples/manufacturing/smt_review_decisions.json").read_bytes()
        _, queue = build_review_package(event_raw, 10)
        audit = record_review_decisions(
            json.dumps(queue, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n",
            decisions_raw,
            recorded_at="2026-09-01T01:05:00Z",
        )
        self.assertEqual(audit["counts"], {"total": 2, "decided": 1, "pending": 1})


if __name__ == "__main__":
    unittest.main()
