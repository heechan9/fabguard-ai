# FabGuard PR #140 / PR #141 읽기 전용 독립 코드·평가 감사 최종 보고서

## 1. 감사 대상 및 실행 환경

* **Repository:** `heechan9/fabguard-ai`
* **Target PRs:** PR #140 / PR #141 (`experiment/molding-temporal-20260926`)
* **Audit SHAs:**
  * Initial exact SHA: `bf5366ada5ab3adae08659eadb299e5153d3133a`
  * Updated SHA (portability fix applied): `e070a8a201e98e7e71a461a4436be3781a9df1a9`
* **Base Main SHA:** `4e969ce40072a0ee5c47ac51487444b64c1fb00d`
* **Python Runtime:** `Python 3.12.13` (Linux x86_64)
* **Core Packages:** `scikit-learn 1.9.1`, `numpy 2.5.3`, `pandas 3.0.6`
* **Scope:** 읽기 전용 독립 코드 감사, 파이프라인 수집 검증, 저장된 결과 데이터 기반 독립 재계산 및 단위 테스트 실행. 원본 ZIP 미제공 조건에 따라 행별 생 예측/원시 재학습은 미검증 및 사용자 재현 근거 참조로 범위 한정.

---

## 2. 검증 실행 명령 및 실제 로그

### (1) Temporal Study 단위 테스트
```bash
PYTHONPATH=src python3 -m unittest discover -s experiments/molding-temporal-20260926 -p 'test_*.py' -v
```
* **실행 결과:** **6 passed in 0.169s (Exit Code: 0)**
* **테스트 항목:** `test_ap_and_tie_ranking`, `test_group_overlap_rejected`, `test_no_failure_is_undefined`, `test_preprocessing_excludes_post_inspection_columns_and_fits_training_only`, `test_repeated_sensors_across_times_rejected`, `test_temporal_overlap_rejected` 모두 PASS.

### (2) Strengthening (보강) 단위 테스트
```bash
PYTHONPATH=src python3 -m unittest discover -s experiments/molding-temporal-20260926/strengthening -p 'test_*.py' -v
```
* **실행 결과:** **6 passed in 0.707s (Exit Code: 0)**
* **테스트 항목:** `test_clipping_bounds_do_not_learn_evaluation_values`, `test_imputation_precedes_clip_and_learns_training_only`, `test_original_artifact_hashes_unchanged`, `test_product_prior_shrinkage_and_unseen_product`, `test_sensor_only_model_ignores_product_and_inspection_reason`, `test_threshold_rejects_oversized_tied_alert_group` 모두 PASS.

### (3) 전체 리포지토리 단위 및 CI 계약 테스트
```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```
* **실행 결과:** **총 197개 테스트 중 194개 통과(PASS), 3개 스킵(SKIP) (Exit Code: 0)**
* **스킵 사유:** PV 옵션 의존성(`frictionless`) 미설치에 따른 사전에 정의된 정상적인 skip 조건 (`test_sdt_frictionless.py` 2건, `test_pvlive_collect.py` 1건).

### (4) 프론트엔드 웹 애플리케이션 문법 검사
```bash
node --check web/app.js
```
* **실행 결과:** **Exit Code: 0 (구문 오류 없음)**

### (5) CLI 가드레일 예외 처리 테스트 (임시 디렉터리 독립 실행)
```bash
python3 experiments/molding-temporal-20260926/run.py --archive /tmp/dummy.zip
```
* **실행 결과:** `ValueError: Input archive hash mismatch` 예외 발생 후 **Exit Code: 1 (정상 차단 확인)**.

---

## 3. 확정 발견사항 (Confirmed Findings)

### [Finding 1] Manifest 절대 경로 기록으로 인한 환경 이식성 문제 및 e070a8a 수정 검증 (Severity: Medium)
* **초기 SHA (`bf5366a`):** `strengthening/results/manifest.json` 내 `original_artifact_hashes`에 `/workspace/scratch/b4746d03835f/molding-study/experiments/...` 와 같은 절대 경로가 기록되어 다른 실행 환경에서 `manifest.json` 해시 자동 검증 시 이식성 오류가 발생함.
* **최소 반례:** 로컬/CI 환경 경로가 `/app` 인 경우 `test_strengthening.py` 실행 시 절대 경로 차이로 인해 검증 실패 가능. `test_strengthening.py`에 `if p.is_absolute(): p=Path('experiments')/str(p).split('/experiments/',1)[1]` 파싱 우회 코드가 존재하는 원인이었음.
* **업데이트 SHA (`e070a8a`) 검증:** 커밋 `e070a8a`에서 `strengthening/run.py`를 수정하여 `repo_root` 상대 경로(`experiments/molding-temporal-20260926/results/...`)로 직렬화하도록 변경됨. `test_strengthening.py`에서도 `self.assertFalse(p.is_absolute())`를 강제하도록 보강되었으며, 재실행 단위 테스트(6 passed)로 해당 문제 해결을 확인하였음.

### [Finding 2] 무불량(Fail=0) 구간 지표 계산 시 NA 처리 규약 명확화 (Severity: Informational / Contract Clarification)
* **내용:** `vector()` 및 `rank_metrics()` 함수에서 불량이 0건인 날짜/슬라이스를 평가할 때 AP, Capture Rate, Lift를 `NaN`으로 반환함.
* **규약 분석:** 이는 `y.sum() == 0` 조건에서 지표가 수식적으로 정의되지 않으므로 사전에 의도된 **계약 처리(Contract Behavior)**임.
* **검증:** 실제 개발 세트 CV 세 날짜(`10/22`, `10/23`, `10/27`)는 모두 불량이 1건 이상 존재하므로 개발 CV 평가 및 모델 선택에 아무런 결함이나 왜곡을 주지 않음.

---

## 4. 필수 검토 항목별 정밀 감사 결과 및 핵심 질문 해답

### 1) 데이터 누출 (Data Leakage)
* 완전 중복(2,764건) 제거, ID 충돌 거부, S14 설비 및 CN7/RG3 LH-RH 범위 고정이 엄격하게 수행되었습니다.
* 시간순 분할 경계(fit: `< 2020-10-29`, later: `>= 2020-10-29`)와 동일 그룹(`EQUIP_CD|TimeStamp`) 및 센서 벡터 교차 중복 차단(`check_separation()`)이 구현되었습니다.
* `Reason`, `ERR_FACT_QTY`, `PassOrFail` 등 사후 관측 필드는 모델 입력에서 완벽히 제외되었습니다.
* 결측치 대체(`SimpleImputer`), 결측 인디케이터, 스케일링(`StandardScaler`), 분위수 제한(`TrainClip`), 제품별 불량률 Smoothed Prior(`ProductPrior`)가 **각 학습 폴드에만 fit**되는 것을 독립 테스트로 확인했습니다.

### 2) 모델 및 임계값 선택 (Model / Threshold Selection)
* 개발 구간 내 과거 3일 순차 CV(`10/22`, `10/23`, `10/27`)의 expanding CV 평균 AP로만 모델을 선택했습니다.
* 예측 전 `selection_before_prediction.json`으로 모델과 선택 사유를 봉인했습니다.
* OOF 10% 경보 cap(`budget_threshold`) 적용 시, `rf_no_product`의 OOF 임계값은 0.086658로 설정되었습니다.

### 3) 독립 지표 및 일별 예산 세부 재계산 (Independent Metric Recalculation)
* `daily_budget_detail.csv`의 정확한 날짜별 수치 (생산 n / 점검 K / 불량):
  * **2020-10-29:** 생산 n = 454, 점검 K = 46, 불량 = 0
  * **2020-10-30:** 생산 n = 755, 점검 K = 76, 불량 = 0
  * **2020-11-03:** 생산 n = 926, 점검 K = 93, 불량 = 1 (포착 0)
  * **2020-11-04:** 생산 n = 71, 점검 K = 8, 불량 = 7 (포착 0)
  * **2020-11-05:** 생산 n = 2, 점검 K = 1, 불량 = 0
  * **2020-11-06:** 생산 n = 1, 점검 K = 1, 불량 = 0
  * **총계:** 생산 N = 2,209건, 점검 예산 K = 225건, 총 불량 = 8건
* 무불량 날짜(10/29, 10/30, 11/05, 11/06)에 할당된 총 점검 예산은 **124건 / 225건 (55.1%)**입니다. 11/03의 93건 예산은 불량이 1건 존재하는 날짜에 투입되었으나 해당 불량을 놓친 별도 사례입니다.

### 4) [핵심 질문 해답] "제품명 제외 RF"의 전체 221건 중 6/8 vs 일별 상위 10% 중 0/8 원인 분석
* **질문:** 제품명 제외 RF는 전체 후기 상위 221건에서 불량 6/8을 잡지만, 각 날짜 상위 10%(총 225건)에서는 0/8입니다. 이것이 날짜별 배정 및 점수 스케일 차이로 가능한 수학적 결과인지, 버그인지 구분하십시오.
* **감사 결론:** **인덱스, 정렬, 집계 버그가 아니며, 전체 배치 정렬(Global Batch Evaluation)과 일별 고정 예산 배정(Daily Quota Evaluation) 간의 수학적·정책적 차이에서 비롯된 현상**입니다.

#### 상세 분석 및 원시 순위 근거:
1. **11/04 불량 7건의 일별 순위:**
   * 2020-11-04 (총 생산 71건)에서 `rf_no_product`가 예측한 불량 7건의 일별 내림차순 순위는 **9위, 16위, 21위, 34위, 43위, 55위, 67위**입니다.
   * 따라서 11/04의 일별 상위 10% 예산인 **Top 8건 내에는 불량이 단 1건도 진입하지 못하여 포착수 0건**이 됩니다.
2. **전체 상위 221건 배치 정렬의 동작:**
   * `rf_no_product`는 11/04 생산건 전반에 대해 다른 날짜(10/29, 10/30 등)보다 상대적으로 높은 확률 스케일을 출력했습니다.
   * 이에 따라 전체 상위 221건 리스트에 11/04 생산건이 무려 **62건** 진입하였으며, 9위, 16위, 21위, 34위, 43위, 55위에 있던 불량 6건이 전체 상위 221건 범위에 포함되어 **6/8 (75%)**을 포착하게 됩니다.
3. **일별 고정 예산 배정의 문제:**
   * 무불량 날짜들에 전체 점검 예산의 55.1%(124건)가 배정되어 소모되었고, 11/03(93건 예산)에서도 1건의 불량을 놓쳤습니다. 정작 불량이 7건이나 집중된 11/04에는 소규모 생산량(71건)으로 인해 단 8건의 예산만 할당되는 불균형이 발생했습니다.
4. **운영 주의사항:**
   * 전체 배치 정렬 성적(6/8)은 사후 일괄 평가일 뿐이며, 이를 "실시간 순차 점검 성과"로 과장해서는 안 됩니다. 또한 일별 배정 정책(0/8)과 전체 배치 정렬 정책(6/8)을 동일한 예산/운영 조건으로 오인해서는 안 됩니다.

### 5) 불확실성 및 부트스트랩 (Uncertainty & Bootstrap)
* 2,000회 날짜 군집 부트스트랩 수행 시, **161회는 불량이 0건인 날짜들만 재표집되어 AP/Recall/Lift가 NA** 처리되었습니다.
* 유효한 1,839회 반복에 대해 95% percentile 신뢰구간을 산출한 결과, RF의 Top 10% 포착률 신뢰구간은 **[0%, 100%]**로 극도로 넓습니다. Dummy 대비 포착률 차이 신뢰구간도 0을 포함하여 성능 개선이 입증되지 않았습니다.
* Leave-one-day-out 진단에서 2020-11-04를 제외하면 모든 모델의 포착률은 0/1이 됩니다.

### 6) Logistic 포화 및 분위수 제한 (Logistic Saturation & Clipping)
* `Average_Screw_RPM` 변수의 후기 데이터 값은 **100% 학습 구간 범위를 초과**하였습니다. Standard Scaling 후 최대 변환값이 273.91에 달해 평균 logit 기여도가 **+41.094** 발생, 점수 포화(전체 2,209건 경보)를 유발했습니다.
* `TrainClip`(학습 1/99 분위수 제한) 적용 시 0.5 임계값 경보 수는 2,209건에서 186건으로 크게 감소했습니다.
* **주의:** 이는 모형 입력 제한에 따른 수치적 경보 완화 현상일 뿐, 센서 고장/단위 오류/인과관계가 입증된 것이 아닙니다. 또한 경보 완화가 일별 불량 탐지 성능 개선(일별 0/8)으로 이어지지는 않았습니다.

### 7) 보존 및 재현성 (Preservation & Reproducibility)
* 원본 SECOM V1 및 Phase1 산출물 24개 파일의 SHA256 해시를 검증한 결과 **100% 일치**하여 완벽히 보존되었음을 확인했습니다.

---

## 5. 미검증 영역 및 한계 (Unverified Evidence Boundary)

* **원본 ZIP 미포함에 따른 재산출 범위 한계:** 원본 `04. Dataset_Molding.zip`은 공개 리포지토리에 올리지 않는 보안 정책에 따라 포괄되어 있지 않습니다.
* **범위 명시:** 본 세션의 독립 감사는 리포지토리 내 집계표(CSV/JSON), 파이프라인 코드, 테스트 및 수학적 로직 검증에 한정되며, 원시 데이터로부터의 행별 생 예측값 및 모형 재학습 전체 과정은 미검증 영역입니다. (사용자의 동일 SHA/환경 재학습 확인 결과 수치를 참조 반영함).

---

## 6. 최종 판정 및 운영 권고

1. **구현 정확성 (Implementation Correctness):** **PASS**
   * 데이터 누출 방지, 시간순 CV 분할, SECOM 정본 보존 경계, 단위 테스트 수집 및 가드레일이 코드 수준에서 엄격하고 올바르게 구현되어 있습니다.
2. **연구 주장 (Research Claims):** **CAUTION / NOT PROVED FOR PRODUCTION**
   * 전체 배치 정렬 점추정치는 높으나, 후기 불량이 단 하루(11/04)에 집중되어 있고 부트스트랩 95% 신뢰구간이 [0, 1]로 매우 넓어 통계적 개선 근거가 부족합니다.
3. **운영 교체 권고 (Operational Replacement Recommendation):** **없음 (NO OPERATIONAL REPLACEMENT)**
   * 기존 보고서의 "운영 적용 보류" 판단이 타당하며, 현 단계에서 정본 모델이나 프로덕션 시스템을 교체할 근거가 없습니다.
