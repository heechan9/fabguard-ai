# 로봇 50 ms 창 SPC 사전 계약 (2026-10-23 · 개정 v3 2026-10-24)

> **v2 개정:** 독립 감사 필수 수정 2건 반영 — (1) 큰 유한 값의 제곱 overflow를 범위 제한으로 창 보류, (2) 시간 span에 비례하던 창 할당을 표본·gap 수에 비례하는 희소 표현으로 교체. 바이트 해시와 디코딩 결속(`run_protocol_from_bytes`)을 추가했다. 이 계약은 FabGuard 플랫폼의 기존 기능(반도체·제조 데이터 전처리, 공정 품질, 모델 평가, 장비 데이터 점검)을 대체하지 않는 별도 추가 기능이다.

**현재 상태 (2026-10-26):** Python 모듈과 정상 개발자료의 탐색 실행 근거는 main에 반영됐다. [실행 요약](review/pr173-validation-20261024/robot_spc_results/summary.json)과 [경보 해석·추적 안내](FDC_LECTURE_APPLICATION.md)를 따른다. 아래 `미정` 표는 2026-10-23 실행 전 이력이며 실제 고정 설정은 실행 매니페스트의 config_sha256과 실행 근거에 연결돼 있다. 저장 보고서 웹 연결 #179와 UR3 #180은 별도 Draft이며 main 배포 완료가 아니다. 완료된 실행의 최고 상태는 `exploratory_alarm_activity_only`이며 성능·안정성·원인·운영 적합성 결과가 아니다. 구현: `src/fabguard/robot_window_spc.py`, 테스트: `tests/test_robot_window_spc.py`.

## 1. 자료와 분할 (조건 1, 9)

- 원본: IMAD-DS v2 `RoboticArm.7z` (Zenodo 12665499, MD5 `a64498b7dcc297946a7fb8366e38ba33`). 공식 페이지는 가속도계 공칭 6.7 kHz만 밝히며 단위는 적지 않는다. 단위 `g`는 Parquet 열 이름 `A_x [g]` 등에서 온 것이다.
- 사용 파일: `normal_source_train`의 `weight15`·`BckgA` **기록 그룹**에서 reference 1 / calibration 1 / evaluation 2 그룹. 그룹 ID는 RMS를 계산하기 전에 매니페스트에 적는다. 같은 그룹(`_dataLog_` 앞부분)이 두 역할에 들어가거나 같은 바이트(SHA-256)가 두 번 나오면 `invalid_manifest`.
- 이 그룹들은 기존 벤치마크 학습에 쓰인 자료다. `holdout_status = reused_development_data`로 고정하고 독립 holdout이라고 부르지 않는다.
- 하중·배경 라벨 일치는 동작·속도·세션 일치를 뜻하지 않는다(보고서 `notes`에 고정 문구).
- 파일별 SHA-256을 매니페스트에 넣고 실행 시 바이트로 대조한다. 대조 바이트가 없거나 다르면 `source_verification_failed`이며 창 계산 전에 멈춘다.
- **신뢰 경계:** 해시 일치는 바이트가 매니페스트와 같다는 것만 보인다. `run_protocol_from_bytes(..., decoder="parquet"|"csv")`는 검증한 바로 그 바이트를 디코딩해 파싱을 결속한다(`input_binding = decoded_from_verified_source_bytes:*`). 디코더(pandas/pyarrow 또는 표준 `csv`)는 신뢰 경계로 남으며 완전한 출처 인증이 아니다. 별도로 디코딩한 배열을 넘기는 `run_protocol`은 `arrays_not_bound_to_verified_bytes` 플래그를 단다. 모델 artifact 결속(#168 계열)과도 별개다.
- onset/종료 관련 필드가 매니페스트에 있으면 거부한다.

## 2. 창과 RMS (조건 2)

| 항목 | 고정 규칙 |
|---|---|
| 창 | `window_s = "0.050"`(10진 문자열; float 거부). 파일 첫 타임스탬프 기준, 왼쪽 닫힘·오른쪽 열림 `[t0+k·w, t0+(k+1)·w)`, 비중첩 |
| 경계 계산 | 저장된 float 타임스탬프의 정확한 이진값과 10진 창 폭으로 유리수 계산. 경계에서 1 ns 이내 표본 수를 `near_boundary_samples`로 기록·플래그 |
| 부분 창 | 마지막 완전 창 뒤 표본은 `partial_tail`(표본 수·시간)로 기록하고 점수 내지 않음 |
| RMS | `rms_mode` 하나를 사전 선택: `axis_x/y/z` 또는 `vector = sqrt(mean(x²+y²+z²))`. `dc_handling = none`만 허용(중력·자세 성분 포함). DC 제거가 필요하면 새 버전 |
| 시간·단위 | 시간 `s`, 값 `g`, 열은 정확히 `Time` + 세 축 |
| cadence | 파일 중앙 Δt가 `nominal_period_s`에서 `cadence_rel_tolerance` 넘게 벗어나면 파일 `invalid` |
| 최소 표본 | `min_samples` 미만 창은 `insufficient_samples`; 공칭 용량보다 크면 설정 거부 |
| 결측·비유한 | 창 안에 비유한 값이 하나라도 있으면 그 창 `not_evaluable`(표본 삭제·대치 없음) |
| 수치 범위 | 어느 축이든 \|값\| > `MAX_ABS_SAMPLE_G = 1e6` g이면 제곱 전에 그 창 `value_out_of_range`로 보류. 센서 규격이 아니라 overflow 방지 상한. reference 척도 < `MIN_REFERENCE_SCALE_G = 1e-9` g이면 `reference_invalid`. 탐지 통계가 비유한이면 결과 대신 `numeric_failure`/`calibration_failed` |
| 빈 창 | 표본이 없는 완전 창은 창마다 만들지 않고 `empty_window_runs`(첫·끝 지수, 개수, 사유)로 기록. 작업·메모리는 표본 수와 gap 수에 비례하며 시간 span에 비례하지 않음. 탐지기에서는 같은 수의 평가 불가 창과 동일하게 리셋·집계 |

창 수와 창 지수는 시간 단위 지연으로 바꾸지 않는다. 합성 tick·창 결과를 실시스템 지연 성능으로 환산하지 않는다.

## 3. 파일 경계와 리셋 (조건 3)

- 탐지기는 파일마다 0 상태로 시작한다. API가 파일 하나씩만 받으므로 독립 파일을 이어 붙일 수 없다.
- 타임스탬프 역전·중복·비유한 시간은 파일 `invalid`(정렬·삭제 없음).
- Δt > `gap_factor × nominal_period_s`이면 gap. gap이 걸친 창은 `timestamp_gap`으로 `not_evaluable`, 그 창에서 상태 리셋. 보간 없음.
- 리셋 사유(`not_evaluable_window`, 선택 시 `after_alarm`)와 제외 창 사유를 파일별로 센다.

## 4. 안정 정상 (조건 4)

정상 라벨은 안정 정상이 아니다. `operating_context`, `trend`, `distribution`, `autocorrelation`, `motion_cycle` 다섯 항목 모두에 근거(`basis`)와 판단자(`assessed_by`)가 있어야 `stability_supported_by_annotation`이 된다. 그것도 주석이지 증명이 아니다. p-value 하나(예: p ≥ .05)는 받지 않는다. 현재 계획에는 이 근거가 없으므로 결과는 `stability_unverified` 플래그를 단다. reference의 lag-1 자기상관은 `descriptive_only`로만 보고한다.

## 5. reference / calibration / evaluation (조건 5)

- 중심·척도: reference 그룹의 평가 가능 창 RMS 평균·표본표준편차(ddof=1)만 사용. 창 수 < `min_reference_windows`, 척도 0·비유한이면 `reference_invalid`.
- 임계값: calibration 그룹에서 방법별 사전 고정 grid를 오름차순으로 시험해 `raw_alarms / 평가 가능 창 ≤ max_raw_alarm_fraction`을 처음 만족하는 값을 고른다. 없으면 그 방법은 `calibration_failed`이고 grid를 넓히지 않는다. 세 방법 모두 실패하면 실행이 멈춘다.
- 역할 검사: reference/calibration 함수에 다른 역할 파일이 들어오면 예외. evaluation 값은 중심·척도·임계값에 영향을 주지 않는다(테스트로 확인).

## 6–8. 보고 (조건 6, 7, 8)

- 파일별: 전체 시간, 평가 가능 시간, 완전 창 수, 평가 가능 창 수, 사유별 제외 창, 제외율, partial tail, gap 수, 경계 근접 표본 수.
- 방법별(Shewhart, EWMA, 양측 CUSUM; 같은 창 mask·리셋): 임계값, raw alarm 수, episode 수(연속 raw alarm 묶음; not_evaluable에서 끊김), 경보 여부, `alarm_activity_per_evaluable_window`, mask SHA-256.
- `false_alarm_rate`, `detection_delay`, `anomaly_recall`, `miss_rate`는 항상 `null`(onset/종료 라벨 없음, 안정 정상 미확립).
- 독립 단위는 evaluation 기록 그룹 수(계획상 2)다. 창 수를 세션 수로 쓰지 않는다. 같은 calibration 상한은 같은 실제 오탐률·ARL을 뜻하지 않는다.

## 9. 실패 상태

`invalid_config` → `invalid_manifest` → `source_verification_failed` → `input_missing` → `reference_invalid` → `calibration_failed` → `numeric_failure` 순서의 종결 상태가 있으며 `success`라는 상태는 없다. 사후에 유리한 reference 구간을 고르면 `protocol_status = exploratory_posthoc`이고 결과에 그 플래그가 붙는다.

## 의존성과 검증 환경 (v3)

- **기본(core) 설치 `pip install .`:** pyarrow가 없다. 창 분할, RMS, 탐지기, CSV 디코더, 매니페스트 검증과 의존성 계약 테스트는 여기서 모두 실행된다. Parquet 디코딩을 요청하면 결과를 만들지 않고 `RobotDependencyError`(ImportError)로 `pip install 'fabguard-ai[robot]'`을 안내한다. 실제 Parquet 회귀 테스트는 이유를 밝히고 skip한다.
- **선택 설치 `pip install '.[robot]'`:** CI `robot-extra` 작업이 `FABGUARD_REQUIRE_ROBOT_EXTRA=1`로 실행한다. 이 변수가 있으면 pyarrow가 없을 때 skip 대신 실패하므로, Parquet 회귀가 조용히 빠질 수 없다.
- **창 지수 상한:** 한 파일의 완전 창 수가 `MAX_WINDOWS_PER_FILE = 2**53 - 1`을 넘으면 `time_span_exceeds_window_index_limit`로 파일을 무효 처리한다. JSON·브라우저에서 지수와 개수가 정확히 표현되는 범위를 넘기지 않기 위한 상한이며, 브라우저 구현과 같은 계약이다.

## 과거 이력: 실행 전에 소유자가 고정할 값 (2026-10-23)

| 값 | 상태 |
|---|---|
| reference/calibration/evaluation 그룹 ID 4개 | 미정. weight15·BckgA에 정상 학습 그룹이 4개 이상인지 매핑 CSV로 먼저 확인 |
| `rms_mode` | 미정(vector는 중력 성분 포함) |
| `nominal_period_s`, `cadence_rel_tolerance`, `gap_factor`, `min_samples` | 미정. 스키마·시간열만 보고 정하고 RMS·경보는 보지 않음 |
| grid, `max_raw_alarm_fraction`, `ewma_lambda`, `cusum_k`, `reset_after_alarm` | 미정 |
| `config_sha256`, 매니페스트, 파일 SHA-256 | 위 값 고정 후 생성·기록 |

통계 검정(t-test·ANOVA)은 독립 recording 수와 교락·가정 확인 전에는 하지 않으며, 창 단위 검정(pseudoreplication)은 금지한다. 중요도·상관·경보는 원인 증거가 아니며 규격 한계가 없는 이 자료에서 Cpk·수율·경제 효과를 계산하지 않는다.
