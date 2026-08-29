# FabGuard AI — Experiment Contract (V1 Draft)

상태: 모델 실행 전 초안  
고정일: 2026-08-22  
변경 원칙: 최초 모델 결과를 본 이후의 변경은 이유·영향·변경 전후 결과를 changelog에 남긴다.

## 1. 목적과 비목적

목적은 SECOM 반도체 제조공정 데이터에서 Fail 위험이 높은 생산 건을 우선순위화하고, 엔지니어가 먼저 확인할 익명 측정변수를 근거로 제시하는 재현 가능한 의사결정 지원 실험을 구축하는 것이다.

V1은 실제 불량 원인 규명, 실제 SPC/FDC/APC 구축, 익명 센서의 물리적 의미 해석, 실시간 배포를 목표로 하지 않는다.

## 2. 데이터·대상변수·식별자

- 입력: `secom.data` 1,567 × 590
- 대상: Fail `1`을 positive, Pass `-1`을 negative로 재부호화
- timestamp: 시간 분할·정렬·priority table 표시 전용이며 모델 feature에서 제외
- sample_id: 원본 행 번호 기반 불변 식별자
- 원본 해시와 파싱 규칙은 `FABGUARD_DATA_AUDIT.md`를 따른다.

## 3. 주 평가 분할

- 원본이 이미 시간순임을 확인했지만, timestamp와 sample_id로 안정 정렬한다.
- Train: 최초 1,175건, Fail 80건, 2008-07-19 11:55~2008-09-29 11:13
- Test: 마지막 392건, Fail 24건, 2008-09-29 11:53~2008-10-17 06:07
- Test는 최종 1회 평가용으로 보존한다.
- 동일 timestamp가 경계에 걸리면 해당 timestamp의 전 행을 한쪽에 둔다.
- 시간 holdout 결과를 현실적 운영 시나리오의 주 결과로, Train 내부 층화 반복 CV를 보조 결과로 보고한다.

## 4. 누출 방지 전처리

각 CV fold와 최종 Train→Test 평가에서 다음을 하나의 pipeline 안에 둔다.

1. Train에서만 결측률 `>50%` 변수 제거 목록 산출
2. Train에서만 non-missing 고유값 `<=1` 변수 제거
3. Train에서만 값과 결측 위치가 완전히 같은 중복 변수 그룹 산출 후 가장 낮은 원본 열 번호 보존
4. 중앙값 대치(`SimpleImputer(strategy="median", add_indicator=True)`); 전부 결측인 fold 변수는 앞 단계에서 제거
5. Logistic Regression 경로만 표준화(`StandardScaler`)
6. 모델별 feature handling과 학습

SMOTE와 기타 리샘플링은 V1 기본 실험에서 제외한다. 먼저 class weight와 threshold/ranking만 평가해 실험 범위를 통제한다.

## 5. 비교 모델

1. Dummy Classifier: `strategy="prior"`. 다수 클래스 예측의 함정과 무정보 확률 ranking 기준선.
2. L1 Logistic Regression: `solver="liblinear"` 또는 재현 가능한 동등 solver, `class_weight="balanced"`. `C`는 사전 정의된 작은 grid를 Train CV에서 선택한다.
3. Random Forest: `class_weight="balanced_subsample"`, 고정 random seed. 깊이·leaf size·feature subsampling의 작은 사전 grid만 사용한다.

### Random Forest 선정 근거

V1에서는 XGBoost 대신 Random Forest를 선택한다. 작은 표본, 고차원, 결측·중복 정리 후의 비선형 상호작용을 포착하면서 별도 외부 부스팅 의존성과 광범위한 튜닝을 줄일 수 있고, L1 선형모델과 모델 계열 차이가 명확하다. XGBoost는 V2의 성능·비용 비교로 남긴다. Random Forest가 더 우수할 것이라는 사전 성능 주장은 하지 않는다.

## 6. 보조 교차검증과 모델 선택

- 범위: 시간 holdout의 Train 1,175건만 사용
- 방법: `RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=...)`
- 이유: fold당 validation Fail이 약 16건이 되며, 25회 평가로 단일 분할 변동성을 관찰할 수 있다.
- 각 모델의 동일 split indices를 저장해 paired comparison을 가능하게 한다.
- 주 튜닝 기준: mean PR-AUC. 동률에 가까우면 단순한 모델과 낮은 분산을 우선한다.
- CV 결과는 평균, 표준편차, 최소·최대 또는 분위수를 함께 보고한다.

## 7. 임계값과 지표

Test를 보지 않고 Train의 out-of-fold prediction만으로 분류 임계값을 정한다. 기본 규칙은 **Fail Recall을 우선하되 False Alarm Rate와 Precision을 함께 제시하는 사전 정의 운영점**이며, 구체적 제약값은 첫 실행 전에 설정 파일에 기록한다. 임계값을 정하지 못하면 0.5를 기본점으로 보고하고 threshold sweep은 분석용으로 분리한다.

필수 지표:

- Fail Recall = TP / (TP + FN)
- Precision = TP / (TP + FP)
- F1
- PR-AUC (Average Precision 구현값도 명칭과 함께 명시)
- Balanced Accuracy
- False Alarm Rate = FP / (FP + TN)
- Confusion Matrix
- Accuracy는 참고치만 보고 대표지표로 사용하지 않음

## 8. Top-K Risk Capture

모델의 Fail 확률을 내림차순 정렬해 K=5%, 10%, 20%를 모두 평가한다. 대상 수는 `ceil(K × 평가 샘플 수)`로 정하며 확률 동률은 sample_id 오름차순으로 결정한다.

각 K에서 다음을 보고한다.

- 점검 대상 생산 건 수
- 포착 Fail 수
- 전체 Fail 대비 포착률
- 정상 생산 건 오탐 수
- Precision
- 점검 부담 = 점검 대상 수 및 전체 대비 비율
- Lift = Top-K precision / 평가구간 Fail prevalence

주대표는 **Top-10% Risk Capture**로 정한다. Test 392건 기준 약 40건을 점검하는 운영 시나리오로, 5%보다 Fail 포착 수의 우연 변동을 줄이고 20%보다 우선점검의 의미를 보존한다. 5%와 20%는 민감도 범위로 함께 제시한다.

## 9. 중요 변수 안정성 최소 검증

추가 대형 실험 대신 5×5 반복 CV에서 이미 학습한 estimator를 재사용한다.

- L1 Logistic: 각 fold의 비영(非零) 선택 빈도, 절대 표준화 계수 순위, 계수 부호 일치율
- Random Forest: 각 fold의 impurity importance 상위 20 포함 빈도와 rank 중앙값(IQR)
- 공통: 상위 20 목록의 fold 간 Jaccard overlap과 반복 선택 빈도
- 최종 priority table의 evidence는 모델별 상위 기여 변수 ID를 제시하되 물리적 의미는 부여하지 않는다.

Impurity importance의 편향을 명시하며, permutation importance는 필요할 경우 Train validation/OoF 범위에서 상위 후보에 한해 보조 확인한다. Test 중요도로 feature를 선택하거나 모델을 수정하지 않는다.

## 10. 필수 산출물

- `DATASET_CARD.md`
- `EXPERIMENT_CONTRACT.md`
- 전처리·학습·평가 코드와 고정 config
- split indices 및 random seed
- 모델별 CV/Test 결과 CSV
- Confusion Matrix, Precision–Recall Curve
- Top-K 표·그래프
- 중요 변수 안정성 표
- `priority_table.csv`
- `REPRODUCIBILITY.md`
- 5~8페이지 분석보고서
- 포트폴리오 요약

## 11. 보고서 최종 목차(5~8페이지)

1. 문제 정의와 제조 운영 질문
2. 데이터·원본 무결성·Dataset Card 요약
3. 데이터 감사와 누출 위험
4. 실험계약: 분할·pipeline·모델·지표
5. 결과: 시간 holdout과 반복 CV
6. Top-K 우선점검 결과와 priority table 사례
7. 중요 변수 안정성·한계
8. 결론, 재현성, V2/V3 확장 조건

필수 표: 데이터 감사, 분할별 클래스 수, 모델별 CV/Test 지표, Top-K 운영표, 중요 변수 안정성, 제한사항.  
필수 그래프: 라벨/시간 분포, Precision–Recall Curve, Confusion Matrix, Top-K Capture curve, 중요 변수 안정성. 그래프 수는 중복을 피하고 5~7개 내로 제한한다.

## 12. 프로젝트명과 포트폴리오 문구

- 한국어명: **FabGuard AI — 반도체 제조 고위험 생산 건 우선점검 지원 시스템**
- 영어명: **FabGuard AI — Risk-Based Inspection Prioritization for Semiconductor Manufacturing**
- 한국어 설명: **익명화된 SECOM 제조데이터를 누출 없이 처리하고, 시간 변화와 클래스 불균형을 고려해 Fail 위험 상위 생산 건과 우선 확인할 측정변수를 제시한 재현 가능한 의사결정 지원 프로젝트.**
- English description: **A reproducible decision-support project that uses leakage-safe SECOM pipelines to rank production instances by failure risk and surface anonymous measurement variables for prioritized engineering review under class imbalance and temporal shift.**

`early failure detection`은 label 시점과 예측 가능 시점이 데이터에서 충분히 입증된 경우에만 사용한다. 그 전에는 `risk-based prioritization`을 기본 표현으로 쓴다.

## 13. 2주 V1과 후속 범위

### V1 — 2주 내 필수

원본 감사, Dataset Card, 실험계약, Dummy/L1 Logistic/Random Forest, leakage-safe pipeline, 25% 시간 holdout, 5×5 반복 층화 CV, 필수 지표, Top-K, 최소 안정성 검증, priority table, 재현성 문서, 5~8페이지 보고서. Streamlit은 남는 시간에만 한다.

### V2 — V1이 유의미할 때

XGBoost 비교, 제한된 feature stability 강화, threshold·비용 시나리오, probability calibration, ranking UI 개선. V1 Test를 반복 튜닝에 재사용하지 않고 필요하면 validation/새 평가 설계를 만든다.

### V3 — 별도 확장 프로젝트

anomaly detection, drift 분석, SPC·FDC 개념을 참고한 통계적 모니터링 및 이상징후 우선 탐색, Streamlit 운영 MVP.

### Future Work

실제 장비·공정·lot/wafer 계층·검사 시점 정보가 확보된 경우에만 FDC/APC 연계 가능성을 검토한다.

## 14. 실행 전 미결정 1건

분류 임계값의 운영 제약(예: 최소 Recall 또는 최대 점검 부담)은 도메인 비용 정보가 없으므로 아직 확정하지 않는다. V1의 주 운영 결과는 임의 비용가중 Risk Score 대신 Top-K ranking으로 고정한다.
