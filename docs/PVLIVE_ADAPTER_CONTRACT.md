# Sheffield Solar PV_Live pre-ingestion contract

## Status

**Pre-ingestion contract implemented; live source audit and E2E execution remain pending.**

This document fixes the boundary for the next public-PV integration before any
PV_Live value is admitted to FabGuard evidence.

## Official source facts fixed by this contract

- Provider: Sheffield Solar, The University of Sheffield, with NESO funding.
- Production API host: https://api.pvlive.uk.
- Geographic scope: the **GB electricity network**, not the whole United Kingdom.
- Data role: modelled PV generation **estimate** (estimated), not direct metering.
- Models: national and regional; regional entities are GSP or PES.
- Canonical power field and unit: generation_mw, MW.
- V1 temporal resolution: 30 minutes.
- Timestamp semantics: datetime_gmt is the UTC end of the interval.
- Revision lineage: updated_gmt is mandatory because estimates are revised.

Official references:

- [PV_Live client and service documentation](https://github.com/SheffieldSolar/PV_Live-API)
- [PV_Live REST documentation](https://api.pvlive.uk/pvlive/docs)

## Accepted raw fields

| Field | Contract |
|---|---|
| gsp_id or pes_id | Integer and equal to the requested entity; ID 0 is national |
| datetime_gmt | Valid UTC timestamp aligned to a 30-minute boundary |
| generation_mw | Finite, numeric and non-negative |
| updated_gmt | Valid UTC timestamp, not earlier than the interval end |

The version identity is (entity_type, entity_id, datetime_gmt, updated_gmt).
Exact duplicate identities fail closed. Multiple versions of one interval are
retained; latest_pvlive_snapshot selects the greatest update timestamp only
when a current snapshot is explicitly required.

## Time and DST boundary

PV_Live's canonical clock is UTC/GMT. The contract preserves UTC through
ingestion, including Europe/London DST transitions. It does not convert to
naive UK wall time. A later SDT adapter must choose and test a solar-analysis
clock explicitly; this preflight does not silently resolve the DST problem.

## Dependency and network boundary

The FabGuard core does not import the GPL-3.0 pvlive-api client. A future
fetcher may keep it in an optional integration environment, but normalized data
must pass this independent contract. Tests use local frames, never the live API.

Before the first live fixture is committed, re-check:

1. production host and API response schema;
2. rate/access conditions and service availability;
3. data licensing, attribution and redistribution separately from the Python
   client's GPL-3.0 license;
4. entity list and requested model scope;
5. retrieval time, query parameters and raw/normalized SHA-256 values.

If redistribution rights remain unclear, store only a minimal permissible
fixture or a synthetic contract fixture plus hashes and derived audit evidence.

## Next execution gate

1. Retrieve a small national (gsp_id 0) 30-minute range with updated_gmt.
2. Record retrieval timestamp, API host, query and hashes.
3. Pass the response through normalize_pvlive_frame.
4. Validate the normalized CSV with Frictionless.
5. Test the UTC-versus-Europe/London SDT clock policy across both DST changes.
6. Run SDT and publish evidence only if every earlier gate passes.

## Claim boundary

PV_Live values are model estimates. Passing this contract demonstrates format,
provenance and revision-lineage compatibility only. It is not SECOM external
validation, direct observation, field validation, production-capacity evidence
or proof of PV performance.
