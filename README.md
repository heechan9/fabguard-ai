<div align="center">

# FabGuard AI

### 반도체 생산 데이터에서 먼저 확인할 공정 기록을 찾는 AI 의사결정 지원 프로젝트

**Leakage-aware risk prioritization for reproducible semiconductor manufacturing AI**

<p><strong>공개 반도체 데이터 1,567건 → 위험도 순 정렬 → 엔지니어 우선점검</strong></p>

<p>
  <a href="https://fabguard-ai.vercel.app"><strong>웹 데모 바로 보기 →</strong></a>
  · <a href="#3줄로-보는-현재-상태">현재 결과</a>
  · <a href="#빠른-시작">직접 실행</a>
</p>

<img src="docs/assets/fabguard-dusk-hero-v3.jpg" alt="노을에서 야간으로 이어지는 대형 반도체 팹과 엔지니어의 데이터 기반 위험 검토를 표현한 독자 제작 콘셉트 이미지" width="820">

<br>

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-ML_Pipeline-F7931E?logo=scikitlearn&logoColor=white)
![Data](https://img.shields.io/badge/UCI_SECOM-1%2C567_runs-6257E8)
![Validation](https://img.shields.io/badge/status-provisional-E9A23B)
![Human in the loop](https://img.shields.io/badge/decision-engineer_in_control-00A7B5)

590개 익명 측정값을 분석해 위험도가 높은 생산 건을 앞에 배치하고,  
엔지니어가 제한된 점검 시간을 어디에 먼저 사용할지 돕습니다.

[Evidence](#핵심-결과) · [Validation](#검증과-주장-경계) · [Contributions](CONTRIBUTIONS.md)

</div>

> **이미지 안내**  
> 위 이미지는 FabGuard의 목표 운영상과 협업 방식을 표현한 독자 제작 콘셉트입니다. 실제 반도체 공장, 제휴 조직, 구현 화면 또는 현장 배포 성과를 나타내지 않습니다.

---

## 3줄로 보는 현재 상태

| 해결하는 문제 | 지금 확인된 결과 | 아직 주장하지 않는 것 |
|---|---|---|
| 모든 생산 건을 다 볼 수 없을 때 **어디부터 점검할지** 정합니다. | 후기 검증구간 상위 10%인 **40건을 점검해 불량 5/24건을 포착**했습니다. | 실제 공장 배포, 수율 개선, 비용 절감, 불량 원인 규명은 아직 검증하지 않았습니다. |

> 한 문장으로: **FabGuard는 불량 판정기가 아니라, 제한된 점검 시간을 위험도가 높은 생산 건에 먼저 쓰도록 돕는 의사결정 지원 도구입니다.**

## 30초 요약

| 질문 | 답변 |
|---|---|
| 어떤 문제를 해결하나요? | 모든 생산 건을 동시에 정밀 점검하기 어려울 때, 먼저 볼 대상을 정합니다. |
| AI는 무엇을 하나요? | 공개 생산 데이터를 분석해 생산 건별 위험점수와 우선순위를 제시합니다. |
| AI가 불량을 확정하나요? | 아니요. 실제 확인과 조치 결정은 엔지니어가 합니다. |
| 현재 어디까지 구현됐나요? | 공개 UCI SECOM 데이터의 오프라인 실험, Top-K 우선점검 목록과 웹 데모까지 구현했습니다. |
| 실제 공장 효과가 검증됐나요? | 아직 아닙니다. 수율 개선·비용 절감·실시간 공장 연동은 주장하지 않습니다. |

### 목적에 따라 바로 보기

| 처음 방문한 분 | 제조·데이터 엔지니어 | 기술 검토·협업 |
|---|---|---|
| [웹 데모에서 작동 방식 확인](https://fabguard-ai.vercel.app) | [실험계약](EXPERIMENT_CONTRACT.md) · [정본 결과](results/v1/RESULTS_SUMMARY.md) | [재현성 가이드](REPRODUCIBILITY.md) · [기여 구분](CONTRIBUTIONS.md) |
| 문제 → 위험순위 → 사람의 판단을 한 화면에서 봅니다. | 데이터 분할·누출 방지·평가지표를 확인합니다. | 테스트·검증 설계·외부 연계 로드맵을 검토합니다. |

## 프로젝트에서 증명한 역량

| 문제와 판단 | 수행 내용 | 확인 가능한 근거 | 실무 연결 |
|---|---|---|---|
| 불균형 데이터에서 정확도만으로 모델을 고르기 어렵다고 판단 | PR-AUC·Fail Recall·Top-K 포착률을 함께 정의하고 시간순 홀드아웃으로 평가 | `results/v1/` 정본 결과, 실험계약, 자동 테스트 | 제조 데이터 분석·품질 위험 우선순위화 |
| 고정 임계값 자동판정이 실패한 결과를 숨기지 않음 | 모델 역할을 “불량 확정”이 아닌 “먼저 확인할 생산 건 추천”으로 재정의 | Fail recall 0, 상위 10%에서 불량 5/24 포착 | 제한된 점검 자원의 의사결정 지원 |
| 공개데이터 결과를 현장 성과로 과장할 위험을 통제 | 구현 범위와 미검증 범위를 분리하고 단계적 현장 검증안을 문서화 | 데이터셋 카드, 테스트 노출 기록, 현장 검증 계획 | 재현성·문서화·검증 중심의 프로젝트 운영 |

> **역할:** 최희찬이 문제 정의, 요구사항·평가지표·공개데이터 및 활용 시나리오 선정, 결과 검토와 저장소 운영을 담당했습니다. 코드 작성과 검증의 세부 주체는 [기여 구분](CONTRIBUTIONS.md)에 기록합니다.

## 작동 방식

```mermaid
flowchart LR
    A["생산 측정값"] --> B["누출 방지 전처리"]
    B --> C["AI 위험점수"]
    C --> D["Top-K 우선점검 목록"]
    D --> E["엔지니어 확인·판단"]
```

1. **데이터 입력** — 1,567개 생산 기록과 590개 익명 측정변수를 사용합니다.
2. **위험도 계산** — 전처리와 모델 선택을 학습 구간 안에서 수행해 정보 누출을 줄입니다.
3. **우선순위 제시** — 위험도가 높은 생산 건부터 Top 5%·10%·20%로 정렬합니다.
4. **사람의 판단** — 엔지니어가 실제 센서·설비·공정 이력과 대조한 뒤 조치를 결정합니다.

## 웹 데모

### [FabGuard AI 웹사이트 열기 →](https://fabguard-ai.vercel.app)

웹 데모에서는 다음을 확인할 수 있습니다.

- AI가 정렬한 우선점검 생산 건 50개
- 생산 건별 위험점수와 실제 결과
- 먼저 확인할 익명 측정변수
- 점검 범위별 불량 포착률
- 모델의 검증 방법과 주장하지 않는 범위
- Phase 1 확률 보정·비용 시나리오·시간구간 변동성

## 핵심 결과

후기 시간구간 392건을 별도 검증구간으로 두고 평가한 **잠정 결과**입니다.

| 확인 항목 | 결과 | 일반적인 의미 |
|---|---:|---|
| 검증구간 실제 불량 | 24건 | 392건 가운데 확인된 불량 수 |
| 상위 10% 점검 | 40건 | 위험도가 높은 40건을 먼저 확인 |
| 먼저 찾은 불량 | 5 / 24건 | 전체 불량의 20.8% 포착 |
| 무작위 점검 대비 효율 | 2.04배 | 같은 수를 무작위로 봤을 때보다 높은 포착 밀도 |
| Test PR-AUC | 0.0935 | 불균형 데이터에서 위험순위 품질을 보는 지표 |
| 고정 임계값 Fail recall | 0 | 0.5 기준 자동 불량 판정에는 실패 |

> **결과를 이렇게 읽어야 합니다**  
> 고정 기준으로 불량을 자동 판정할 성능은 확보하지 못했습니다. 다만 점검할 수 있는 수가 제한된 상황에서 위험도가 높은 생산 건을 먼저 보는 약한 순위 신호를 확인했습니다. 이는 실제 수율 개선이나 불량 원인 규명의 증거가 아닙니다.

### Phase 1 고급 검증 결과

동일한 후기 홀드아웃을 유지한 추가 검증의 **잠정 결과**입니다. 비용 단위는 실제 원화가 아니라 운영 시나리오 비교용 가정입니다.

| 검증 항목 | 결과 | 해석 경계 |
|---|---:|---|
| Brier score | 0.0654 → 0.0599 | 학습기간 말단 보정 구간에서 확률오차 개선 |
| Expected calibration error | 0.0922 → 0.0401 | 10개 구간 중 실제 표본이 존재한 구간은 4개 |
| 상위 10% 불량 포착률 | 평균 20.1%, 95% CI 6.2–36.8% | bootstrap 2,000회, 불확실성 큼 |
| 상위 20% 시나리오 비용 | 399 | 무점검 480 대비 81 감소; 점검 1·미탐 20 가정 |
| Walk-forward PR-AUC | 0.054–0.280 | 시간구간별 변동이 커 지속 모니터링 필요 |

희소 불량 구간에서는 최소 클래스 표본이 5-fold보다 적다는 경고가 발생했습니다. 실행 실패는 아니지만, 이 결과를 확정 성능이나 현장 효과로 해석하지 않는 근거입니다.

## 왜 자동 판정이 아닌가요?

익명 변수만으로는 어떤 센서·설비·공정 조건이 불량을 일으켰는지 알 수 없습니다. 따라서 FabGuard는 모델 점수를 **판정**이 아닌 **점검 시작점**으로 사용합니다.

| AI가 제공하는 것 | 엔지니어가 결정하는 것 |
|---|---|
| 생산 건별 위험점수 | 실제 불량 여부 |
| 위험도 기반 검토 순서 | 재검사·설비점검 여부 |
| 우선 확인할 익명 변수 | 변수의 실제 센서·공정 의미 |
| Top-K 점검 범위 | 최종 공정 조치와 기록 |

## 현재 구현 범위

### 구현 완료

- UCI SECOM 데이터 감사와 데이터셋 카드
- 결측치 처리·상수 제거 등 누출 방지 학습 파이프라인
- Dummy·L1 Logistic Regression·Random Forest 비교
- 반복 교차검증과 후기 시간구간 홀드아웃 평가
- PR-AUC·Fail Recall·Top-K 포착률·Lift 산출
- 생산 건별 우선점검 목록과 정적 웹 데모
- 실험계약·결과 파일·재현 절차 문서화

### 아직 구현하거나 검증하지 않음

- 실제 MES·FDC·APC·SPC 시스템 연동
- 실시간 센서 수집과 생산 제어
- 익명 변수의 실제 공정·센서 매핑
- 현장 수율 개선·비용 절감·고장 예방 효과
- 독립 공장 데이터와 다중 현장 검증

## 검증과 주장 경계

- 모델 선택은 학습 데이터의 5×5 반복 층화 교차검증에서 수행했습니다.
- 마지막 25% 시간구간은 별도 홀드아웃으로 보존했습니다.
- 데이터 의존 전처리는 학습 폴드 안에서만 적합했습니다.
- 개발 중 홀드아웃이 먼저 노출된 이력은 [TEST_EXPOSURE.md](docs/TEST_EXPOSURE.md)에 공개했습니다.
- 현장 효과는 단순 전후 비교로 주장하지 않고, 무작위·단계적 도입 또는 조건에 맞는 준실험 설계를 검토합니다.

자세한 실험 조건은 [실험계약](EXPERIMENT_CONTRACT.md), 현장 검증 계획은 [인과효과 검증 계획](docs/CAUSAL_FIELD_VALIDATION.md)에서 확인할 수 있습니다.

<details>
<summary><strong>Open engineering & collaboration</strong> — 재현·검토·기여 경로 보기</summary>

FabGuard is a reviewable industrial-AI prototype rather than a black-box demo. Engineers can inspect the data boundary, reproduce the experiment, challenge the metrics, and propose improvements without private fab data.

| Engineering signal | Where to review it |
|---|---|
| Leakage-aware preprocessing and temporal holdout | [Experiment contract](EXPERIMENT_CONTRACT.md) |
| Reproducible commands, artifacts, and raw-data hashes | [Reproducibility guide](REPRODUCIBILITY.md) |
| Cost-aware Top-K review, uncertainty, drift, and walk-forward checks | [Phase 1 validation](docs/PHASE1_ADVANCED_VALIDATION.md) |
| Boundary between prototype evidence and factory claims | [Dataset card](DATASET_CARD.md) · [field validation plan](docs/CAUSAL_FIELD_VALIDATION.md) |
| Staged path to external industrial open source | [Roadmap](ROADMAP.md) |

Focused issues and reviewable pull requests are welcome, especially for validation design, data-contract tests, drift diagnostics, calibration, documentation, and contract-preserving adapters.

</details>

## 빠른 시작

```bash
git clone https://github.com/heechan9/fabguard-ai.git
cd fabguard-ai

# 테스트
PYTHONPATH=src python -m unittest discover -s tests -v

# 정적 웹 데모
python -m http.server 8000 -d web
```

브라우저에서 `http://localhost:8000`을 열면 됩니다.

전체 실험을 다시 실행하려면 공식 [UCI SECOM ZIP](https://archive.ics.uci.edu/static/public/179/secom.zip)을 `data/raw/`에 풀고 다음 명령을 사용합니다.

```bash
PYTHONPATH=src python -m fabguard.data --data-dir data/raw --output-dir results/v1
PYTHONPATH=src python -m fabguard.experiment --data-dir data/raw --output-dir results/v1
PYTHONPATH=src python -m fabguard.reporting --data-dir data/raw --result-dir results/v1 --web-data-dir web/data
```

## 저장소 구성

| 경로 | 역할 |
|---|---|
| `src/fabguard/` | 데이터 처리·학습·평가·보고 코드 |
| `web/` | 일반 사용자용 정적 웹 데모 |
| `results/v1/` | 정본 실험 결과와 우선점검 목록 |
| `tests/` | 데이터 계약과 파이프라인 검증 |
| `docs/` | 운영 설계·화면·검증·직무 연계 문서 |
| `evals/` | 완료 기준과 평가 사례 |

## 문서 안내

| 문서 | 내용 |
|---|---|
| [결과 요약](results/v1/RESULTS_SUMMARY.md) | 모델별 성능과 Top-K 결과 |
| [데이터셋 카드](DATASET_CARD.md) | 데이터 출처·구성·사용 한계 |
| [실험계약](EXPERIMENT_CONTRACT.md) | 분할·전처리·평가 불변조건 |
| [재현성 가이드](REPRODUCIBILITY.md) | 환경·명령·산출물 재현 절차 |
| [프로젝트 로드맵](ROADMAP.md) | FabGuard → Fledge → Solar Data Tools 단계적 확장과 진입 조건 |
| [Industrial AI 운영 설계](docs/INDUSTRIAL_AI_DESIGN.md) | 확률모델·가드레일·인간 검토 구조 |
| [스마트팩토리 연계](docs/SMART_FACTORY_INTEGRATION.md) | MES·FDC 목표 구조와 KPI 경계 |
| [현장 인과효과 검증](docs/CAUSAL_FIELD_VALIDATION.md) | RCT·단계적 도입·준실험 검증 계획 |
| [Phase 1 고급 검증](docs/PHASE1_ADVANCED_VALIDATION.md) | 비용 기반 Top-K·불확실성·드리프트·walk-forward·확률 보정 |
| [직무 연계](docs/ROLE_ALIGNMENT.md) | 구현 증거와 반도체 직무 연결 |
| [AI 활용·기여](AI_USAGE.md) | 사람·AI 협업과 검증 원칙 |
| [기여 구분](CONTRIBUTIONS.md) | 프로젝트 소유자와 Codex 역할 |

## 기술 구성

- **Language:** Python 3.11
- **ML:** scikit-learn Pipeline, Logistic Regression, Random Forest
- **Evaluation:** Repeated Stratified CV, temporal holdout, PR-AUC, Top-K capture
- **Web:** HTML, CSS, JavaScript, Vercel static deployment
- **Data:** UCI SECOM, 1,567 production runs, 590 anonymous measurements

## 현재 한계

- 결과는 공개 데이터 한 개에서 얻은 오프라인 실험값입니다.
- 클래스 불균형과 시간 변화 때문에 후기 검증구간 성능이 낮아졌습니다.
- 익명 변수는 불량 원인이 아니라 점검 후보입니다.
- Top-K 결과는 점검 우선순위 가능성을 보여줄 뿐 실제 공장 KPI 개선을 증명하지 않습니다.
- 독립 데이터 재검증과 실제 작업 기록을 포함한 현장 시험이 필요합니다.

---

<div align="center">

**AI는 점검 순서를 제안하고, 최종 판단은 엔지니어가 합니다.**

</div>
