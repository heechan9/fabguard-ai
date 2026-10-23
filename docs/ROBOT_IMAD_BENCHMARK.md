# IMAD-DS 로봇 암 학습·성능 측정 (2026-10-23)

**상태: 오프라인 연구 실험.** FabGuard의 SECOM 생산 건 위험순위 모델과 독립적이며 웹 데모나 실제 로봇에 연결하지 않았다. 원본은 [IMAD-DS Zenodo record 12665499](https://zenodo.org/records/12665499)의 `RoboticArm.7z`다. 실험 장비는 축소된 로봇 암이고 이상은 의도적으로 나사를 풀어 만든 `loosescrewsA` 한 종류다. 반도체 설비 또는 고장 예방 효과의 검증 자료로 해석하지 않는다.

## 입력·방법

- 원본 7z 3,545,453,763 bytes, MD5 `a64498b7dcc297946a7fb8366e38ba33`, SHA-256 `2d224895a083c9d1a12d9ad5817422e8a7428d0ee92b304929717595ead63b65`. 아카이브를 먼저 검사하고 압축 해제한 `RoboticArm` 폴더를 읽는다. Zenodo 원본과 센서 Parquet 원본은 Git에 올리지 않는다.
- 매핑 CSV 6개와 센서 Parquet 6,909개에서 2,303개 구간의 마이크 1축, 가속도 3축, 자이로 3축을 읽었다. 각 축의 평균·표준편차·RMS·절댓값 95백분위·연속 차분 RMS·유효값 비율을 계산했다(42개 특징). 각 센서의 상대 시간 단조 증가와 매핑 스키마·개수·라벨을 검사한다.
- `SimpleImputer(median) → StandardScaler → IsolationForest(200 trees, max_samples≤256, seed=42)`를 정상 source 훈련 구간에만 적합했다. 이상 라벨이나 test 값은 학습에 사용하지 않았다. 점수는 `-decision_function`이며 클수록 우선 점검한다.
- `pyarrow>=15`는 원본 Parquet를 읽는 **로봇 실험에만 필요한 선택 의존성**이다. 나머지 FabGuard 환경의 기본 설치를 늘리지 않는다.

## 분할과 노출

| 프로토콜 | 정상 source 훈련 | 훈련 녹화 세션 | 평가 |
|---|---:|---:|---|
| 제공 분할 `published_split` | 1,812구간 | 58개 | source 정상/이상 각 116, target 정상/이상 각 116 |
| 세션 분리 `disjoint_recording_groups` | 214구간 | 14개 | 같은 고정 test 464구간. 모든 test 세션을 훈련에서 제외 |

같은 `segment_id`는 양쪽에 없다. 그러나 제공 분할에서는 **source 정상 test 116개 전부가 훈련 구간과 녹화 세션을 공유**한다. 세션 분리는 이 겹침을 제거하기 위해 원래 훈련 구간 1,598개를 제외한 추가 민감도 검사다. 세션 이름의 `_dataLog_` 앞부분을 묶음 단위로 사용했다. 녹화 세션 분리만으로 장비·시간·물리 환경의 완전한 독립성을 보장하지 않는다. Target 정상 훈련 27개는 두 프로토콜 모두 사용하지 않았다.

## 결과

각 도메인은 정상 116, 이상 116의 **인위적 50:50 시험 구성**이다. 따라서 AP 기준선은 약 0.5이며, 현장 유병률의 정밀도나 알람 빈도로 변환할 수 없다. 상위 10%는 각각 24/232개를 검토한다.

| 훈련 방식 | 시험 조건 | AUROC | AP | 상위 10% 이상 포착 | 오경보 |
|---|---|---:|---:|---:|---:|
| 제공 분할 | source | 0.6824 | 0.6668 | 19/116 | 5/24 |
| 제공 분할 | target | 0.5204 | 0.4619 | **0/116** | **24/24** |
| 세션 분리 | source | 0.6558 | 0.5881 | 9/116 | 15/24 |
| 세션 분리 | target | **0.4793** | **0.4417** | **1/116** | **23/24** |

Source와 target을 합친 464구간은 [원본 `metrics.json`](../results/robot-imad-2026/metrics.json)에 별도로 기록한다. 두 실행에서 여섯 행의 측정값이 같았다. Target의 높은 누락과 오경보 때문에 이번 학습 모델은 운영 사용에 부적합하다. 이 결과를 본 뒤 같은 test로 특징이나 초매개변수를 다시 고르면 독립 확인으로 간주할 수 없다. 후속 변경은 사전에 선택할 검증 분할과 새로운 미사용 평가 자료를 정한 뒤 별도 실험으로 기록한다.

## 재현

```bash
python -m pip install -e '.[robot]'
fabguard-robot-benchmark \
  --archive /path/to/RoboticArm.7z \
  --data-dir /path/to/extracted/RoboticArm \
  --output-dir /path/to/private/output
PYTHONPATH=src python -m unittest tests.test_robot_benchmark -v
```

압축 파일 크기가 약 3.55GB이고 추출된 센서 데이터가 약 7GB이므로 로컬 용량을 확보해야 한다. 실행 환경: Python 3.12.14, NumPy 2.3.5, pandas 2.2.3, scikit-learn 1.8.0, pyarrow 26.0.0, joblib 1.5.3. 전체 결과와 모델의 SHA-256은 [`report.json`](../results/robot-imad-2026/report.json)에 있다. 모델 파일·구간별 특징·점수는 별도 보관하며 Git에는 올리지 않는다. Joblib 파일은 자신이 생성한 신뢰 가능한 사본만 로드한다.

## 주장 범위

이 자료는 단일 연구실 축소 장비의 의도적 나사 풀림 구간을 우선순위화한 오프라인 실험이다. 실제 팹 장비 진위, 수율, 작업자 검토 성과, 실시간 제어, 새 기간 성능, 다른 결함 유형은 검증하지 않았다. 원본 저작권과 재배포 조건은 [Zenodo의 CC BY-SA 4.0 안내](https://zenodo.org/records/12665499)를 따른다.
