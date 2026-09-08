# PV_Live local E2E replay

Run this only in the optional PV environment. The collector makes non-overlapping
requests of at most seven days and fails if any 30-minute UTC interval is absent.

## 1. Sync and install

~~~bat
cd %USERPROFILE%\fabguard-ai-sdt
git switch main
git pull --ff-only origin main
python -m pip install -e ".[pv]"
mkdir "%USERPROFILE%\fabguard-pvlive-work"
~~~

## 2. Collect the 2025 GB national series

~~~bat
python -m fabguard.integrations.pvlive_collect ^
  --start 2025-01-01T00:30:00Z ^
  --end 2026-01-01T00:00:00Z ^
  --entity-type gsp ^
  --entity-id 0 ^
  --output "%USERPROFILE%\fabguard-pvlive-work\pvlive_gb_2025.csv" ^
  --audit-output "%USERPROFILE%\fabguard-pvlive-work\fetch_audit.json"
~~~

Expected structural result: 17,520 half-hour intervals. Do not copy the CSV into
the repository while redistribution permission remains unconfirmed.

## 3. Frictionless

~~~bat
cd %USERPROFILE%\fabguard-pvlive-work
frictionless validate pvlive_gb_2025.csv
~~~

The result must be VALID before SDT is invoked.

## 4. SDT with continuous UTC/GMT analysis clock

PV_Live timestamps are UTC interval ends. The following extracts a single latest
revision per interval and uses UTC as a fixed, DST-free solar-analysis clock.

~~~bat
cd %USERPROFILE%\fabguard-ai-sdt
python -m fabguard.integrations.sdt_smoke_cli ^
  --input "%USERPROFILE%\fabguard-pvlive-work\pvlive_gb_2025.csv" ^
  --timestamp-column interval_end_utc ^
  --power-column generation_mw ^
  --source-id pvlive-gb-national-2025 ^
  --source-type estimated ^
  --timezone UTC ^
  --power-unit MW ^
  --observed-at 2026-09-08T14:21:47Z ^
  --output results\pvlive-gb-national-2025\report.json
~~~

## 5. Verify evidence linkage

~~~bat
python -c "import json; from pathlib import Path; a=json.loads((Path.home()/'fabguard-pvlive-work'/'fetch_audit.json').read_text()); r=json.loads(Path(r'results\pvlive-gb-national-2025\report.json').read_text()); print({'rows_match':a['rows']==r['source']['input_rows'],'hash_match':a['normalized_sha256']==r['source']['input_sha256'],'status':r['status'],'frictionless':r['validation']['frictionless']['valid'],'source_type':r['source']['source_type']})"
~~~

Only the printed Python dictionary is output. Do not paste its individual lines
back into CMD as commands.

## Claim boundary

This is GB national PV model-estimate data. A successful run is evidence of
data-contract and SDT compatibility, not direct metering, SECOM external
validation, field performance, or a causal PV claim.
