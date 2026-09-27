# SECOM 탐색적 시간순 순위 실험 — 사전 비교 조건

Base: `627542999ef229a89b2c4cb592ae2a03e41bade0`. 작성 후 결과 실행 전에 git commit으로 고정한다.
V1/Phase1 정본은 읽기 전용. 운영 모델 교체 없음. SECOM 후기 392건은 이미 노출됐으므로 모든 후속 평가는 탐색적이며 재분할로 독립성이 복구되지 않는다.

## 질문과 후보 (총 5개, 추가 탐색 금지)

1. V1 기준: Dummy prior, L1 Logistic C=0.01, RF depth=None/leaf=8/120 trees. V1 학습 CV가 고른 각 계열 후보 그대로. 동일 환경에서 후기 AP와 RF 저장 예측을 먼저 대조한다.
2. H1: L1의 강한 희소화보다 L2 축소가 상관된 약한 신호를 보존할 수 있는가? Logistic L2 C=0.1, balanced, liblinear, max_iter=3000. C 탐색 없음.
3. H2: 다수 잡음 변수를 줄이면 RF 시간 일반화가 나아지는가? 학습 폴드 내부 median+missing indicators 후 ANOVA F 상위 40개 선택, 나머지는 기준 RF와 동일. 40은 고정, 후기 자료로 조정하지 않음.

공통 seed 20260822. 클래스 가중치는 학습 데이터에서만 계산. 기존 50% 결측 필터·상수/중복 제거·중앙값 대체·결측 indicator는 모두 매 학습 폴드에서 fit. 과표집 없음. L2만 StandardScaler 유지. 새 의존성 없음.

## 분할·선택

공식 해시 일치 SECOM, timestamp/sample_id 정렬, V1 train1175/test392 및 저장 ID 일치 강제.
학습 1175건에서 expanding-window validation 3개: 경계 floor(n*0.5), floor(n*2/3), floor(n*5/6), n. 같은 timestamp 묶음을 경계에서 나누지 않도록 앞쪽으로 이동. 엄격한 train_end < validation_start 확인. 평가구간의 불량 부족도 그대로 공개.
선택: 세 구간 평균 AP 최대(각 구간 동일 가중), 동률은 평균 Top10% 포착률, 이후 이름 순. Dummy는 선택 대상 아님. 선택과 임계값 JSON을 후기 예측 이전에 저장한다.
각 후보의 진단용 임계값은 학습구간의 시간순 OOF 예측에서 F2 최대, 동률은 높은 임계값. 0.5 기준 결과도 함께 기록. 이 임계값은 학습구간의 서로 다른 fitted 모델을 합친 탐색적 추정이며 확률 보정/독립 검증이 아니다. 임계값 변화가 AP나 Top-K 향상은 아님.

## 비교·불확실성

같은 392건에서 AP 및 Top5/10/20%=20/40/79건: 포착수·포착률·정밀도·Lift·정상 점검수. 0.5 및 OOF 임계값의 TP/FP/FN/TN·FPR. 동점은 sample_id 오름차순; Dummy 결과는 이 규칙의 임의 순서이며 기대 무작위 포착수 k*24/392와 함께 해석.
시간 변동: 고정 학습 모델의 후기 평가를 연속 네 구간으로 나누어 각 구간 AP·Top-K와 분모를 공개. 이는 Phase1의 확장 학습 walk-forward와 다름.
95% 구간: 같은 인덱스를 모든 모델에 적용하는 2000회 circular moving-block bootstrap, block length 20. AP·Top10 포착률·정밀도·Lift와 RF 대비 차이. block length10/40의 민감도도 공개. 재학습을 포함하지 않고 선택 편향·장기 drift·시간 의존성을 완전히 해결하지 않음. 순위와 Top-K는 매 bootstrap sample에서 다시 계산.
판정: 두 주지표(AP와 Top10 포착률)의 차이 구간 하한이 모두 0 초과일 때만 개선 근거, 모두 상한이 0 미만이면 악화 근거. 그 외 차이 불명확; 점추정 증감은 별도 표시. 독립 검증 전 운영 교체 추천 없음.

## 설명과 독립 데이터

설명 수정은 성능 개선으로 계산하지 않는다. RF 전체 중요도는 모든 건에 동일하며 개별 원인 아님. 이번 실험에 SHAP 등 새 설명 의존성/기능을 추가하지 않는다. 추후 local attribution은 학습 background 고정·합산 일치·안정성·상관 변수 민감도를 별도로 검증해야 한다.
원본 SECOM 재다운로드·PV 자료·합성 SMT/fixture는 독립 제조 평가 아님. 입력명590개 일치만으로 의미 호환성을 가정하지 않는다.
