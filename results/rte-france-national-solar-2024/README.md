# RTE éCO2mix national solar — 2024 annual evidence

Actual collection and Solar Data Tools execution completed on 2026-09-23 UTC.
**Engineering E2E validation with a retained quality warning.** This is national
aggregate **estimated** PV data, not measured plant telemetry or manufacturing validation.

## Evidence

| Check | Result |
|---|---|
| Window | 2024-01-01 inclusive to 2025-01-01 exclusive, UTC |
| Daily API envelopes / raw rows | 366 / 35,136 |
| Normalized grid | 17,568 unique, continuous half-hour timestamps |
| Structural null rows removed | 17,566 |
| Spring DST exact duplicate rows removed | 4 |
| Autumn DST missing quarter-hour slots | 4: two power slots and two structural slots |
| Missing power retained | 2, at 2024-10-27 00:00 and 00:30 UTC; never replaced with zero |
| Official revision states | 17,564 definitive, 2 consolidated; 2 inserted missing slots have no source revision |
| Consolidated tail retained | 2024-12-31 23:00 and 23:30 UTC; not promoted to definitive |
| Frictionless 5.19.0 | Valid, 0 structural errors |
| Solar Data Tools 2.1.5 | Executed with CLARABEL; raw/filled matrices both 48 × 366 |
| SDT data quality warning | **true** |
| Input row counts and SHA-256 | Collection and SDT agree |

CSV SHA-256: `1d9ead57da2a081c99adb8c8043194115d46b61bc90fc0163dbfc0dc06ce08e4`.

- [Collection audit and 366 raw-response hashes](fetch_audit.json)
- [Actual SDT report](report.json)
- [Cross-checks and missing/revision timestamps](verification.json)
- [Provider, licence and metadata provenance](source_metadata.json)
- [Installed environment](environment.txt)

The SDT quality score is a software diagnostic, not model accuracy or plant
performance. The report's `capacity`, `inverter clipping`, clearness and other
plant-oriented outputs are preserved for transparency but **must not be read as
physical capacity, inverter faults or panel diagnosis for France's national
aggregate series**. A successful contract does not remove the quality warning.

## Reproduction and provenance

Base code: `1c7979c3ce296db799afacc849f2d2bd57611961`.
The [existing RTE contract](../../docs/RTE_ECO2MIX_ADAPTER_CONTRACT.md), daily request
parameters, DST handling and published-state policy were unchanged. The earlier
44-day checkpoint was verified and reused; all additional daily responses were
validated and retained with their URL, original retrieval time and SHA-256.
Collection resumed serially and then with at most four disjoint daily requests
per batch, without automatic retries. A request error stops further batches.
Raw responses and the normalized CSV remain in the retained private checkpoint,
not duplicated in this repository. No existing official experimental result was overwritten.

For fresh collection (the server may later publish different bytes):

```bash
python -m pip install '.[pv]'
python -m fabguard.integrations.rte_eco2mix_collect \
  --start 2024-01-01T00:00:00Z --end 2025-01-01T00:00:00Z \
  --expected-status published --output /path/to/rte-2024.csv \
  --audit-output /path/to/collection_audit.json
python -m fabguard.integrations.sdt_smoke_cli \
  --input /path/to/rte-2024.csv --timestamp-column timestamp_utc \
  --power-column solar_generation_mw --source-id rte-france-national-solar-2024 \
  --source-type estimated --timezone UTC --power-unit MW \
  --observed-at 2026-09-23T12:07:58.081623Z \
  --output /path/to/report.json
```

The timestamp above records this archived run; use the actual retrieval timestamp
for a new live run. Replaying retained bytes is required for exact hash reproduction.
The 22 RTE and 6 SDT/Frictionless tests passed in this work session.
No SECOM training, field experiment, or external expert review was performed.

## Attribution and licence

Source: **RTE**, via [ODRÉ éCO2mix](https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/).
Provider metadata observed on 2026-09-23 identifies **Licence Ouverte v2.0 (Etalab)**;
source metadata lists modification `2026-07-30T09:38:06+00:00` and data processing
`2026-09-22T22:05:46+00:00`. Original retrieval times are retained per daily response.
[Official licence](https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf)
permits derived reuse with attribution and source-update information. This reuse
is independent and does not imply RTE endorsement.

**Human/AI contribution:** Choi Heechan selected and authorized completion of the
annual RTE verification. Codex resumed collection, executed the unchanged
contracts and SDT, compared provenance and produced this record. This is not a
claim of manual implementation by the user or upstream project contribution.
