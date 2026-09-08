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
- Generation series resolution: 30 minutes.
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

It must never become a new source type such as `observed-revised`.

## Fail-closed rules

The contract rejects empty responses, missing fields, ambiguous timestamps,
duplicate timestamps, non-finite or negative solar generation, unsupported
revision states, expected-state mismatches, and gaps in a complete bounded
30-minute page-set. The request builder limits a single audit window to seven
days and an Opendatasoft page to 100 rows.

CET/CEST source offsets are preserved in `source_timestamp`; normalized time
is UTC. DST transitions require an explicit fixture before a year-scale SDT
run.

## Revision closure policy

FabGuard does not poll indefinitely. For the first audit:

1. use an already definitive 2024 window to prove schema and E2E compatibility;
2. record retrieval time, source state and hashes;
3. later sample a consolidated window only to test state handling;
4. do not label a timestamp definitive merely because time elapsed—accept only
   the status published by RTE/ODRÉ;
5. stop polling a timestamp once the official status is definitive.

This respects the monthly call budget and keeps revision evidence auditable.

## PC execution gate

Before promotion to “live API audited”:

1. query a small definitive 2024 window from the official records API;
2. preserve raw JSON outside git;
3. paginate without overlap and prove complete 30-minute coverage;
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
