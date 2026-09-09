# RTE éCO2mix national solar pre-ingestion contract

## Status

**Priority France preflight prepared; no live RTE result has been admitted.**

This is France slice 1 of 3. RTE, Enedis and Météo-France remain separate
contracts because revision lineage, distribution assets and weather have
different schemas and evidentiary meanings.

## Official source facts

- Provider: RTE through Open Data Réseaux Énergies (ODRÉ).
- Dataset: `eco2mix-national-cons-def`.
- Scope: France national electricity system.
- Solar field: `solaire`, MW.
- The records API exposes a 15-minute timestamp envelope, while `solaire` is populated at :00/:30 and structurally null at :15/:45; the admitted generation series is therefore 30 minutes.
- Consolidated values are delivered around the middle of M+1 after checking
  and completion. Definitive values follow after all partners submit and
  verify metering, during the second half of A+1.
- The consolidated/definitive dataset is refreshed daily. The related
  real-time dataset is refreshed every 15 minutes and is subject to a stated
  quota of 50,000 API calls per user per month.

Official pages:

- [National consolidated and definitive éCO2mix dataset](https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/)
- [National real-time éCO2mix dataset](https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/)

## V1 boundary

V1 accepts only the consolidated/definitive dataset and fields:

| Field | Meaning | Contract |
|---|---|---|
| `date_heure` | source timestamp with CET/CEST offset | parse with offset and normalize to UTC |
| `solaire` | national solar generation | finite, non-negative MW |
| `nature` | publication/revision state | consolidated or definitive only |

The revision status remains orthogonal to `source_type`:

- `source_type=estimated`
- `revision_status=consolidated|definitive`

It must never become a new source type such as `observed-revised`. A caller
may require one exact state, or explicitly choose the CLI's `published`
policy to accept both official states while retaining each row's lineage.
The live 2024 audit found 35,132 definitive envelope rows and four consolidated
envelope rows at 2024-12-31 23:00–23:45 UTC; this tail must not be relabelled
as definitive.

## Fail-closed rules

The contract rejects empty responses, missing fields, ambiguous timestamps,
duplicate timestamps, non-finite or negative half-hour solar generation, unexpected
values in structural :15/:45 slots, unsupported revision states, expected-state
mismatches, unexplained gaps in the complete 15-minute response envelope, and
unexplained gaps in the admitted 30-minute generation series. Structural
quarter-hour nulls are counted separately and never treated as missing
generation measurements. The request builder limits a single audit window to
seven days and an Opendatasoft page to 100 rows.

CET/CEST source offsets are preserved in `source_timestamp`; normalized time
is UTC. On an actual `Europe/Paris` offset-transition date only, the collector
accepts the audited RTE API shapes: four byte-for-byte-equivalent duplicate
quarter-hours on the spring transition, or four absent quarter-hours on the
autumn transition. Conflicting duplicates still fail closed. Missing autumn
half-hour generation values are inserted into the continuous UTC grid as null,
never imputed as zero, and are counted in the audit and quality warning.

## Revision closure policy

FabGuard does not poll indefinitely. For the first audit:

1. use an already definitive 2024 window to prove schema and E2E compatibility;
2. record retrieval time, source state and hashes;
3. later sample a consolidated window only to test state handling;
4. do not label a timestamp definitive merely because time elapsed—accept only
   the status published by RTE/ODRÉ;
5. stop polling a timestamp once the official status is definitive.

This respects the monthly call budget and keeps revision evidence auditable.

## Long-range collector

`python -m fabguard.integrations.rte_eco2mix_collect` requests one UTC day at a time. Ordinary daily responses must contain exactly 96 unique quarter-hour rows and match `total_count`. DST transition days use the narrowly bounded 100-row spring or 92-row autumn policy above. The contract removes structural :15/:45 null slots, retains a 48-slot UTC half-hour grid, and records exact duplicate removals, source gaps, missing power and per-chunk hashes without publishing raw responses.

A single run is limited to 366 days. The range is half-open (`start` included, `end` excluded) and both boundaries must be UTC midnight. `--expected-status definitive` or `consolidated` remains strict. `--expected-status published` accepts only those two recognized official states and records their separate counts; it does not promote consolidated rows to definitive.

## PC execution gate

Before promotion to “live API audited”:

1. query a small definitive 2024 window from the official records API;
2. preserve raw JSON outside git;
3. collect non-overlapping UTC days, match every daily `total_count`, prove complete 15-minute envelope coverage except declared DST artifacts, record structural :15/:45 nulls, and preserve any audited source gap as null in the continuous :00/:30 grid;
4. run this contract and Frictionless;
5. run SDT as `source_type=estimated` with UTC;
6. match row counts and SHA-256 across collection and SDT evidence;
7. publish only permitted derived evidence after confirming attribution and
   redistribution terms.

## Remaining France slices

- Enedis: distribution/installed-capacity contract; Open Licence 2.0 has been
  identified on candidate datasets, but a specific dataset and schema must be
  frozen before implementation.
- Météo-France: weather join contract; API access, applicable product licence,
  station/grid identity and redistribution must be audited first.

## Claim boundary

RTE éCO2mix is national aggregate electricity-system data. Contract or E2E
success does not demonstrate plant telemetry, panel-level diagnosis, SECOM
external validation, field performance, production capacity, or causal PV
effects.
