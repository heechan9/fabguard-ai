# FabGuard AI

반도체 제조 공정 데이터에서 Fail 위험이 높은 생산 건을 우선순위화하고, 엔지니어가 먼저 확인할 익명 측정변수를 근거로 제시하는 재현 가능한 의사결정 지원 프로젝트입니다.

## Day 14 데모

보존된 테스트 데이터에서 생산 건별 위험순위, 예측 위험도, 우선 확인 변수와 전체 평가 결과를 3분 안에 보여줍니다.

## V1 실제 결과

상태: **Provisional** - 개발 스모크 과정의 holdout 노출은 [docs/TEST_EXPOSURE.md](docs/TEST_EXPOSURE.md)에 기록했습니다.

- Train 5×5 반복 CV 선택 모델: `random_forest_depth_none_leaf_8`
- Train CV Average Precision: `0.2155 ± 0.0650`
- 후기 시간구간 Test Average Precision: `0.0935`
- 0.5 임계값 Test: `TP=0, FP=0, FN=24, TN=368`
- Top-10%: 392건 중 40건 점검, Fail `5/24` 포착(`20.8%`), precision `12.5%`, lift `2.04×`

결론은 고정 임계값 Fail 분류가 운영에 충분하지 않았지만 제한된 점검 예산의 위험순위화에는 약한 신호가 남았다는 것입니다. 수율 개선이나 실제 원인 규명은 주장하지 않습니다.

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

Vercel에서는 이 저장소를 Import하면 루트의 `vercel.json`이 정적 데모 경로를 설정합니다.

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
- [evals/cases.md](evals/cases.md): 완료 판정 기준
- [DATASET_CARD.md](DATASET_CARD.md): 데이터 사용 범위와 한계
- [REPRODUCIBILITY.md](REPRODUCIBILITY.md): 재현 명령과 산출물 계약
- [results/v1/RESULTS_SUMMARY.md](results/v1/RESULTS_SUMMARY.md): 실제 결과 요약
- [AI_USAGE.md](AI_USAGE.md): 사용자·Codex 기여와 검증 원칙
