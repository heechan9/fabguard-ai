# FDC 강의 문서 보완 검증 (2026-10-26 한국시간)

## 범위와 재현

기준 main: `cce8360fba1920fa8465da79dbd3b35cee2c4ae8`. 확정 head는 이 파일을 포함한 Draft PR 본문에 기록한다. 문서·기존 결과 읽기만 변경했다. 새 모델·학습·임계값·분할·웹 코드·원본 JSON을 바꾸지 않았다.

환경: Python 3.12.14, Node v24.22.1, numpy 2.3.5, pandas 2.2.3, scikit-learn 1.8.0. 새 의존성 설치 없음. 랜덤 실험 없음(seed 해당 없음).

| 실행 명령 | 결과 | 원문 |
|---|---|---|
| `PYTHONPATH=src python -m unittest discover -s tests -v` | 287개 중 281 통과·6 생략, 실패 0 | [Python 로그](FDC_20261026_python.log) |
| `node --test tests/web/*.test.mjs` | 120 통과·실패 0 | [웹 로그](FDC_20261026_web.log) |

Python 생략: `test_data.DataTest.test_official_data_contract` (공식 SECOM 원본 없음), `test_robot_window_spc.ParquetLoaderRobotExtra`의 `test_bound_parquet_run_end_to_end`, `test_corrupt_verified_parquet_bytes_make_file_invalid_not_crash`, `test_loader_requires_exact_columns` (선택 pyarrow 없음), `test_sdt_frictionless.FrictionlessGateTest`의 `test_accepts_named_timestamp_and_numeric_power`, `test_rejects_blank_header_before_sdt` (선택 Frictionless 없음). 저장소 CI robot-extra가 Parquet를 별도 검사하며 이 로컬 실행에서 실행했다고 하지 않는다.

추가 직접 대조: 저장된 report.json 바이트 SHA-256이 execution_evidence.json의 `report_sha256`과 일치. 파일별 windows_complete/evaluable 합계 1,043, raw_alarms 합계 9/0/3, episodes 합계 6/0/2 및 performance 4개 null을 summary.json과 대조해 일치. 수정한 안내 6문서의 기존·추가 상대 링크 대상 162개 존재 확인. 아래 명령으로 숫자를 재현할 수 있다.

```bash
python - <<'PY'
import hashlib, json
from pathlib import Path
p = Path('docs/review/pr173-validation-20261024/robot_spc_results')
r = json.loads((p / 'report.json').read_text())
s = json.loads((p / 'summary.json').read_text())
e = json.loads((p / 'execution_evidence.json').read_text())
assert hashlib.sha256((p / 'report.json').read_bytes()).hexdigest() == e['report_sha256']
assert sum(f['windows_evaluable'] for f in r['evaluation_files']) == s['evaluation_evaluable_windows'] == 1043
assert sum(f['windows_complete'] for f in r['evaluation_files']) == 1043
for method in s['methods']:
    for key in ['raw_alarms', 'episodes']:
        assert sum(f['methods'][method][key] for f in r['evaluation_files']) == s['methods'][method][key]
assert all(r['performance'][key] is None for key in ['false_alarm_rate', 'anomaly_recall', 'miss_rate', 'detection_delay'])
print('persisted report hash, denominators, alarms, episodes, nulls: PASS')
PY
```

## 남은 검증

- 위 웹 검사는 JavaScript 계약·회귀 검사다. 실제 PC·360·390 브라우저·키보드·실제 휴대전화·스크린리더를 이번에 재검사하지 않았다. 웹 파일이 바뀌지 않았으므로 과거 화면 근거를 이번 실행 수에 합산하지 않는다.
- #179·#180 코드와 새 기능 검사는 포함하지 않았다. 각 Draft의 검토 근거는 해당 PR 기준이며 이번 PR은 main에서 독립된 문서 변경이다.
- 원본 전체 아카이브 해시·독립 정상/이상 세션·원인·조치 실적·탐지 성능은 미검증이다. 성능 null 유지.
- Claude와 별도 검토 담당의 독립 검토는 아직 받지 않았다. 작성자 승인 전 병합·배포 없음.
