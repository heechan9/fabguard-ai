# Review receipt declaration diagnostic

Optional read-only `fabguard.review_receipts.diagnose_review_receipts` helps prevent a missing review, a static review, a review of an older commit, or a declared failed command from being summarized as a current executed success. It does not run commands, change CI, authorize merging, or grant operational approval. It is not wired into release workflows.

Inputs are a caller-chosen exact commit, required reviewer names, receipt dictionaries and an in-memory digest-to-bytes map. Missing required reviewers remain MISSING; duplicate/unexpected reviewers are rejected. Receipt fields are reviewer, source_commit, mode, command, exit_code, evidence_sha256. Modes are static, executed and not_run. Static reviews cannot claim commands/exit codes. NOT_RUN cannot include execution evidence. Executed receipts require nonempty argv and an integer exit code. Logs or static notes must have matching SHA-256 bytes. A stale source is recorded alongside the original declared outcome, rather than erasing a failed declaration.

The output always says DECLARATION_LINKAGE_ONLY, operational_approval=false and execution_authenticated=false. `EXECUTION_SUCCESS_DECLARED` means only that supplied fields say exit zero and the supplied bytes match their supplied digest. A fabricated log and self-consistent false declaration will also link. No reviewer identity, genuine execution, full test coverage, approval, current remote head, independent verification or manufacturing performance is established. Evidence text is not parsed or returned. This is not an automatic completion or approval hook.

The existing decision_basis/quality modules concern manufacturing review evidence. The saved-result validators check model artifacts. The private briefing checker checks source excerpts. This function addresses a different handoff: required code reviewers, modes, exact source versions and supplied execution evidence. It does not replace any of those checks.

Motivation: [정민철's public post](https://lnkd.in/p/gESwZsCT) emphasizes evidence-bearing handoffs rather than trusting completion prose. This is a design inspiration, not a certification or proof that a hook makes an agent safe. No post text, third-party images, private logs, user materials, models or result files are included.

Reviewers should inspect actual logs, independently run relevant tests when possible, verify source version and author identity through their trusted channels, and report unexecuted scopes separately. Do not put secrets in commands/logs. Digest-only output does not anonymize the input evidence; sharing original evidence requires its own review.

Test command:

```
PYTHONPATH=src python -B -m unittest discover -s tests -p test_review_receipts.py -v
```

Tests use synthetic bytes only and cover positive/failed/static/not-run/stale/missing/duplicate/mutated evidence, malformed input and immutability. Optimized-mode repeats are not additional unique tests. No model inference, data split change, deployment or field evaluation is involved.
