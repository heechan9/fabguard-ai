# FabGuard Phase 1: decision and temporal validation

## 검증 질문

V1의 시간 홀드아웃을 유지하면서 비용 기반 Top-K, bootstrap 불확실성, 변수 분포 변화,
walk-forward 성능과 확률 보정을 추가로 확인한다.

## 불변조건과 주장 경계

- V1 Train/Test 경계와 정본 결과를 수정하지 않는다.
- 모델 선택·학습·확률 보정은 평가 시점보다 앞선 데이터만 사용한다.
- 비용은 실제 원화가 아닌 민감도 분석용 **scenario cost unit**이다.
- bootstrap 구간은 현재 표본의 불확실성이며 다른 공장으로의 일반화를 보장하지 않는다.
- PSI는 분포 변화 경보 지표이며 원인이나 성능 저하를 단독으로 증명하지 않는다.
- 보정 전·후 결과를 모두 남기고 Test에 맞춰 보정법을 고르지 않는다.

## 산출물

| 파일 | 의미 |
|---|---|
| `calibration_metrics.csv` | 보정 전·후 Brier score와 ECE |
| `inspection_cost_scenarios.csv` | 점검·미탐 비용 가정별 Top-K 시나리오 |
| `top_k_bootstrap.csv` | 포착률·정밀도의 bootstrap 구간 |
| `feature_drift.csv` | 변수별 PSI와 결측률 변화 |
| `walk_forward_metrics.csv` | 확장창 기반 과거→미래 평가 |
| `manifest.json` | 설정·원본 해시·주장 경계 |

## 실행

```bash
PYTHONPATH=src python -m fabguard.advanced_experiment \
  --data-dir data/raw --output-dir results/phase1 \
  --bootstrap 2000 --inspection-cost 1 --missed-fail-cost 20
```

구조 확인에는 `--fast --bootstrap 100`을 사용한다. 실제 수치를 README에 올리기 전에는 전체 테스트,
공식 파일 해시, 동일 명령 재현, 시간구간별 Fail 수, 비용 단위 표기를 다시 확인한다.
