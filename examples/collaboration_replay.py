"""One-question synthetic collaboration replay; not the production audit."""
from hashlib import sha256

VERSION = "synthetic-roster/v1"
ROSTER = ("SYN-01", "SYN-02", "SYN-03")
FIXTURE_DIGEST = sha256(("\n".join(ROSTER) + "\n").encode("ascii")).hexdigest()


def classify(received: tuple[str, ...]) -> str:
    """Identify unexpected IDs before omissions; no fallback facts are invented."""
    expected_ids = set(ROSTER)
    received_ids = set(received)
    if received_ids - expected_ids or len(received_ids) != len(received):
        return "SUBSTITUTED"
    return "MATCH" if received_ids == expected_ids else "MISSING"


def main() -> int:
    cases = (
        (ROSTER, "MATCH"),
        (("SYN-01", "SYN-03"), "MISSING"),
        (("SYN-01", "SYN-99", "SYN-03"), "SUBSTITUTED"),
    )
    print(f"fixture={VERSION} sha256={FIXTURE_DIGEST}")
    passed = True
    for received, expected in cases:
        actual = classify(received)
        print(actual)
        passed = passed and actual == expected
    print("PASS" if passed else "FAIL")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
