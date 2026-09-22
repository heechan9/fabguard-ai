from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ResearchDocumentContractTest(unittest.TestCase):
    def test_named_research_documents_exist_and_are_linked(self):
        paths = (
            ROOT / "RESEARCH_QUESTION.md",
            ROOT / "RELATED_WORK.md",
            ROOT / "docs" / "V2_PROTOCOL.md",
            ROOT / "docs" / "EXTERNAL_DATA_QUALIFICATION.md",
        )
        for path in paths:
            self.assertTrue(path.exists(), path)
            self.assertGreater(len(path.read_text(encoding="utf-8")), 500, path)

        index = (ROOT / "docs" / "README.md").read_text(encoding="utf-8")
        for name in (
            "RESEARCH_QUESTION.md",
            "RELATED_WORK.md",
            "V2_PROTOCOL.md",
            "EXTERNAL_DATA_QUALIFICATION.md",
        ):
            self.assertIn(name, index)

    def test_claim_boundaries_are_explicit(self):
        question = (ROOT / "RESEARCH_QUESTION.md").read_text(encoding="utf-8")
        protocol = (ROOT / "docs" / "V2_PROTOCOL.md").read_text(encoding="utf-8")
        qualification = (ROOT / "docs" / "EXTERNAL_DATA_QUALIFICATION.md").read_text(encoding="utf-8")

        self.assertIn("자동 Fail 판정", question)
        self.assertIn("Top-10%", question)
        self.assertIn("독립 제조 데이터", question)
        self.assertIn("blocked", protocol)
        self.assertIn("재학습·튜닝", protocol)
        for kind in ("Observed", "Estimated", "Reference", "Synthetic"):
            self.assertIn(kind, qualification)


if __name__ == "__main__":
    unittest.main()
