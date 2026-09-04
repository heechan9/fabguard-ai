# Fledge upstream contribution readiness

Status: **research and maintainer-discussion preparation only**

FabGuard has a dependency-free reading contract and local smoke runner. These artifacts prove only
that FabGuard can validate and normalize a deliberately small JSON envelope. They are not a Fledge
plugin, have not run inside Fledge, and do not establish official compatibility.

## Verified upstream constraints

The following points were checked against the Fledge repository's `CONTRIBUTING.md` and plugin
developer guide on 2026-09-04.

- Discuss significant work with maintainers before implementation.
- Open core pull requests against `develop`, not `main`.
- Use a descriptive topic branch that includes the contributor's GitHub username.
- Sign off every upstream commit under the Developer Certificate of Origin using the human
  contributor's real name (`git commit -s`). AI assistance does not replace that sign-off.
- Existing plugins live in separate repositories. A new plugin repository must be requested from
  the maintainers rather than created unilaterally in the Fledge organization.
- A filter must remain destination-agnostic and must not assume a particular north plugin.

## Candidate work, in order

| Priority | Candidate | Why it fits | Decision now |
| --- | --- | --- | --- |
| 1 | Clarify quality metadata and reading-envelope expectations | Directly matches FabGuard's validation boundary; discussion or documentation can be reviewed without claiming runtime integration | Prepare maintainer question |
| 2 | Minimal stateless quality filter | Could reject or annotate malformed readings using generic metadata | Wait for maintainer direction and a repository choice |
| 3 | Stateful drift detection and restart persistence | Useful later, but requires lifecycle, persistence, and reconfiguration decisions | Defer |
| 4 | Core ingestion performance or memory work | Valuable but unrelated to the current Python contract and high-risk for a first contribution | Out of scope |

Relevant existing discussions include
[quality bits #1108](https://github.com/fledge-iot/fledge/issues/1108),
[nested reading payloads #1551](https://github.com/fledge-iot/fledge/issues/1551), and
[state across restarts #1538](https://github.com/fledge-iot/fledge/issues/1538). These issues are
context, not assignments. Before coding, confirm that the problem is still current and whether the
maintainers prefer an existing filter repository, documentation change, or a new plugin proposal.

## Proposed first maintainer message

> We are prototyping a semiconductor-manufacturing data quality boundary in FabGuard. The current
> code only validates a small, independently defined reading envelope (`asset_code`, timestamp, and
> numeric/null measurements); it is not presented as a Fledge plugin or certified compatibility.
> Before implementing anything, could you advise whether a generic, stateless quality-validation
> filter would be useful upstream, and how quality metadata should be represented without coupling
> it to a particular north destination? We can start with documentation and contract tests if that
> is more useful. We have also reviewed #1108 and #1551, but do not want to assume those older
> discussions describe the current preferred design.

Post this only after the project owner approves the wording. Do not include private factory data,
credentials, unpublished vulnerability details, or claims of field validation.

## Engineering gates before an upstream PR

1. Get maintainer confirmation of scope and target repository.
2. Test against a pinned Fledge release or commit in an isolated environment.
3. Add fixtures for malformed timestamps, duplicates, missing values, nested payloads, batches, and
   reconfiguration or restart behavior required by the chosen plugin API.
4. Define fail-open versus fail-closed behavior and a destination-neutral metadata schema.
5. Measure batch latency, memory bounds, and back-pressure behavior; do not infer these properties
   from the local two-reading smoke test.
6. Preserve FabGuard's temporal split, no-test-refit rule, reproducibility metadata, and UI output
   contract. The adapter must not silently retrain or reinterpret anonymous SECOM columns.
7. Rebase from upstream `develop`, run the upstream test suite, use real-name DCO sign-off, and
   disclose material AI assistance in the pull-request description.

## Multi-AI collaboration boundary

Codex owns implementation and test changes on one topic branch. Claude may independently review the
diff, threat model, schema assumptions, and claim boundaries. By default Claude should comment only;
if it proposes code, use a separate branch and human review before cherry-picking. Neither agent may
change workflows, secrets, deployment settings, branch protection, or merge upstream work without
the project owner's explicit approval.

For GitHub access, grant only selected-repository access and the minimum permissions needed to read
contents and review pull requests. Do not grant administration, secrets, Actions/workflow write,
deployment, or branch-protection permissions for review-only work.
