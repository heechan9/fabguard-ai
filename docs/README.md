# FabGuard 문서 지도

[프로젝트 소개](../README.md) · [웹 코드 안내](../web/README.md) · [결과 자료 목록](../results/README.md)

## 목적에 맞게 시작하기

| 읽는 목적 | 권장 순서 |
|---|---|
| 프로젝트를 빠르게 이해 | [README](../README.md) → [정본 결과](../results/v1/RESULTS_SUMMARY.md) → [검증 한계](TEST_EXPOSURE.md) |
| 모델·평가 검토 | [데이터셋 카드](../DATASET_CARD.md) → [실험계약](../EXPERIMENT_CONTRACT.md) → [데이터 감사](../FABGUARD_DATA_AUDIT.md) → [재현 방법](../REPRODUCIBILITY.md) |
| 웹 화면 수정 | [웹 코드 안내](../web/README.md) → [화면 명세](SCREENS.md) → [SMT 웹 통합](SMT_WEB_INTEGRATION.md) |
| 현장 적용 가능성 검토 | [엔지니어 검토 흐름](SEMICONDUCTOR_REVIEW_WORKFLOW.md) → [최소 파일럿 초안](MINIMUM_PILOT.md) → [실패 대응 초안](FAILURE_GOVERNANCE.md) |
| 작업 범위·기여 확인 | [요구사항](../PRD.md) → [로드맵](../ROADMAP.md) → [작업 참여 안내](../CONTRIBUTING.md) → [기여 기록](../CONTRIBUTIONS.md) → [AI 사용 기록](../AI_USAGE.md) |

## 문서의 상태를 읽는 법

- 설계·계약·파일럿 문서는 목표와 검증 조건을 설명한다. 현장 배포 완료를 뜻하지 않는다.
- SECOM 결과는 홀드아웃 노출 이력이 있는 잠정 오프라인 증거다. 실제 수율·비용 개선 실적이 아니다.
- PV·날씨 자료는 별도 데이터 연동 검증이다. 반도체 모델의 외부 성능 검증으로 합치지 않는다.
- 결과 수치는 각 정본 결과 파일에서 확인한다. 이 지도에는 수치를 복제하지 않는다.

## 제품·화면·포트폴리오

- [포트폴리오 판단·증거·AI 기여 설명](AX_PORTFOLIO_APPLICATION.md)
- [FabGuard AI 흐름과 실패 경로](FLOW.md)
- [FabGuard AI 화면 명세](SCREENS.md)
- [SMT lab within the FabGuard web demo](SMT_WEB_INTEGRATION.md)
- [SMT 추가 검사실: 가상 시나리오](SMT_INSPECTION_SCENARIOS.md)
- [FabGuard 직무 연계와 인터뷰 가이드](ROLE_ALIGNMENT.md)
- [FabGuard AI — International Review and Collaboration Brief](MELBOURNE_COLLABORATION.md)

## 모델 평가·재현·한계

- [FabGuard Phase 1: decision and temporal validation](PHASE1_ADVANCED_VALIDATION.md)
- [Test Holdout Exposure Log](TEST_EXPOSURE.md)
- [Independent manufacturing data validation](INDEPENDENT_DATA_VALIDATION.md)
- [Locked V1 Model Export](LOCKED_MODEL_EXPORT.md)
- [Locked independent scoring contract](LOCKED_SCORING_CONTRACT.md)
- [Locked independent-evaluation readiness contract](LOCKED_EVALUATION_CONTRACT.md)

## 현장 적용 설계·검토·책임

- [Industrial AI 운영 설계 노트](INDUSTRIAL_AI_DESIGN.md)
- [반도체 공정 이상 검토·검증·승인 사용 사례](SEMICONDUCTOR_REVIEW_WORKFLOW.md)
- [FabGuard 도메인 전문가 검토 워크플로우 초안](DOMAIN_EXPERT_REVIEW.md)
- [스마트공장 연계 설계와 KPI 경계](SMART_FACTORY_INTEGRATION.md)
- [FabGuard 1개 라인·2주 최소 파일럿 초안](MINIMUM_PILOT.md)
- [현장 인과효과 검증 계획](CAUSAL_FIELD_VALIDATION.md)
- [FabGuard 실패 대응·책임·롤백 초안](FAILURE_GOVERNANCE.md)

## 수집·연동 계약과 별도 도메인 검증

- [Fledge 연계 준비 계약](FLEDGE_ADAPTER_CONTRACT.md)
- [Fledge operational validation slice](FLEDGE_OPERATIONAL_VALIDATION.md)
- [Fledge upstream contribution readiness](FLEDGE_UPSTREAM_READINESS.md)
- [Solar Data Tools integration contract](SDT_PV_CONTRACT.md)
- [Sheffield Solar PV_Live pre-ingestion contract](PVLIVE_ADAPTER_CONTRACT.md)
- [PV_Live local E2E replay](PVLIVE_LOCAL_E2E.md)
- [JRC PVGIS pre-ingestion contract](PVGIS_ADAPTER_CONTRACT.md)
- [RTE éCO2mix national solar pre-ingestion contract](RTE_ECO2MIX_ADAPTER_CONTRACT.md)
- [France Enedis and Météo-France preflight](FRANCE_ENEDIS_METEO_PREFLIGHT.md)

## 감사·연구 참고

- [Fledge 병합 후 감사](audits/FLEDGE_POST_MERGE_JULES_AUDIT.md)
- [중동 PV 스트레스 연구 노트](research/MIDDLE_EAST_PV_STRESS_NOTES.md)

## 문서 추가·수정 규칙

1. 새 문서는 위의 관련 분류에 링크하고, 설계인지 실행 증거인지 본문에서 명시한다.
2. 실험 결과는 기존 정본 경로를 사용한다. 정리 목적으로 결과 사본을 만들지 않는다.
3. 파일을 옮길 때는 참조하는 코드·문서·검증을 함께 수정한다.
4. 구현 작업은 [AGENTS.md](../AGENTS.md), 재현 명령은 [REPRODUCIBILITY.md](../REPRODUCIBILITY.md)를 따른다.
5. 아직 병합되지 않은 제안은 해당 PR에서 검토한다. 이 목록은 현재 브랜치에 존재하는 파일만 연결한다.
