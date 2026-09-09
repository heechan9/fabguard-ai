# France Enedis and Météo-France preflight

These contracts prepare France slices 2 and 3 without claiming a completed live E2E run.

## Enedis national distribution production

- Official source: [Agrégats segmentés de production électrique au pas 1/2 h – Maille nationale](https://opendata.enedis.fr/datasets/prod)
- Licence: Licence Ouverte / Open Licence 2.0
- Selection: `F5 : Solaire` and `P0 : Total toutes puissances`
- Source measure: injected energy in Wh per half-hour. `mean_power_w` is explicitly derived as `energy_wh × 2`.
- Role: distribution-network aggregate and reconciliation context, not plant telemetry or an independent PV-performance verdict.

The preflight contract intentionally uses Data Fair's `qs` expression. The API silently ignores arbitrary field-name query parameters, so callers must not treat an HTTP 200 response as proof that filtering occurred.

Before a live collector is promoted, run a bounded API audit and verify pagination, period filtering, duplicates, UTC continuity, source licence and redistribution policy. Raw downloads remain local.

## Météo-France hourly station observations

- Official dataset: [Données climatologiques de base - horaires](https://www.data.gouv.fr/fr/datasets/donnees-climatologiques-de-base-horaires/)
- Dataset ID: `6569b4473bedf2e7abad3b72`
- Resource: department 75, period 2020–2024
- Station/year: `75114001 PARIS-MONTSOURIS`, 2024
- Licence: Licence Ouverte / Open Licence 2.0
- Required signals: hourly air temperature `T` (°C) and global radiation `GLO` (J/cm²).

The normalizer preserves the source radiation and derives the hourly mean irradiance with `J/cm² × 10000 / 3600 = W/m²`. Quality-code columns are preserved without inventing undocumented interpretations.

After pulling the branch on the user's PC:

```bat
mkdir "%USERPROFILE%\fabguard-meteofrance-work"
python -m fabguard.integrations.meteo_france_hourly_collect ^
  --year 2024 ^
  --station-id 75114001 ^
  --output "%USERPROFILE%\fabguard-meteofrance-work\paris_montsouris_2024.csv" ^
  --audit-output "%USERPROFILE%\fabguard-meteofrance-work\fetch_audit.json"
frictionless validate "%USERPROFILE%\fabguard-meteofrance-work\paris_montsouris_2024.csv"
```

This weather series is not a Solar Data Tools power input. It is an observed environmental context stream to be joined only after timestamp, location and research-purpose gates are documented.
