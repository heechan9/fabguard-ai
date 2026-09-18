# 관련 연구와 FabGuard의 위치

상태: **범위 비교 · 성능 전용 금지**

이 문서는 FabGuard의 설계 선택이 어떤 선행 개념과 연결되는지 설명한다. 외부 연구의 수치를
FabGuard 성능으로 전용하지 않는다.

## 1. 비교 축

| 선행 영역 | FabGuard에 반영한 점 | FabGuard가 추가로 고정한 경계 |
|---|---|---|
| UCI SECOM 제조 데이터 | 희소 Fail과 고차원 익명 측정변수의 공개 연구 기반 | 시간순 75/25 분리, Train-only 전처리, 익명 변수 비인과 해석 |
| 불균형 분류 평가 | Precision–Recall과 Average Precision을 주 순위 지표로 사용 | Accuracy나 0.5 임계값 성공으로 포장하지 않고 Top-K 점검결정과 함께 보고 |
| 이상·품질 우선점검 | 모든 건의 자동판정보다 제한 자원의 검토 순서에 집중 | 점검예산 5/10/20%와 인간 최종승인, 미탐·오경보·실패 공개 |
| 시간 이동 검증 | 과거 학습과 미래 평가의 분포 차이를 드러냄 | 마지막 25% 홀드아웃과 walk-forward 변동을 분리 보고 |
| 산업 AI 거버넌스 | 신뢰성·타당성·추적성과 인간 감독을 운영요건으로 취급 | 해시·계약·실패·롤백·주장 경계를 저장소에서 추적 |
| AOI·시각검사 | 기준 이미지와 결함 이미지 비교형 TAO 후보를 별도 검토 | SECOM 표형 모델 및 합성 SMT와 분리, 실제 이미지·라벨·GPU 전에는 계획 상태 |

## 2. 구별되는 기여

FabGuard의 기여는 새로운 최고 정확도 모델이 아니다. 다음을 한 저장소에서 연결한 재현 가능한
의사결정 설계다.

1. 누출 방지형 Train-CV 모델 선택과 시간순 홀드아웃
2. 희소 Fail에 맞춘 PR-AUC와 제한 점검예산 Top-K 평가
3. 홀드아웃 조기 노출과 0.5 임계값 실패를 포함한 부정적 결과 공개
4. 모델 결과, 현장 검증 계획, 외부 데이터 파이프라인과 3D 합성 체험의 증거 분리
5. 동결 모델과 독립 데이터 없이는 새 성능값을 만들지 않는 fail-closed V2 경로

## 3. 한계와 열린 질문

- 한 개의 오래된 공개 제조 데이터셋과 익명 변수만 사용한다.
- 홀드아웃은 엔지니어링 스모크에서 먼저 노출돼 잠정 결과다.
- 장비·Lot·recipe·정비·교대·검사비용이 없어 공정 원인과 현장 효익을 평가할 수 없다.
- 모델 비교 repeat 수가 작고 시간구간별 변동이 크다.
- AOI, 로봇, PV 자료는 시스템 계약 연구이며 SECOM 성능을 보강하지 않는다.

따라서 다음 연구의 우선순위는 모델 복잡도 확대가 아니라 독립 제조 데이터 자격 심사와
사전등록된 V2 확인이다.

## 4. 주요 출처

- UCI Machine Learning Repository, **SECOM**: <https://archive.ics.uci.edu/dataset/179/secom>
- scikit-learn, **Precision-Recall**: <https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html>
- scikit-learn, **average_precision_score**: <https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html>
- NIST, **AI Risk Management Framework 1.0**: <https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf>
- NVIDIA TAO Toolkit, **Optical Inspection**: <https://docs.nvidia.com/tao/tao-toolkit/text/cv_finetuning/purpose_built_models/optical_inspection.html>

저장소 내부의 실제 결과와 제한은 [`RESEARCH_QUESTION.md`](RESEARCH_QUESTION.md),
[`results/v1/RESULTS_SUMMARY.md`](results/v1/RESULTS_SUMMARY.md),
[`docs/TEST_EXPOSURE.md`](docs/TEST_EXPOSURE.md)를 우선한다.

