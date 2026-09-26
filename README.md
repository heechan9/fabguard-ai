<div align="center">

# FabGuard AI

### 반도체 생산 기록 중 무엇을 먼저 점검할지 알려주는 AI

**AI가 위험순위를 제안하고, 최종 판단과 조치는 엔지니어가 합니다.**

</div>

<!-- primary-navigation -->
<p align="center">
  <a href="https://fabguard-ai.vercel.app/"><strong>🌐 웹 데모 보기 →</strong></a> ·
  <a href="https://fabguard-ai.vercel.app/smt/">SMT 3D 실험실</a> ·
  <a href="https://fabguard-ai.vercel.app/secom/">반도체 분석</a> ·
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/results/v1/RESULTS_SUMMARY.md">📊 정본 결과</a> ·
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/PHASE1_ADVANCED_VALIDATION.md">🔬 상세 검증 결과</a> ·
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/validation/REPRODUCIBILITY.md">🧪 재현 방법</a> ·
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/project/ROADMAP.md">🗺️ 로드맵</a>
</p>
<!-- /primary-navigation -->

**파일 찾기:** [전체 문서 지도](docs/README.md) · [웹 코드 안내](web/README.md) · [결과 자료 목록](results/README.md)

<div align="center">

<img src="docs/assets/fabguard-dusk-hero-v3.jpg" alt="FabGuard의 목표 운영상과 엔지니어 중심 의사결정을 표현한 독자 제작 콘셉트 이미지" width="820">

<br>

<p>
  <a href="https://github.com/heechan9/fabguard-ai/actions/workflows/ci.yml"><img src="https://github.com/heechan9/fabguard-ai/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/pyproject.toml"><img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&amp;logoColor=white" alt="Python 3.11"></a>
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/validation/DATASET_CARD.md"><img src="https://img.shields.io/badge/UCI_SECOM-1%2C567_runs-6257E8" alt="UCI SECOM dataset"></a>
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/results/v1/RESULTS_SUMMARY.md"><img src="https://img.shields.io/badge/evidence-provisional-E9A23B" alt="Provisional evidence"></a>
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/project/PRD.md"><img src="https://img.shields.io/badge/final_decision-human-00A7B5" alt="Human final decision"></a>
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/project/ROADMAP.md"><img src="https://img.shields.io/badge/global_data_contract-roadmap-5B5FEF" alt="Global data roadmap"></a>
</p>

</div>

<!-- secondary-navigation -->
<p align="center">
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/MELBOURNE_COLLABORATION.md">🌏 English overview</a> ·
  <a href="https://github.com/heechan9/fabguard-ai#global-data-roadmap">🌍 국가별 데이터</a> ·
  <a href="https://github.com/heechan9/fabguard-ai#tool-roles">🧰 도구별 역할</a> ·
  <a href="https://github.com/heechan9/fabguard-ai/blob/main/docs/governance/CONTRIBUTIONS.md">👥 기여 기록</a>
</p>
<!-- /secondary-navigation -->

<p align="center"><sub>위 이미지는 독자 제작 콘셉트이며 실제 공장·제휴·현장 배포 실적을 나타내지 않습니다.</sub></p>

---

## 30초 요약

빠르게 훑어보실 분은 아래 표로 충분합니다. 방법론을 검토하시는 분은 [실험계약](docs/validation/EXPERIMENT_CONTRACT.md)부터 확인해 주세요.

| 질문 | 답 |
|---|---|
| 무엇을 해결하나요? | 모든 생산 건을 정밀 점검하기 어려울 때 **위험도가 높은 기록부터 볼 수 있도록 점검 순서**를 만듭니다. |
| AI가 불량을 확정하나요? | 아닙니다. AI는 우선순위와 참고 변수를 제시하고 **최종 판단은 엔지니어가 합니다.** |
| 무엇으로 시험했나요? | 미국 UCI가 공개한 반도체 공정 데이터 **1,567건·익명 측정변수 590개**로 오프라인 시험했습니다. |
| 현재 결과는 어떤가요? | 후기 검증 392건 중 상위 40건을 먼저 봤을 때 전체 불량 24건 중 **5건을 포착**했습니다. 자동 불량 판정 성능은 확보하지 못했습니다. |
| 실제 공장에서 검증했나요? | 아직 아닙니다. 수율 개선·비용 절감·고장 예방 효과를 주장하지 않습니다. |

### 문제를 어떻게 정하고 검증했나요?

최희찬의 문제·범위 결정과 AI 보조 구현을 구분하여 기록하는 개인 프로젝트입니다.
코드와 문서 대부분은 Codex가 작성했으며, 단독 직접 코딩 성과로 표현하지 않습니다.

| 확인할 판단 | 클릭해서 볼 증거 | 현재 한계 |
|---|---|---|
| 점검 여력이 제한될 때 위험순위를 사용 | [점검 범위별 결과](results/v1/top_k_test.csv) | 상위 40건에서 불량 5건 포착, 전체 불량 24건 중 19건은 범위 밖 |
| 평가 실패와 노출을 공개 | [홀드아웃 노출 기록](docs/TEST_EXPOSURE.md) | 잠정 결과이며 독립 제조 데이터 검증 필요 |
| AI 구현과 사람의 기여를 구분 | [AI 활용 기록](docs/governance/AI_USAGE.md) · [기여 기록](docs/governance/CONTRIBUTIONS.md) | 사용자의 직접 재현·수정 범위는 해당 기록으로 확인 |

[프로젝트의 판단과 증거 구성](docs/AX_PORTFOLIO_APPLICATION.md)에서 화면별 근거와 검토 질문을 확인할 수 있습니다.

### 이렇게 사용합니다

| 단계 | FabGuard가 하는 일 | 사용자가 보는 결과 |
|---|---|---|
| **1 · 데이터 입력** | 생산 건별 측정값을 읽고 결측·상수·중복 열을 학습 경계 안에서 처리합니다. | 분석 가능한 생산 기록 |
| **2 · 위험도 분석** | 자동 합격·불합격 판정 대신 각 생산 건의 상대적인 위험점수를 계산합니다. | 위험도가 높은 순서 |
| **3 · 우선점검 목록** | 현장의 점검 여력에 맞춰 상위 5%·10%·20% 등 먼저 볼 범위를 제시합니다. | 생산 건별 점수와 우선 확인 변수 |
| **4 · 엔지니어 검토** | AI가 원인이나 조치를 확정하지 않고 실제 설비·공정 이력과 대조하도록 넘깁니다. | 재검사·설비점검·기록 여부를 사람이 결정 |

### 프로젝트 상태

| 구분 | 현재 상태 |
|---|---|
| **구현·재현 확인** | SECOM 데이터 감사, 누출 방지 학습, 시간순 평가, Top-K 우선점검표, 재현 명령과 웹 데모. 성능 수치는 홀드아웃 노출 이력이 있는 잠정 결과 |
| **도구 검증 완료** | Fledge v3.1.0 실연동, Frictionless v5.19.0 계약, Solar Data Tools v2.1.5 합성·관측 PV 실행, 합성 SMT 이벤트→Frozen SPC→사람 검토 감사 슬라이스 |
| **실데이터 시스템 데모** | 호주 DKASC Alice Springs 2025 관측값 105,120개 슬롯을 정규화하고 Frictionless→SDT 경로로 검증 완료 |
| **후속 시스템 데모** | 영국 PV_Live 2025 추정값 17,520개 구간과 EU PVGIS Brussels 2020 기준값 8,784개 구간을 Frictionless→SDT로 검증 완료 |
| **미검증** | 실제 MES/FDC 연동, 독립 반도체 공장 데이터 성능, 실제 현장 KPI 개선 |

> **중요한 경계:** 태양광 데이터 연계는 데이터 수집·품질·감사 파이프라인의 호환성 데모입니다. SECOM 반도체 모델의 외부 성능 검증으로 사용하지 않습니다.

### 진행 중인 실험 (Draft PR · main 미반영)

| 실험 | 확인한 내용 | 해석 경계 |
|---|---|---|
| [#137 SECOM 시간순 위험순위](https://github.com/heechan9/fabguard-ai/pull/137) | 음성 결과를 포함한 후속 시간순 평가 | 이미 노출된 SECOM 홀드아웃의 탐색적 분석. 독립 성능 확증 아님 |
| [#140 KAMP 사출성형](https://github.com/heechan9/fabguard-ai/pull/140) | 후기 2,209건·불량 8건의 시간순 시험 | 불량 7건이 하루에 몰림. 일별 상위 10% 포착은 0/8이며 새 기간 검증 자료가 필요 |
| [#142 SCATIM 사출성형](https://github.com/heechan9/fabguard-ai/pull/142) | 별도 공개 데이터의 중량·치수 품질 회귀 시험 | 불량 여부 이진 분류가 아니므로 SECOM/KAMP의 외부 불량 포착 성능으로 읽지 않음 |

세 PR은 재현 가능한 연구 기록이며 현재 배포 기능이나 현장 성능을 뜻하지 않습니다. 병합 여부와 관계없이 데이터·라벨·시간 경계가 다른 결과를 하나의 성능 수치로 합산하지 않습니다.

> ### 🔍 엄밀함을 확인하고 싶다면
> - [실험계약](docs/validation/EXPERIMENT_CONTRACT.md) — 분할·전처리·평가 전에 고정한 불변조건
> - [테스트 노출 기록](docs/TEST_EXPOSURE.md) — 홀드아웃 노출과 결과 해석 경계
> - [실패 거버넌스](docs/FAILURE_GOVERNANCE.md) — 실패를 숨기지 않고 기록·판정하는 기준
> - [핵심 연구질문](RESEARCH_QUESTION.md) · [관련 연구](RELATED_WORK.md) · [V2 독립 확인 프로토콜](docs/V2_PROTOCOL.md) · [외부 데이터 자격 심사](docs/EXTERNAL_DATA_QUALIFICATION.md)
> - [1페이지 검증 요약](docs/ONE_PAGE_SUMMARY.md) — 방법론·실패·불확실성·주장 경계를 30초 안에 확인

## 왜 자동 판정이 아닌가요?

익명 변수만으로는 어떤 센서·설비·공정 조건이 불량을 일으켰는지 알 수 없습니다. 따라서 FabGuard는 모델 점수를 **판정**이 아닌 **점검 시작점**으로 사용합니다.

| AI가 제공하는 것 | 엔지니어가 결정하는 것 |
|---|---|
| 생산 건별 위험점수 | 실제 불량 여부 |
| 위험도 기반 검토 순서 | 재검사·설비점검 여부 |
| 우선 확인할 익명 변수 | 변수의 실제 센서·공정 의미 |
| Top-K 점검 범위 | 최종 공정 조치와 기록 |

<a id="global-data-roadmap"></a>

> 국가별 정본 증거와 경로는 [Country-organized evidence catalog](results/README.md)에서 바로 확인할 수 있습니다.

## Global data roadmap

*국가별 데이터 계획*

서로 다른 국가를 단순히 늘리는 것이 아니라, **관측·추정·기준·합성 데이터가 같은 검증 규칙과 감사 기록을 통과하는지** 단계적으로 확인합니다.

| 국가·지역 | 데이터·도구 | 데이터 역할 | 상태 |
|---|---|---|---|
| 🇺🇸 미국 | **UCI SECOM** | 반도체 공정 위험순위 연구의 현재 정본 데이터 | ✅ 완료 |
| 🌐 합성 환경 | **Fledge Sinusoid** | 실시간 수집·REST 연결·중복방지 검증 | ✅ 로컬 실연동 완료 |
| 🇦🇺 호주 | **DKASC** | 태양광 설비의 실제 관측값 | ✅ Alice Springs 2025 E2E 검증 완료 |
| 🇬🇧 영국 | **Sheffield Solar PV_Live** | GB 국가 태양광 발전량 추정값 | ✅ 2025년 17,520개 구간 E2E 검증 완료 |
| 🇪🇺 유럽연합 | **JRC PVGIS** | 기상·일사량 기반 기준·모델값 | ✅ Brussels 2020년 8,784개 구간 E2E 검증 완료 |
| 🇫🇷 프랑스 | **RTE éCO2mix · Enedis · Météo-France** | 수정 이력·배전망 태양광·관측 기상 | 🟡 Enedis 17,568구간·Météo-France 8,784시간 E2E 검증 완료, RTE 연간 17,568구간 E2E 완료·품질 경고 유지 |

<a id="tool-roles"></a>

### Tool roles

*도구별 역할*

| 계층 | 도구 | 하는 일 |
|---|---|---|
| 수집 | 🌐 **Fledge** | 실시간 센서 reading을 안전하게 수집 |
| 품질 진단 | 🇺🇸 **Solar Data Tools** | 결측·시간 이상·설비 시계열 품질을 분석 |
| 데이터 계약 | 🌐 **Frictionless Data** | 출처별 형식·단위·필수 필드와 스키마를 검증 |
| 의사결정·감사 | 🇰🇷 **FabGuard AI** | 우선점검 결과와 출처·버전·해시·판단 경계를 기록 |
| 최종 판단 | 👷 **현장 엔지니어** | 실제 설비·공정 맥락을 확인하고 조치를 결정 |

> **현재 검증 범위:** Fledge Sinusoid와 Solar Data Tools 기반 호주 DKASC, 영국 PV_Live, EU JRC PVGIS, 프랑스 Enedis의 계약·E2E 검증을 완료했습니다. Météo-France는 별도의 관측 기상 맥락으로 검증했으며 SDT 전력 입력으로 사용하지 않습니다. 프랑스 RTE éCO2mix도 2024년 366일 수집·연간 SDT E2E를 완료했습니다(17,568구간, 결측 전력 2개·consolidated 2개·수집 및 SDT 품질 경고 유지). 그 밖의 국가는 조사 후보입니다. 후보 등록은 연결 완료나 구현 약속을 뜻하지 않으며 출처·접근성·라이선스·스키마·단위·시간대·독립적 연구가치를 다시 심사합니다.

<details>
<summary><strong>현재 범위 밖의 국가별 후속 후보 보기</strong></summary>

| 국가 | 우선 검토 후보군 | 독립적 검토 목적 | 현재 판정 |
|---|---|---|---|
| 🇺🇸 미국 | **공개 로봇 운영·이상 데이터 후보군** | 로봇 telemetry·고장/이상 탐지 계약 검토 | 공식 데이터셋·원출처·라이선스 확정 전 조사 후보 |
| 🇫🇷 프랑스 | **RTE éCO2mix · Enedis Open Data · Météo-France** | 값의 수정 이력, 배전·기상 맥락을 분리해 감사 | Enedis·Météo-France E2E 완료; RTE 연간 E2E 완료·결측 2개/통합 상태 2개·품질 경고 유지 |
| 🇩🇪 독일 | **SMARD · 전력/산업 · 공개 로봇 운영 데이터 후보군** | 계통 투명성과 제조·로봇 운영 비교 | 로봇 데이터 원출처·신호·라이선스 확인 전 조사 후보 |
| 🇪🇸 스페인 | **REE/ESIOS · 자가소비 통계 후보군** | 고태양광 계통운영과 분산형 자가소비 비교 | 시계열 해상도·라이선스 확인 전 조사 후보 |
| 🇮🇹 이탈리아 | **Terna · GSE 공개 통계/설비 후보군** | 발전·설비 등록·지역 차이를 연결 가능한지 검토 | 원자료 접근성과 재배포 조건 확인 전 조사 후보 |
| 🇨🇦 캐나다 | **NRCan/CanmetENERGY · 적설 환경 PV 후보군** | 저온·적설 조건의 품질 경계 스트레스 테스트 | 실제 시계열과 라이선스 확인 전 조사 후보 |
| 🇫🇮 핀란드 | **FMI Open Data** | 고위도·적설·저일사 환경의 기상 결합 검증 | 데이터 열·PV 관측 결합 가능성 확인 필요 |
| 🇰🇷 한국 | **공공 제조·전력·태양광 데이터 후보군** | FabGuard의 국내 제조 맥락과 전력 데이터 역할 탐색 | 공개성·현장성·비식별 조건 확인 전 조사 후보 |
| 🇯🇵 일본 | **AIST/JRL 로봇 · NEDO · 규슈전력 후보군** | 로봇 텔레메트리와 출력제어라는 별도 연구축 검토 | AIST/JRL 문의 회신 및 라이선스 확인 대기 |
| 🇹🇼 대만 | **WM-811K · 전력/태양광 · 로봇 연구 후보군** | 웨이퍼맵·전력·로봇 중 공개 검증 가능한 축 선별 | 일본 검토 뒤 재심사하는 보류 후보 |

후보는 국가 수를 늘리기 위한 목록이 아닙니다. 각 데이터는 기존 `observed / estimated / reference / synthetic` 역할과 겹치지 않는 연구질문이 있고, 원 출처·조회일·라이선스·단위·시간대·SHA-256을 기록할 수 있을 때만 구현 단계로 승격합니다. 로봇·웨이퍼맵 데이터는 PV 시계열이나 SECOM V1과 동일 모델로 합치지 않고 별도 계약으로 다룹니다.

</details>

### 로봇 기능 방향 (검토 중)

산업용 로봇의 상태 기록을 사람이 점검할 순서로 정리하는 기능은 **FabGuard 안의 별도 도메인 모듈**로 검토합니다. 수집·데이터 출처 감사·검토 이력·사람의 최종 판단이라는 공통 흐름을 재사용하되, 로봇별 신호·고장/정비 라벨·시간 및 설비 단위 분할·평가 지표는 별도 계약으로 정의해야 합니다. SECOM 모델 점수를 로봇에 적용하지 않습니다. 현재 확정한 로봇 데이터셋이나 구현된 로봇 분석 기능은 없으며, 동작 명령이나 안전 제어는 이 범위에 포함하지 않습니다.

## 핵심 근거

| 항목 | 결과 | 뜻 |
|---|---:|---|
| 후기 시간구간 | 392건, 불량 24건 | 과거 데이터로 학습하고 이후 구간에서 평가 |
| 상위 10% 점검 | 40건 중 불량 5건 | 전체 불량의 20.8% 포착 |
| 무작위 대비 밀도 | 2.04배 | 같은 수를 무작위로 볼 때보다 높은 포착 밀도 |
| Test PR-AUC | 0.0935 | 낮고 불확실한 순위 성능 |
| Walk-forward PR-AUC | 0.054–0.280 | 시간구간에 따라 성능 변동이 큼 |
| 0.5 임계값 Fail recall | 0 | 자동 Fail/Pass 판정 용도로 사용할 수 없음 |

결론은 단순합니다. **강한 자동 판정기는 만들지 못했지만, 제한된 점검 예산에서 먼저 볼 기록을 정하는 약한 순위 신호를 확인했습니다.** 자세한 수치와 한계는 [정본 결과](results/v1/RESULTS_SUMMARY.md)에서 확인할 수 있습니다.

## 상세 검증 결과

### Phase 1 고급 검증 결과

동일한 후기 홀드아웃을 유지한 추가 검증의 **잠정 결과**입니다. 비용 단위는 실제 원화가 아니라 운영 시나리오 비교용 가정입니다.

| 검증 항목 | 결과 | 해석 경계 |
|---|---:|---|
| Brier score | 0.0654 → 0.0599 | 학습기간 말단 보정 구간에서 확률오차 개선 |
| Expected calibration error | 0.0922 → 0.0401 | 10개 구간 중 실제 표본이 존재한 구간은 4개 |
| 상위 10% 불량 포착률 | 평균 20.1%, 95% CI 6.2–36.8% | bootstrap 2,000회, 불확실성 큼 |
| 상위 20% 시나리오 비용 | 399 | 무점검 480 대비 81 감소; 점검 1·미탐 20 가정 |
| Walk-forward PR-AUC | 0.054–0.280 | 시간구간별 변동이 커 지속 모니터링 필요 |
| RF vs Logistic paired 비교 | 학습 CV에서 RF 5/5 repeat 우세, 평균 AP 차이 +0.0382, exact p=0.0625 | 학습 CV 비교이며 후기 RF 우위 근거 아님; 5% 유의성 미확인 |

희소 불량 구간에서는 최소 클래스 표본이 5-fold보다 적다는 경고가 발생했습니다. 실행 실패는 아니지만, 이 결과를 확정 성능이나 현장 효과로 해석하지 않는 근거입니다.

## 현재 구현 범위

### 구현 완료

- UCI SECOM 데이터 감사와 데이터셋 카드
- 결측치 처리·상수 제거 등 누출 방지 학습 파이프라인
- Dummy·L1 Logistic Regression·Random Forest 비교
- 반복 교차검증과 후기 시간구간 홀드아웃 평가
- PR-AUC·Fail Recall·Top-K 포착률·Lift 산출
- 생산 건별 우선점검 목록과 정적 웹 데모
- 실험계약·결과 파일·재현 절차 문서화
- 고정 Train-CV 선정 결과를 재검증해 Train에만 적합하는 잠금 모델 번들 exporter
- 사전 승인·SHA-256에 결합된 독립 데이터에 재학습 없이 점수를 내는 잠금 평가 runner
- Fledge의 읽기 전용 asset REST API에서 데이터를 가져와 오류격리·중복방지·드리프트 경계로 전달하는 연결기
- WSL2의 실제 Fledge v3.1.0에서 Sinusoid 수집·인증 REST pull·재시작 복구·중복격리를 로컬 검증
- SMT 웹 실행을 LOT·Unit·장비·Run·Recipe·규격 버전이 있는 합성 Fledge 이벤트로 내보내고, Frozen SPC 우선검토 큐와 사람의 판정·보류 감사 로그로 연결하는 오프라인 슬라이스([계약과 재현](docs/MANUFACTURING_REVIEW_SLICE.md))
- Frictionless Data v5.19.0 fail-closed 계약과 Solar Data Tools v2.1.5 합성 PV 11,520행 실행 검증
- 호주 DKASC Alice Springs 2025 관측값을 재현 가능한 정규화기로 105,120개 5분 슬롯으로 변환하고 Frictionless→SDT E2E 검증 완료([보고서](results/dkasc-alice-springs-2025/report.json) · [정규화 감사](results/dkasc-alice-springs-2025/normalization_audit.json))
- 영국 Sheffield Solar PV_Live 2025 국가 추정값 17,520개 30분 구간을 수집하고 Frictionless→SDT E2E 검증 완료([보고서](results/pvlive-gb-national-2025/report.json) · [수집 감사](results/pvlive-gb-national-2025/fetch_audit.json))
- EU JRC PVGIS Brussels 2020 기준값 8,784개 시간 구간을 공식 API에서 수집하고 Frictionless→SDT E2E 검증 완료([보고서](results/pvgis-brussels-2020/report.json) · [수집 감사](results/pvgis-brussels-2020/fetch_audit.json))
- 프랑스 Enedis 2024 국가 태양광 추정값 17,568개 30분 구간을 수집하고 Frictionless→SDT E2E 검증 완료([보고서](results/enedis-france-national-solar-2024/report.json) · [수집 감사](results/enedis-france-national-solar-2024/fetch_audit.json))
- 프랑스 RTE éCO2mix의 통합·확정 수정상태, MW 단위, CET/CEST→UTC 변환과 30분 연속성을 검사하는 fail-closed 사전계약 및 오프라인 테스트 구현; 실 API 연간 E2E 완료(17,568구간), 결측 2개·consolidated 2개와 수집/SDT 품질 경고 유지

### 아직 구현하거나 검증하지 않음

- 실제 MES·FDC·APC·SPC 시스템 연동
- 실제 현장 센서 수집과 생산 제어
- 익명 변수의 실제 공정·센서 매핑
- 현장 수율 개선·비용 절감·고장 예방 효과
- 독립 공장 데이터에서의 모델 성능 및 다중 현장 검증(스키마·출처 검증 어댑터만 구현됨)

## 검증과 주장 경계

- 모델 선택은 학습 데이터의 5×5 반복 층화 교차검증에서 수행했습니다.
- 마지막 25% 시간구간은 별도 홀드아웃으로 보존했습니다.
- 데이터 의존 전처리는 학습 폴드 안에서만 적합했습니다.
- 개발 중 홀드아웃이 먼저 노출된 이력은 [TEST_EXPOSURE.md](docs/TEST_EXPOSURE.md)에 공개했습니다.
- 현장 효과는 단순 전후 비교로 주장하지 않고, 무작위·단계적 도입 또는 조건에 맞는 준실험 설계를 검토합니다.

자세한 실험 조건은 [실험계약](docs/validation/EXPERIMENT_CONTRACT.md), 현장 검증 계획은 [인과효과 검증 계획](docs/CAUSAL_FIELD_VALIDATION.md)에서 확인할 수 있습니다.

<details>
<summary><strong>Open engineering & collaboration</strong> — 재현·검토·기여 경로 보기</summary>

FabGuard is a reviewable industrial-AI prototype rather than a black-box demo. Engineers can inspect the data boundary, reproduce the experiment, challenge the metrics, and propose improvements without private fab data.

| Engineering signal | Where to review it |
|---|---|
| Leakage-aware preprocessing and temporal holdout | [Experiment contract](docs/validation/EXPERIMENT_CONTRACT.md) |
| Reproducible commands, artifacts, and raw-data hashes | [Reproducibility guide](docs/validation/REPRODUCIBILITY.md) |
| Cost-aware Top-K review, uncertainty, drift, and walk-forward checks | [Phase 1 validation](docs/PHASE1_ADVANCED_VALIDATION.md) |
| Boundary between prototype evidence and factory claims | [Dataset card](docs/validation/DATASET_CARD.md) · [field validation plan](docs/CAUSAL_FIELD_VALIDATION.md) |
| Staged path to external industrial open source | [Roadmap](docs/project/ROADMAP.md) |
| Frozen Train-only model artifact and trust boundary | [Locked model export](docs/LOCKED_MODEL_EXPORT.md) |

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
| [web/](web/README.md) | 정적 웹 데모의 화면별 코드·데이터·검증 안내 |
| `results/v1/` | 정본 실험 결과와 우선점검 목록 |
| `tests/` | 데이터 계약과 파이프라인 검증 |
| [docs/](docs/README.md) | 목적별 문서 지도와 권장 읽기 순서 |
| `evals/` | 완료 기준과 평가 사례 |

## 문서 안내

전체 문서는 [문서 지도](docs/README.md)에서 목적별로 찾을 수 있습니다. 첫 방문에는 아래 순서로 확인하세요.

| 확인할 내용 | 문서 |
|---|---|
| 결과와 평가 한계 | [정본 결과](results/v1/RESULTS_SUMMARY.md) · [홀드아웃 노출 기록](docs/TEST_EXPOSURE.md) |
| 데이터와 평가 기준 | [데이터셋 카드](docs/validation/DATASET_CARD.md) · [실험계약](docs/validation/EXPERIMENT_CONTRACT.md) |
| 직접 재현하기 | [재현 가이드](docs/validation/REPRODUCIBILITY.md) · [웹 코드 안내](web/README.md) |
| 앞으로의 계획 | [현재 로드맵](docs/project/ROADMAP.md) · [초기 14일 계획](docs/project/PLAN.md) |
| 작업 참여와 기여 구분 | [작업 참여 안내](CONTRIBUTING.md) · [기여 기록](docs/governance/CONTRIBUTIONS.md) · [AI 사용 기록](docs/governance/AI_USAGE.md) |
| 변경 이력 | [Changelog](CHANGELOG.md) |

## 기술 구성

- **Language:** Python 3.11
- **ML:** scikit-learn Pipeline, Logistic Regression, Random Forest
- **Evaluation:** Repeated Stratified CV, temporal holdout, PR-AUC, Top-K capture
- **Web:** HTML, CSS, JavaScript, Vercel static deployment
- **Data:** UCI SECOM, 1,567 production runs, 590 anonymous measurements
- **Integration:** Fledge v3.1.0, Frictionless Data v5.19.0, Solar Data Tools v2.1.5, WSL2

## 현재 한계

- main의 SECOM 성능 결과는 공개 데이터 한 개에서 얻은 오프라인 실험값입니다. 위 Draft PR의 다른 데이터 실험도 독립 제조 현장 성능 확증으로 합산할 수 없습니다.
- 클래스 불균형과 시간 변화 때문에 후기 검증구간 성능이 낮아졌습니다.
- 익명 변수는 불량 원인이 아니라 점검 후보입니다.
- Top-K 결과는 점검 우선순위 가능성을 보여줄 뿐 실제 공장 KPI 개선을 증명하지 않습니다.
- 독립 데이터 재검증과 실제 작업 기록을 포함한 현장 시험이 필요합니다.

---

<div align="center">

**AI는 점검 순서를 제안하고, 최종 판단은 엔지니어가 합니다.**

</div>

### 동일 조건 성능 비교와 검증 한계

[비교 성적표](docs/review/PERFORMANCE_EVIDENCE_20260925.md): V1 후기 AP는 Logistic 0.094692, RF 0.093477입니다. RF가 후기 평가에서 우수하다고 결론내리지 않습니다. RF 상위 40건은 불량 24건 중 5건을 포착하고 임계값 0.5 재현율은 0입니다. Phase1은 축소 학습·별도 보정 결과로 구분합니다. 후속 SECOM 실험은 노출된 홀드아웃의 탐색적 평가이며 독립 검증이 아닙니다.
