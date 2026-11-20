# Opt-in offline review diagnostics

This is a local synthetic diagnostic caller, not deployment or an AAS integration.
The existing `python -m fabguard.decision_basis` CLI remains unchanged by default.
With `--include-diagnostics`, its output is explicitly a new
`fabguard-review-diagnostics/v1` wrapper, not the legacy basis-audit schema.

```sh
PYTHONPATH=src python -m fabguard.decision_basis \
  --events events.json --history history.json --package package.json \
  --decisions decisions.json --basis basis.json \
  --recorded-at 2026-09-01T00:22:00Z --output diagnostics.json \
  --include-diagnostics
```

The wrapper preserves the original `basis_audit` and existing `quality` output.
Mapping is optional. Omitted mapping is `null` with `NOT_PROVIDED`, not a match.
To include the independent synthetic mapping diagnostic, supply all six:

```
--mapping-left left.json --mapping-right right.json --mapping-contract contract.json
--mapping-as-of 2026-01-01T02:00:00Z
--mapping-caller-id declared-caller --mapping-purpose declared-purpose
```

Mapping evaluation time, caller and purpose are explicit, not inferred from the
review snapshot or populated from contract declarations. Partial requests or
mapping arguments without `--include-diagnostics` fail before writing output.
Invalid review/basis evidence and malformed JSON still raise. Structurally
incomplete mapping declarations remain a visible HOLD diagnostic.

## Non-promotion contract

- The complete existing basis audit, pending entries, human hold decisions,
  quality warnings and mapping HOLD reasons are preserved without reinterpretation.
- No combined approval, score, PASS or decision writeback is produced.
- `observation_linkage_status` is always `NOT_ESTABLISHED`, even for coinciding
  names/times. Independent synthetic mapping fixtures are not joined to review rows.
- `operational_status` is always `WITHHELD`, including mapping matches.
- No authority authentication, physical alias inference, AAS/BaSyx/EDC connection,
  equipment command, release, retraining, field-effect claim or deployment exists.
- Review original-byte hashes and mapping's own original-byte hashes remain visible.

The existing protected single-output writer receives all eight input paths when
mapping is supplied. Output cannot overwrite or alias any input, including via a
symlink or hardlink. Validation happens before writing. This is not a sandbox
against hostile concurrent filesystem changes.

Implementation intentionally reuses public validators; quality revalidates basis
again, avoiding an unchecked prevalidated-result shortcut. No new dependencies,
data split, model, priority ranking, metric or row-level fail comparison changes.

Tests use existing synthetic fixtures only. They verify exact old/new component
output equality and the opted-in CLI. They do not prove a real observation join.

## Disclosure boundary

This is not a redaction, masking or de-identification tool. The original audit
can contain submitted rationale, reviewer roles and evidence text, and mapping
evaluation_context preserves caller_id, purpose and as_of. Such intended input
text may remain verbatim in the local report. Review output before sharing;
synthetic no-echo checks for malformed or unknown fields do not make the whole
report safe to publish. No additional external sharing is performed by this CLI.
