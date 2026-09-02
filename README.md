# FabGuard AI

반도체 제조 공정 데이터에서 Fail 위험이 높은 생산 건을 우선순위화하고, 엔지니어가 먼저 확인할 익명 측정변수를 근거로 제시하는 재현 가능한 의사결정 지원 프로젝트입니다.

## Day 14 데모

보존된 테스트 데이터에서 생산 건별 위험순위, 예측 위험도, 우선 확인 변수와 전체 평가 결과를 3분 안에 보여줍니다.

- **Live demo:** https://fabguard-ai.vercel.app
- **Repository:** https://github.com/heechan9/fabguard-ai

## V1 실제 결과

상태: **Provisional** - 개발 스모크 과정의 holdout 노출은 [docs/TEST_EXPOSURE.md](docs/TEST_EXPOSURE.md)에 기록했습니다.

- Train 5×5 반복 CV 선택 모델: `random_forest_depth_none_leaf_8`
- Train CV Average Precision: `0.2155 ± 0.0650`
- 후기 시간구간 Test Average Precision: `0.0935`
- 0.5 임계값 Test: `TP=0, FP=0, FN=24, TN=368`
- Top-10%: 392건 중 40건 점검, Fail `5/24` 포착(`20.8%`), precision `12.5%`, lift `2.04×`

결론은 고정 임계값 Fail 분류가 운영에 충분하지 않았지만 제한된 점검 예산의 위험순위화에는 약한 신호가 남았다는 것입니다. 수율 개선이나 실제 원인 규명은 주장하지 않습니다.

## Industrial AI 운영 설계

FabGuard는 확률모델을 자동 품질판정기로 사용하지 않습니다. 모델은 연속 위험점수와 우선순위를 제시하고, 점검예산 5%·10%·20%를 결정론적 가드레일로 적용하며, 최종 판단과 조치는 공정 엔지니어가 수행하는 구조입니다.

우선순위 큐에서 제시하는 익명 측정변수는 원인이 아니라 후속 점검 후보입니다. 실제 적용 시에는 변수의 센서·공정 매핑을 확인한 뒤 4M, 변동점 기록, 품질 이력과 대조해야 합니다. 반도체 공정별 계측·검사 항목과 검사 결과의 엔지니어 피드백 흐름도 운영 맥락으로 참고하되, 익명 변수를 실제 공정명이나 결함 원인으로 임의 해석하지 않습니다.

실제 스마트 팹 확장에는 데이터 거버넌스, 변수-공정 매핑, 지속 모니터링·재검증, 엔지니어 승인 체계가 추가로 필요하며 V1은 생산 보안·MLOps·공장 시스템 연동을 구현하지 않습니다. 이 운영 설계에 영향을 준 외부 산업·직무 참고자료의 일반 원칙과 적용·비적용 범위는 [docs/INDUSTRIAL_AI_DESIGN.md](docs/INDUSTRIAL_AI_DESIGN.md)에 구분해 기록했습니다.

목표 현장 구조에서는 MES·FDC·검사시스템의 추적 가능한 생산 데이터를 FabGuard가 위험점수와 Top-K 점검 큐로 변환하고, 엔지니어의 판단과 후속 결과를 다시 기록합니다. 현재 V1은 이 중 오프라인 위험순위화만 구현했습니다. 모델·운영·제조·사업 KPI의 증거 경계와 도입 준비사항은 [docs/SMART_FACTORY_INTEGRATION.md](docs/SMART_FACTORY_INTEGRATION.md)에 정리했습니다.

실제 도입 효과는 단순 전후 비교만으로 주장하지 않습니다. 무작위 또는 단계적 현장시험을 우선 검토하고, 불가능한 경우 자연실험·이중차분 또는 조건을 충족한 cutoff 기반 불연속회귀를 검토하는 계획을 [docs/CAUSAL_FIELD_VALIDATION.md](docs/CAUSAL_FIELD_VALIDATION.md)에 명시했습니다. 이는 향후 검증 설계이며 완료된 현장 성과가 아닙니다.

## 외부 비교와 방법론적 근거

SECOM 데이터셋에 대한 FabGuard의 실험에서, 선택된 Random Forest 모델은 0.5 고정 임계값 기준 시간순 홀드아웃(마지막 25%, 392건)에서 Fail recall 0(24건 중 0건 포착)을 기록했습니다. 이 결과와 관련해 참고할 수 있는 외부 자료로, 2026년 공개된 독립 벤치마크 연구 [Patel, _Lightweight Transformer Models for On-Device Fault Detection_](https://arxiv.org/abs/2606.24173)가 있습니다. 해당 연구는 SECOM(1,567건, 562변수, 결측 50% 초과 컬럼 제거 기준)에 무작위 층화 80/20 분할을 적용해 전통적 ML(Random Forest, XGBoost, SVM, 로지스틱 회귀)과 경량 트랜스포머를 비교했으며, Random Forest(RF-200)의 SECOM F1을 0.0%로 보고했습니다.

논문에 제시된 F1과 FabGuard의 0.5 임계값 기준 Fail recall은 서로 다른 평가값이므로 수치 자체를 직접 대응시킬 수 없습니다. 또한 해당 벤치마크는 FabGuard의 시간순 홀드아웃과 달리 무작위 층화 분할을 사용해 평가 설계가 다릅니다. 따라서 두 결과를 같은 실험의 재현으로 단정하거나, 논문 한 편과 FabGuard 실험만으로 SECOM의 일반적인 특성이라고 확대해석하지 않습니다. 이 사례는 최근 공개된 한 독립 벤치마크에서 관찰된 고정 임계값 기반 이진 분류의 유사한 실패 양상이며, FabGuard가 자동 판정 대신 연속 위험점수 기반 Top-k 순위화로 접근 방식을 전환한 결정의 제한적인 참고 근거입니다.

리키지 방지 전처리 설계의 방법론적 근거로는 [Korkmaz et al., _fastml: Guarded Resampling Workflows for Safer Automated Machine Learning in R_](https://arxiv.org/abs/2604.05225)의 몬테카를로 시뮬레이션을 참고했습니다. 이 연구는 10개 사이트에 걸쳐 사이트별 오프셋을 평균 5, 표준편차 5의 정규분포에서 생성한 강한 배치 효과를 인위적으로 부여한 합성 데이터에서 전역 전처리와 폴드 내부 전처리를 비교했고, 평균 0.158(95% CI 0.149–0.167)의 ROC-AUC 차이를 관찰했습니다.

이 수치는 강한 배치 효과와 그룹 단위 리키지를 가정한 해당 시뮬레이션의 결과이며, FabGuard가 실제로 겪었거나 겪었을 리키지 규모를 추정하거나 대변하지 않습니다. FabGuard는 수치 자체가 아니라 전처리를 리샘플링 밖에서 전역으로 수행하면 성능 지표가 체계적으로 부풀려질 수 있다는 메커니즘을 참고했고, 이에 따라 모든 데이터 의존 전처리를 학습 폴드 내부로 한정했습니다.

## 프로젝트 경계

- 공개 UCI SECOM 데이터만 사용합니다.
- 실제 불량 원인을 규명했다고 주장하지 않습니다.
- 실시간 FDC/APC/SPC 시스템이나 생산 배포를 구현하지 않습니다.
- 딥러닝, LLM, RAG, 대형 대시보드는 V1 범위에서 제외합니다.
- 테스트 세트는 모델·임계값·특성 선택 결정에 사용하지 않고 최종 1회만 평가합니다.

## V1 산출물

- 데이터 감사 및 Dataset Card
- 누출 방지 전처리·학습 파이프라인
- Dummy, L1 Logistic Regression, Random Forest 비교
- 반복 층화 교차검증과 시간순 보존 테스트 평가
- Fail Recall, PR-AUC, Balanced Accuracy, False Alarm Rate, Top-K Risk Capture
- 생산 건별 priority table
- 중요변수 안정성 분석
- 5~8페이지 결과 보고서와 3분 데모

## 실행과 데모

V1 전체 실험 산출물과 정적 결과 데모가 포함돼 있습니다. 로컬 데모는 아래 명령으로 실행한 뒤 `http://localhost:8000`에서 확인합니다.

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
python -m http.server 8000 -d web
```

Vercel에서는 이 저장소를 Import하면 루트의 `vercel.json`이 Python 실험 코드와 분리된 `web/` 정적 출력 디렉터리를 설정합니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fheechan9%2Ffabguard-ai)

## 전체 재현

공식 [UCI SECOM ZIP](https://archive.ics.uci.edu/static/public/179/secom.zip)을 `data/raw/`에 풀고 실행합니다. 원본 해시가 계약값과 다르면 즉시 중단합니다.

```bash
PYTHONPATH=src python -m fabguard.data --data-dir data/raw --output-dir results/v1
PYTHONPATH=src python -m fabguard.experiment --data-dir data/raw --output-dir results/v1
PYTHONPATH=src python -m fabguard.reporting --data-dir data/raw --result-dir results/v1 --web-data-dir web/data
PYTHONPATH=src python -m unittest discover -s tests -v
python -m http.server 8000 -d web
```

## 문서

- [PRD.md](PRD.md): 문제, 사용자, 범위
- [PLAN.md](PLAN.md): 14일 수직 슬라이스
- [docs/FLOW.md](docs/FLOW.md): 데이터와 실패 경로
- [docs/SCREENS.md](docs/SCREENS.md): 화면·상태 명세
- [docs/INDUSTRIAL_AI_DESIGN.md](docs/INDUSTRIAL_AI_DESIGN.md): 확률모델·가드레일·인간 검토 운영 설계
- [docs/SMART_FACTORY_INTEGRATION.md](docs/SMART_FACTORY_INTEGRATION.md): MES·FDC 목표 연계, KPI 경계와 현장 도입 체크리스트
- [docs/CAUSAL_FIELD_VALIDATION.md](docs/CAUSAL_FIELD_VALIDATION.md): RCT·단계적 도입·이중차분·불연속회귀 기반 현장 인과효과 검증 계획
- [docs/ROLE_ALIGNMENT.md](docs/ROLE_ALIGNMENT.md): 구현 증거와 기반기술·양산기술·PKG&TEST 직무 연결, 인터뷰 가이드
- [evals/cases.md](evals/cases.md): 완료 판정 기준
- [DATASET_CARD.md](DATASET_CARD.md): 데이터 사용 범위와 한계
- [REPRODUCIBILITY.md](REPRODUCIBILITY.md): 재현 명령과 산출물 계약
- [results/v1/RESULTS_SUMMARY.md](results/v1/RESULTS_SUMMARY.md): 실제 결과 요약
- [AI_USAGE.md](AI_USAGE.md): 사용자·Codex 기여와 검증 원칙
