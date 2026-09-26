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
* **Scope:** Read-only independent code audit, standalone metric recalculation, and test execution. No operating code, UI, model, or canonical SECOM artifact modifications.

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

### [Finding 2] 무불량(Fail=0) 구간 지표 계산 시 NaN의 집계 누락 (Severity: Low)
* **위치:** `experiments/molding-temporal-20260926/run.py` (lines 80–84) 및 `strengthening/run.py` (lines 62–66)
* **내용:** 불량이 0건인 날짜/슬라이스를 평가할 때 `vector()` 함수에서 AP, Capture Rate, Lift를 `np.nan`으로 반환함.
* **최소 반례:** `y = np.zeros(10)`, `p = np.arange(10)` 입력 시 `vector()` 결과 지표가 `NaN`으로 출력됨.
* **영향:** pandas의 `.mean()` 집계 시 `NaN`은 유효 분모에서 자동으로 제외됨. 개발 세트 CV에서는 다행히 3일(10/22, 10/23, 10/27) 모두 불량이 1건 이상 존재하여 CV 평가에 왜곡이 없었으나, 불량이 없는 검증 폴드가 포함될 경우 평균 계산 분모가 왜곡될 수 있음.

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

### 3) 독립 지표 재계산 (Independent Metric Recalculation)
* AP(Average Precision), Top-K ceil 반올림(5%: 111, 10%: 221, 20%: 442), 정밀도, Lift, 점검 수 계산 로직을 독립 작성 스크립트로 재검증하였습니다.
* `results/top_k.csv`, `results/slices.csv`, `daily_budget_detail.csv`의 모든 수치가 정확히 일치함을 확인했습니다.

### 4) [핵심 질문 해답] "제품명 제외 RF"의 전체 221건 중 6/8 vs 일별 상위 10% 중 0/8 원인 분석
* **질문:** 제품명 제외 RF는 전체 후기 상위 221건에서 불량 6/8을 잡지만, 각 날짜 상위 10%(총 225건)에서는 0/8입니다. 이것이 날짜별 배정 및 점수 스케일 차이로 가능한 수학적 결과인지, 버그인지 구분하십시오.
* **감사 결론:** **인덱스, 정렬, 집계 버그가 아니며, 전체 배치 정렬(Global Batch Evaluation)과 일별 고정 예산 배정(Daily Quota Evaluation) 간의 수학적·정책적 차이에서 비롯된 현상**입니다.

#### 상세 분석 및 데이터 증거:
1. **후기 불량의 극단적 날짜 편중:**
   * 후기 기간 전체 불량 8건 중 **7건이 2020-11-04 (총 생산 71건) 하루에 집중**되어 있습니다. (2020-11-03에 1건, 나머지 4개 날짜에는 불량이 0건).
2. **일별 10% 예산 정책의 구조적 한계:**
   * 일별 상위 10% 정책은 날짜별 생산량의 10%를 올림(`ceil`)하여 배정합니다.
   * 2020-11-04는 총 생산량이 71건에 불과하므로 **일별 점검 예산이 단 8건(`ceil(0.10 * 71) = 8`)으로 엄격히 제한**됩니다.
   * `rf_no_product`가 2020-11-04에 생산된 71건 내부에서 정렬했을 때, 상위 8건에는 정상 제품만 진입했고 7건의 불량은 9위 이하에 위치했습니다.
   * 반면, 불량이 0건인 날짜들(10/29: 46건, 10/30: 76건, 11/03: 93건)에 **전체 예산의 95.5%(215/225건)가 할당되어 허공에 낭비**되었습니다. 그 결과 일별 포착수는 **0/8 (0%)**이 됩니다.
3. **전체 상위 221건 배치 정책의 동작:**
   * 전체 2,209건을 한꺼번에 정렬하는 정책에서 `rf_no_product`는 2020-11-04 생산건 전반에 대해 다른 날짜(10/29, 10/30)보다 상대적으로 높은 예측 확률값을 출력했습니다.
   * 그 결과 전체 상위 221건 리스트에 2020-11-04 생산건이 8건을 훨씬 초과하여 대량 진입했고, 그 안에 포함된 불량 7건 중 6건을 포착하였습니다. (**6/8, 75%**)
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

## 5. 미검증 영역 및 한계 (Unverified Evidence)

* **원본 ZIP 파일 미제공:** 원본 `04. Dataset_Molding.zip` 및 가이드 PDF는 GitHub 리포지토리에 포함되어 있지 않고 외부(Codex)로 제공되었습니다.
* **한계 명시:** 따라서 원시 ZIP으로부터 전체 모델을 다시 처음부터 재학습하거나 개별 행 단위 생 예측을 100% 재현하는 과정은 **미검증 영역**으로 명시합니다.
* 본 감사는 리포지토리 내 저장된 결과 CSV/JSON 산출물, 파이프라인 코드, 수학적 배정 로직, 독립 합성 테스트 스크립트를 통해 정확성을 검증하였습니다.

---

## 6. 최종 판정 및 운영 권고

1. **구현 정확성 (Implementation Correctness):** **PASS**
   * 데이터 누출 방지, 시간순 CV 분할, SECOM 정본 보존 경계, 단위 테스트 수집 및 가드레일이 코드 수준에서 엄격하고 올바르게 구현되어 있습니다.
2. **연구 주장 (Research Claims):** **CAUTION / NOT PROVED FOR PRODUCTION**
   * 전체 배치 정렬 점추정치는 높으나, 후기 불량이 단 하루(11/04)에 집중되어 있고 부트스트랩 95% 신뢰구간이 [0, 1]로 매우 넓어 통계적 개선 근거가 부족합니다.
3. **운영 교체 권고 (Operational Replacement Recommendation):** **없음 (NO OPERATIONAL REPLACEMENT)**
   * 기존 보고서의 "운영 적용 보류" 판단이 타당하며, 현 단계에서 정본 모델이나 프로덕션 시스템을 교체할 근거가 없습니다.
