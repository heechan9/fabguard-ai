"""Contract tests for the isolated sidecar, not a model accuracy benchmark."""
import copy
import unittest

from qualify import lookup, sidecar


class QualificationTests(unittest.TestCase):
    def setUp(self):
        self.record = {"uri": "https://example.org/WetClean", "label": "wet clean",
                       "source_url": "https://example.org/pinned-source", "source_sha256": "a" * 64}
        self.index = {"wet clean": [self.record]}

    def test_format_variations_keep_source(self):
        for query in ("WET_CLEAN", " wet-clean ", "wet   clean"):
            result = lookup(self.index, query)
            self.assertEqual(result["status"], "candidate_exact_label")
            self.assertEqual(result["matches"][0]["source_sha256"], "a" * 64)

    def test_no_fuzzy_match_or_unverified_translation(self):
        for query in ("clean", "wet cleaning", "습식 세정", "unicorn"):
            self.assertEqual(lookup(self.index, query)["status"], "abstain_no_exact_label")

    def test_anonymous_features_abstain_even_if_index_has_label(self):
        for query in ("SECOM feature_001", "feature_001"):
            self.assertEqual(lookup({query.replace("_", " ").lower(): [self.record]}, query)["status"],
                             "abstain_anonymous")

    def test_two_different_concepts_are_ambiguous(self):
        self.index["wet clean"].append({**self.record, "uri": "https://example.org/Other"})
        self.assertEqual(lookup(self.index, "wet clean")["status"], "abstain_ambiguous")

    def test_same_concept_in_multiple_files_is_not_ambiguous(self):
        self.index["wet clean"].append({**self.record, "source_url": "https://example.org/other-file"})
        self.assertEqual(lookup(self.index, "wet clean")["status"], "candidate_exact_label")

    def test_sidecar_preserves_evidence_and_does_not_infer_actions(self):
        queue = {"items": [{"review_id": "synthetic-test", "trace": {"process_step": "wet_clean"},
                            "priority_class": "P1_LIMIT_SIGNAL", "event_evidence_sha256": "b" * 64}]}
        before = copy.deepcopy(queue)
        result = sidecar(self.index, queue)
        self.assertEqual(queue, before)
        self.assertEqual(result["items"][0]["process_context"]["status"], "candidate_exact_label")
        self.assertNotIn("action", result["items"][0])
        self.assertEqual(len(result["queue_sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
