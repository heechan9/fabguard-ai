# JRC PVGIS pre-ingestion contract

## Status

**Contract and offline tests prepared; no live PVGIS result has been admitted.**

This is the European reference-data adapter boundary. It prepares one bounded
live audit after the GB PV_Live E2E, without presenting planning work as a
completed connection.

## Official service facts

- Provider: European Commission Joint Research Centre (JRC).
- Version-pinned endpoint: `https://re.jrc.ec.europa.eu/api/v5_3/seriescalc`.
- Method: GET only.
- Output: JSON (`outputformat=json`, `browser=0`).
- Role in FabGuard: `reference` — modelled radiation and PV-production
  estimates, never observed plant telemetry.
- The API limit is 30 calls per second per IP. HTTP 429 means rate limiting;
  HTTP 529 means overloaded and must be retried later. FabGuard's first audit
  uses one bounded request and no parallel fan-out.
- Browser-side AJAX is not allowed; collection must run from the local Python
  adapter or another server-side process.

Official reference:
[JRC PVGIS API non-interactive service](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en)

## Fixed first-audit request

The request builder requires explicit latitude, longitude, start/end year,
nominal peak power (kW), loss (%), and radiation database. It fixes:

- `pvcalculation=1`
- `outputformat=json`
- `browser=0`
- explicit API version `v5_3`
- default European database `PVGIS-SARAH3`

Coordinates and system values are example configuration until a target site is
chosen; they must not be described as a real FabGuard installation.

## Accepted hourly fields

| PVGIS field | Normalized field | Unit / meaning |
|---|---|---|
| `time` | `timestamp_utc` | UTC, exact `YYYYMMDD:HHMM` |
| `P` | `power_w` | modelled PV output, W |
| `G(i)` | `plane_irradiance_w_m2` | plane-of-array irradiance, W/m² |
| `H_sun` | `sun_height_deg` | solar elevation, degrees |
| `T2m` | `air_temperature_c` | air temperature, °C |
| `WS10m` | `wind_speed_10m_m_s` | wind speed, m/s |
| `Int` | `reconstructed` | PVGIS reconstruction flag, 0 or 1 |

The contract rejects missing top-level metadata, empty output, missing fields,
invalid or duplicate timestamps, non-hourly gaps, non-finite values, negative
power/radiation/sun-height/wind, and invalid reconstruction flags. A non-zero
minute offset is allowed because PVGIS hourly timestamps can use the radiation
database's representative minute; continuity, not `:00`, is the invariant.

## Provenance and redistribution gate

The first live audit must record the complete request parameters, retrieval
time, chosen radiation database, raw/canonical response SHA-256, adapter
version, and normalized artifact SHA-256. Before publishing any raw fixture,
confirm the reuse and attribution terms applicable to both PVGIS output and its
underlying radiation database. If uncertain, publish only a minimal permitted
fixture or hashes and derived audit evidence.

## Next PC execution gate

1. Pull the branch after CI passes.
2. Make one bounded one-year `seriescalc` request for an explicitly documented
   European coordinate and configuration.
3. Save raw JSON outside git, then pass it through
   `normalize_pvgis_payload`.
4. Validate the normalized CSV with Frictionless.
5. Run the SDT adapter as `--source-type reference`, preserving UTC.
6. Commit only permitted evidence, hashes, request metadata and claim boundary.

Passing these steps changes the status to “live API audited”; it still does not
make PVGIS observed or field data.

## Claim boundary

JRC PVGIS values are modelled reference data. Passing this contract shows
schema, unit, timestamp and provenance compatibility only. It is not SECOM
external validation, direct observation, field validation, production capacity
evidence, or proof of PV performance.
