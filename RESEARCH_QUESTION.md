# FabGuard AI 연구질문

상태: **V1 연구질문 동결 · 결과는 잠정적(provisional)**

## 1. 핵심 연구질문

> 시간 순서상 과거의 UCI SECOM 생산 기록으로 학습한 위험순위 모델이, 아직 보지 않은 미래
> 구간에서 제한된 점검예산 안에 Fail 생산 건을 무정보 기준선보다 더 많이 우선 배치하는가?

FabGuard는 자동 합격·불합격 판정이나 원인진단 시스템을 연구하지 않는다. 연구 대상은
**희소한 Fail과 제한된 점검예산이 있는 상황의 우선순위화**다.

## 2. 반증 가능한 가설

- **H1 — 순위 품질:** 마지막 25% 시간순 구간에서 선택 모델의 Average Precision이 같은
  구간의 Dummy 기준선보다 높다.
- **H2 — 제한 예산:** 사전에 고정한 Top-10% 점검예산에서 Fail capture와 lift가 무작위
  점검 기대보다 높다. Top-5%와 Top-20%는 민감도 분석이다.
- **H3 — 시간 안정성:** walk-forward 구간과 반복 교차검증에서 성능 변동이 운영 판단을
  무효화할 만큼 크지 않다.

H1·H2가 한 번의 잠정 홀드아웃에서 성립해도 현장 유효성은 증명되지 않는다. H3의 큰 변동,
독립 데이터 재현 실패 또는 데이터 자격 미달은 연구가설을 기각하거나 보류할 근거다.

## 3. 분석 단위와 결정 단위

| 항목 | 동결 정의 |
|---|---|
| 분석 단위 | 익명 측정변수 590개를 가진 생산 기록 1건 |
| 대상 | 1,567건, Fail 104건의 UCI SECOM 공개데이터 |
| 학습/평가 | 앞 75% Train 1,175건 / 뒤 25% Test 392건 |
| 모델 출력 | Fail 확정값이 아닌 연속 위험점수와 순위 |
| 주평가지표 | Average Precision(PR-AUC), Top-10% Fail capture, precision, lift |
| 결정권자 | 공정·품질 엔지니어. 모델은 점검 순서만 제안 |

전처리와 후보 선택은 Train 내부에서만 수행한다. 익명 변수는 물리 센서나 공정 원인으로
해석하지 않는다. 자세한 실행 규칙은
[`docs/validation/EXPERIMENT_CONTRACT.md`](docs/validation/EXPERIMENT_CONTRACT.md)에 둔다.

## 4. 현재 답변

Train 내부 5×5 반복 교차검증에서 선택된 Random Forest의 평균 AP는 `0.2155 ± 0.0650`,
시간순 홀드아웃 AP는 `0.0935`였다. Top-10%에서는 392건 중 40건을 우선점검해 Fail 24건 중
5건을 포착했다(20.8%, precision 12.5%, lift 2.04×). 그러나 0.5 임계값은 Fail을 한 건도
분류하지 못했다.

따라서 현재 답변은 **약하지만 0이 아닌 우선순위 신호가 관찰됐다**는 수준이다. 홀드아웃이
엔지니어링 스모크 과정에서 먼저 노출됐으므로 확정 성능이 아니다. 정본 수치와 노출 이력은
[`results/v1/RESULTS_SUMMARY.md`](results/v1/RESULTS_SUMMARY.md)와
[`docs/TEST_EXPOSURE.md`](docs/TEST_EXPOSURE.md)에 있다.

## 5. 주장하지 않는 것

- 실제 수율·불량률·비용·가동률·리드타임 개선
- 자동 Fail 판정, 공정 제어, 이상 원인 또는 익명 변수의 물리적 의미
- PV·기상·로봇·합성 SMT 자료를 이용한 SECOM 모델의 외부 성능
- NVIDIA TAO AOI 모델의 학습·검증·배포 완료

## 6. 다음 답변 조건

V2 답변은 동결 모델, 독립 제조 데이터, 사전 승인된 평가계획, 데이터 출처·권리·스키마·라벨
검증을 모두 확보한 뒤 단 한 번 생성한다. 조건은 [`docs/V2_PROTOCOL.md`](docs/V2_PROTOCOL.md),
외부 자료의 자격은 [`docs/EXTERNAL_DATA_QUALIFICATION.md`](docs/EXTERNAL_DATA_QUALIFICATION.md)를
따른다.

