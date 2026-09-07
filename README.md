<div align="center">

# FabGuard AI

### 모든 생산 기록을 볼 수 없다면, 위험한 기록부터.

반도체 생산 데이터의 위험도를 정렬해 **엔지니어가 먼저 확인할 대상을 제안하는 산업 AI 프로토타입**입니다.  
AI가 불량을 확정하거나 공정을 제어하지 않습니다. **최종 판단과 조치는 사람이 합니다.**

[**웹 데모 보기 →**](https://fabguard-ai.vercel.app/) · [결과 확인](results/v1/RESULTS_SUMMARY.md) · [직접 실행](#직접-실행)

<img src="docs/assets/fabguard-dusk-hero-v3.jpg" alt="FabGuard 산업 AI 콘셉트 이미지" width="820">

[![CI](https://github.com/heechan9/fabguard-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/heechan9/fabguard-ai/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Evidence](https://img.shields.io/badge/evidence-provisional-E9A23B)
![Decision](https://img.shields.io/badge/final_decision-human-00A7B5)

</div>

> 위 이미지는 독자 제작 콘셉트입니다. 실제 공장, 제휴 또는 현장 배포 실적을 나타내지 않습니다.

## 한눈에 보기

| 질문 | 답 |
|---|---|
| **무엇을 하나요?** | 생산 기록을 위험도가 높은 순서로 정렬해 점검 목록을 만듭니다. |
| **무엇으로 시험했나요?** | 🇺🇸 UCI SECOM 공개데이터 1,567건과 익명 측정변수 590개입니다. |
| **현재 결과는?** | 후기 검증 392건 중 상위 40건을 확인했을 때 불량 24건 중 5건을 포착했습니다. |
| **실제 공장에서도 검증됐나요?** | 아직 아닙니다. 자동 판정, 수율 개선, 비용 절감 효과를 주장하지 않습니다. |
| **다음 단계는?** | 🇦🇺 DKASC 실제 태양광 관측 데이터를 공통 품질·감사 경로에 통과시키는 것입니다. |

```mermaid
flowchart LR
    A["산업 데이터"] --> B["형식·품질 검사"]
    B --> C["위험순위·품질신호"]
    C --> D["엔지니어 확인"]
```

## 현재 증거

| 구분 | 확인된 내용 |
|---|---|
| ✅ **반도체 모델** | SECOM 데이터 감사, 누출 방지 학습, 시간순 평가, Top-K 점검 목록 |
| ✅ **센서 연결** | 🌐 Fledge v3.1.0 인증 REST 연결, 재시작 복구, 중복 격리 |
| ✅ **데이터 계약** | 🌐 Frictionless Data v5.19.0이 잘못된 스키마를 실행 전에 차단 |
| ✅ **PV 품질 도구** | 🇺🇸 Solar Data Tools v2.1.5로 합성 PV 11,520행 처리 |
| ⏳ **현장 검증** | 실제 MES/FDC 연결, 독립 공장 성능, 현장 KPI 개선은 미검증 |

핵심 결과는 **자동 불량 판정기**가 아니라, 제한된 점검 시간에 먼저 볼 기록을 정하는 **약한 우선순위 신호**입니다.

## 글로벌 데이터 로드맵

국가 수를 늘리는 것이 목적이 아닙니다. 서로 다른 데이터 유형이 같은 **출처·시간·단위·스키마·해시·주장 경계**를 통과하는지 확인합니다.

| 상태 | 국가·지역 | 데이터 | 역할 |
|---|---|---|---|
| ✅ 완료 | 🇺🇸 미국 | **UCI SECOM** | 반도체 위험순위 연구의 정본 데이터 |
| ✅ 완료 | 🌐 합성 환경 | **Fledge Sinusoid** | 센서 수집·REST·재시작·중복 검증 |
| 🔵 다음 | 🇦🇺 호주 | **DKASC** | 태양광 설비 실제 관측값 |
| 🔵 계획 | 🇬🇧 영국 | **Sheffield Solar PV_Live** | 지역·국가 발전량 추정값 |
| 🔵 계획 | 🇪🇺 유럽연합 | **JRC PVGIS** | 기상·일사량 기반 기준값 |
| 🟡 후속 후보 | 🇫🇷 프랑스 | **RTE éCO2mix** | 잠정·통합·확정값의 수정 이력 감사 |

### 도구가 맡는 일

| 순서 | 도구 | 역할 |
|---|---|---|
| 1 | 🌐 **Fledge** | 센서 데이터를 안전하게 수집 |
| 2 | 🌐 **Frictionless Data** | 형식과 필수 필드를 검사 |
| 3 | 🇺🇸 **Solar Data Tools** | 태양광 시계열의 결측·시간·클리핑·용량변화를 진단 |
| 4 | 🇰🇷 **FabGuard AI** | 결과와 출처·버전·해시·판단 경계를 기록 |
| 5 | 👷 **현장 엔지니어** | 실제 설비·공정 맥락을 확인하고 조치를 결정 |

> **연구 경계:** 태양광 데이터는 데이터 수집·품질·감사 파이프라인의 호환성 데모입니다. SECOM 모델의 외부 성능 검증이나 태양광 패널 고장진단으로 사용하지 않습니다.

## 핵심 수치

| 지표 | 결과 | 의미 |
|---|---:|---|
| Test PR-AUC | 0.0935 | 불균형 데이터의 위험순위 품질은 낮고 불확실함 |
| 상위 10% 점검 | 불량 5/24 포착 | 392건 중 40건을 먼저 확인 |
| 무작위 대비 밀도 | 2.04배 | 같은 수를 무작위로 볼 때보다 높은 포착 밀도 |
| Walk-forward PR-AUC | 0.054–0.280 | 시간구간별 변동이 큼 |
| 0.5 임계값 Fail recall | 0 | 자동 Fail/Pass 판정에 사용할 수 없음 |

[정본 결과와 해석 경계 자세히 보기](results/v1/RESULTS_SUMMARY.md)

<details>
<summary><strong>기술 구현과 검증 범위 보기</strong></summary>

### 구현 완료

- 결측치 처리·상수 제거를 포함한 누출 방지 학습 파이프라인
- Dummy·L1 Logistic Regression·Random Forest 비교
- 반복 교차검증과 후기 시간구간 홀드아웃
- PR-AUC·Fail Recall·Top-K 포착률·Lift
- 잠금 모델 exporter와 독립 데이터 scoring 경계
- Fledge REST 연결기의 오류격리·중복방지·드리프트 처리
- 정적 웹 데모와 재현 가능한 결과 파일

### 아직 검증하지 않음

- 실제 MES·FDC·APC·SPC 연동
- 실제 현장 센서와 생산 제어
- 익명 변수와 실제 센서·공정의 매핑
- 독립 반도체 공장 데이터 성능
- 실제 수율·비용·고장 예방 효과

</details>

<details>
<summary><strong>범위 밖의 국가 후보 보기</strong></summary>

| 국가 | 후보 | 현재 판정 |
|---|---|---|
| 🇫🇮 핀란드 | FMI 고위도 PV | 적설·저온 후속 후보, 접근·라이선스 확인 필요 |
| 🇨🇦 캐나다 | OSOTF | 다운로드·라이선스 미확인 |
| 🇯🇵 일본 | 규슈전력 발전실적 | 출력제어 연구로 별도 보류 |
| 🇹🇼 대만 | WM-811K | 이미지 데이터라 현재 시계열 범위에서 제외 |

</details>

## 직접 실행

```bash
git clone https://github.com/heechan9/fabguard-ai.git
cd fabguard-ai

PYTHONPATH=src python -m unittest discover -s tests -v
python -m http.server 8000 -d web
```

웹 브라우저에서 `http://localhost:8000`을 열면 됩니다. 전체 실험 재현에는 공식 [UCI SECOM 데이터](https://archive.ics.uci.edu/dataset/179/secom)가 필요합니다.

## 문서와 기여

| 목적 | 문서 |
|---|---|
| 결과와 수치 | [RESULTS_SUMMARY](results/v1/RESULTS_SUMMARY.md) |
| 데이터 출처와 한계 | [DATASET_CARD](DATASET_CARD.md) |
| 실험 불변조건 | [EXPERIMENT_CONTRACT](EXPERIMENT_CONTRACT.md) |
| 재현 절차 | [REPRODUCIBILITY](REPRODUCIBILITY.md) |
| 글로벌 확장 게이트 | [ROADMAP](ROADMAP.md) |
| Fledge 실연동 증거 | [FLEDGE_OPERATIONAL_VALIDATION](docs/FLEDGE_OPERATIONAL_VALIDATION.md) |
| 사람·AI 기여 구분 | [CONTRIBUTIONS](CONTRIBUTIONS.md) · [AI_USAGE](AI_USAGE.md) |
| 영문 협업 개요 | [MELBOURNE_COLLABORATION](docs/MELBOURNE_COLLABORATION.md) |

기술 검토와 작은 범위의 PR을 환영합니다. 기여자는 데이터 경계, 기대 결과, 완료 기준을 Issue에 먼저 적어 주세요.

---

<div align="center">

**AI는 점검 순서를 제안하고, 최종 판단은 엔지니어가 합니다.**

</div>
