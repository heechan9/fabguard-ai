# Country-organized evidence catalog

FabGuard keeps code and compact audit evidence in the same repository while large raw API responses and normalized CSV files remain local when redistribution is not required.

The machine-readable index is [`results/catalog.json`](catalog.json).

## Connected evidence

| Scope | Source | Role | Status | Canonical evidence |
|---|---|---|---|---|
| 🇺🇸 United States | UCI SECOM | Manufacturing risk-ranking evidence | Validated | [V1](v1/) · [Phase 1](phase1/) |
| 🇦🇺 Australia | DKASC Alice Springs 2025 | Observed PV | E2E validated | [Evidence](dkasc-alice-springs-2025/) |
| 🇬🇧 Great Britain | PV_Live 2025 | Estimated PV | E2E validated | [Evidence](pvlive-gb-national-2025/) |
| 🇪🇺/🇧🇪 EU / Belgium | JRC PVGIS Brussels 2020 | Modelled PV reference | E2E validated | [Evidence](pvgis-brussels-2020/) |
| 🇫🇷 France | Enedis 2024 | Distribution-grid estimated PV | E2E validated | [Evidence](enedis-france-national-solar-2024/) |
| 🇫🇷 France | Météo-France Paris 2024 | Observed weather context | Resource contract validated | [Evidence](meteo-france-paris-montsouris-2024/) |

## Admission rule

Every new source must declare:

1. country or supranational scope;
2. provider and stable source identifier;
3. data role such as observed, estimated, reference, weather, manufacturing, or robotics;
4. canonical compact-evidence paths;
5. license, timestamp, unit, hash, missingness, and claim boundaries.

Existing canonical paths are retained so README links, tests, and published reports do not break. The catalog provides the country-first view without copying evidence or rewriting history.

Country grouping is organizational metadata. It does not imply that heterogeneous sources may be pooled into one training set or that FabGuard has demonstrated cross-country model performance.
