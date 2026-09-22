# FabGuard AI — 1페이지 검증 요약

> **문제 정의:** 제한된 점검 여력 안에서 어떤 반도체 생산 기록을 엔지니어가 먼저 확인할지 순서를 제안한다. 자동 합격·불합격 판정이나 공정 제어가 목적이 아니다.

## 현장 의사결정 구조

| 운영 질문 | FabGuard가 제공하는 것 | 사람의 책임 |
|---|---|---|
| 무엇을 해결할 것인가? | 제한된 점검 여력에서 먼저 볼 생산 기록을 정하는 문제로 범위를 고정한다. | 현장 담당자가 실제 판단 목적과 점검 가능 건수를 확인한다. |
| 어떤 근거로 순서를 정하는가? | 생산 이력의 연속 점수와 Top-K 점검예산으로 검토 순서를 제안하고 근거의 한계를 함께 표시한다. | 엔지니어가 4M·변동점·품질 이력과 대조해 재검사·설비점검 여부를 결정한다. |
| 결과를 어떻게 되돌려 쓰는가? | 향후 조치·최종 품질·사람의 override를 감사 가능한 기록으로 연결하는 구조를 제안한다. | 실제 결과를 확인하고 다음 운영규칙을 바꿀지 승인한다. 현재 이 피드백 저장은 현장 구현 전이다. |

이 구조는 현장 요구를 데이터 근거와 제한 자원 배분으로 연결하되, 최종 결정권을 사람에게 남기는 **목표 운영모델**이다. 현재 구현 범위는 아래 공개 데이터의 오프라인 평가까지다.

## 30초 방법론 확인

| 검증 장치 | 확인된 내용 | 원본 근거 |
|---|---|---|
| 시간순 홀드아웃 | 앞 75%로 개발하고 뒤 25%(392건)를 시간순 평가 구간으로 분리했다. 홀드아웃은 엔지니어링 스모크에서 먼저 노출돼 현재 결과는 잠정적이다. | [정본 결과](../results/v1/RESULTS_SUMMARY.md) · [노출 기록](TEST_EXPOSURE.md) |
| 최종 재실행 전 고정한 실험계약 | 분할, Train-only 전처리, 주지표 Average Precision, Top-K 점검예산과 주장 경계를 코드 실행 전에 문서로 고정했다. | [실험계약](validation/EXPERIMENT_CONTRACT.md) · [재현 방법](validation/REPRODUCIBILITY.md) |
| RF 대 Logistic 통계검정 | 공유된 5개 repeat 평균을 짝으로 비교했다. Random Forest의 평균 AP 차이는 `+0.0382`, 양측 exact sign-flip `p=0.0625`로 5% 기준 통계적 유의성을 주장하지 않는다. | [Phase 1 검증](PHASE1_ADVANCED_VALIDATION.md) · [paired 비교 원자료](../results/phase1/model_pairwise_comparison.csv) |
| Bootstrap 불확실성 | Top-10% Fail 포착률의 95% bootstrap 구간은 `6.2%–36.8%`(2,000회)로 넓다. 다른 공장으로의 일반화를 뜻하지 않는다. | [Phase 1 검증](PHASE1_ADVANCED_VALIDATION.md) · [bootstrap 원자료](../results/phase1/top_k_bootstrap.csv) |
| Walk-forward 변동성 | 네 시간 구간의 PR-AUC는 `0.054–0.280`으로 변동해 단일 홀드아웃 값을 대표 성능으로 확대하지 않는다. | [Phase 1 검증](PHASE1_ADVANCED_VALIDATION.md) · [walk-forward 원자료](../results/phase1/walk_forward_metrics.csv) |

## 정직성 서사

**0.5 임계값에서 Fail을 한 건도 분류하지 못했다(TP=0) → 실패를 숨기지 않고, 제한된 점검예산에서 연속 점수로 검토 순서를 정하는 문제로 범위를 재정의했다.**

근거: [V1 정본 결과](../results/v1/RESULTS_SUMMARY.md) · [핵심 연구질문](../RESEARCH_QUESTION.md) · [실패 거버넌스](FAILURE_GOVERNANCE.md)

## 국제 데이터 검증 현황

국가별 확장은 **관측(observed)·추정(estimated)·기준(reference)·합성(synthetic)** 네 유형을 분리하고 출처·스키마·시간·단위·해시·주장 경계를 같은 계약으로 검사한다. 이는 데이터 파이프라인 호환성 검증이며 SECOM 모델의 외부 성능 증거가 아니다.

근거: [외부 데이터 자격 심사](EXTERNAL_DATA_QUALIFICATION.md) · [국가별 결과 목록](../results/README.md) · [PV_Live E2E 계약](PVLIVE_LOCAL_E2E.md)

## 이 요약이 말하지 않는 것

- 실제 반도체 공장에서의 현장 검증 또는 배포 완료
- 수율·불량률·가동률·리드타임·비용 개선
- 익명 변수의 물리적 의미, 불량 원인 또는 인과효과
- 자동 Fail 판정, 공정 제어 또는 엔지니어 승인 대체
- PV·기상·로봇·합성 SMT 자료를 이용한 SECOM 성능 향상

다음 확인 실험은 독립 제조 데이터, 동결 모델과 사전 승인된 1회 평가가 준비된 뒤에만 수행한다: [V2 독립 확인 프로토콜](V2_PROTOCOL.md).
