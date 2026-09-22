# FabGuard 작업 상태와 다음 검증

점검일: 2026-09-22 UTC. 기준 main: [`3ade67d`](https://github.com/heechan9/fabguard-ai/commit/3ade67d81ce425f12f1db9811c122bb578d89bfd).
이 문서는 해당 시점의 작업 인수인계 기록이다. 다음 작업 전에 원격 main·PR·CI를 다시 조회한다.

## 구현·검증·배포 구분

| 영역 | 확인된 범위 | 남은 범위 |
|---|---|---|
| SECOM | [V1 정본](../../results/v1/RESULTS_SUMMARY.md), Phase 1, Train-only 전처리·평가 코드 | 원자료를 이용한 이번 전체 실험 재실행은 하지 않음; 독립 제조 검증 필요 |
| Fledge | REST 읽기, 중복·오류 격리, 로컬 상태·전달 복구, [기존 WSL2 실연동 기록](../FLEDGE_OPERATIONAL_VALIDATION.md) | 이번 실 Fledge 재실행, 물리 센서, 운영 DB, 공식 upstream 기여는 미확인 |
| PV·기상 | [국가별 정본](../../results/catalog.json): DKASC/PV_Live/PVGIS/Enedis SDT 보고서; Météo-France 기상 계약 보고서 | 이번 원자료 재수집·SDT 실행은 하지 않음; SECOM 외부 성능 증거가 아님 |
| RTE | [연간 수집기·계약](../RTE_ECO2MIX_ADAPTER_CONTRACT.md)과 오프라인 테스트 | main에 연간 E2E 보고서 없음. 기존 로컬 산출물 확인 후 별도 실행·증거 등록 |
| SMT→SPC→검토 | [합성 이벤트·고정 기준·사람 판단 감사](../MANUFACTURING_REVIEW_SLICE.md) 구현 | 실 Fledge 이벤트 자동 공급, 실장비, 인증된 검토자·다중 사용자 DB 미구현 |
| 장비 웹 | CSV 열 매핑·입력 검사, 별도의 [합성 SPC 체험](../SPC_SCREENING.md) | 업로드 CSV의 SPC 분석은 미구현; 실제 파일 선택 UI 검증은 이번 범위에서 미실행 |
| NVIDIA AOI | [실행 전 계약](../validation/NVIDIA_TAO_AOI_EXPERIMENT_CONTRACT.md) | 승인된 이미지·라벨·GPU, 학습·평가·배포 필요 |

## 이번 검증 기록

- 기준 main의 [CI](https://github.com/heechan9/fabguard-ai/actions/runs/35566428550): 성공.
- 로컬 `PYTHONPATH=src python -m unittest discover -s tests -v`: 총 177개, 174 통과·3 skip.
  공식 원자료 부재 1개, 선택 의존성 Frictionless 미설치 2개이며 전체 통과로 표기하지 않는다.
- `node --test tests/web/*.test.mjs`: 43 통과. `python scripts/build_web_evidence.py --check`: 일치.
- 기준 커밋의 Vercel 상태 성공. 공개 홈·장비·SMT·SECOM HTML 및 `equipment/spc-model.mjs`를
  HTTP GET으로 확인해 200 응답과 기준 main의 바이트 일치를 확인했다. 모든 자산 검증을 뜻하지 않는다.
- Cloud Chrome에서 홈 본문 렌더링, 검증 화면 탐색, 영어 전환 후 `?lang=en#limitations` 유지 확인.
- 장비 페이지의 내장 합성 CSV: 열 매핑 후 2행 통과·결측 1행 격리, 입력 지우기 확인.
- SPC 높음 110/낮음 90/결측/초기화 101의 표와 상태 갱신 확인. 관리한계는 94.68–105.32로 고정.
- 브라우저 확장 프로그램의 metadata 오류가 로그에 있었으며 앱 오류와 구분했다.
- SMT는 이 브라우저에서 공정 버튼·canvas 초기화가 완료되지 않았고, 한 번 재로드하자
  `502 Bad Gateway / peer closed connection`이 표시됐다. 원인이 사이트·전달 경로·브라우저 중
  어디인지 확정하지 않았다. SMT 화면·조작·다운로드 검증은 **미완료**다.
- 모바일 전체 흐름과 데스크톱 전체 화면 회귀, 실제 파일 업로드·WebGL·녹화는 검증 완료로 표시하지 않는다.

## PR 정리 기준

| PR | 처리 방향 | 보존·진입 조건 |
|---|---|---|
| [#39](https://github.com/heechan9/fabguard-ai/pull/39) | 이전 연구 설계 제안으로 닫고 이력 보존 | 현행 연구 문서는 #119로 반영됨. 아래 차이는 채택되지 않은 후속 후보로 보존 |
| [#110](https://github.com/heechan9/fabguard-ai/pull/110) | Draft로 유지 | main 충돌 해결, 기존 SMT 이벤트 내보내기 보존, GPU·녹화 취소·codec·다운로드 확인 후 재검토 |
| [#111](https://github.com/heechan9/fabguard-ai/pull/111) | Draft 유지 | 최신 main 통합 회귀와 데스크톱·모바일 교육 화면 검증 후 재검토 |

PR #39는 현행 문서의 완전한 복제본이 아니다. 원본 커밋
[`2844140`](https://github.com/heechan9/fabguard-ai/tree/2844140c766093e902ee5bf0b37b5a4788c04923/docs)과 PR을 보존한다.

- 이전 `docs/RESEARCH_QUESTION.md`는 RF 대 Logistic 비교 중심이다. 현행 정본은
  [루트 연구질문](../../RESEARCH_QUESTION.md)의 시간순 위험순위·점검예산 질문이다.
- 이전 `docs/V2_PROTOCOL.md`의 missingness-indicator ablation은 **미실행·미채택 후보**다.
  현행 [V2](../V2_PROTOCOL.md)는 독립 데이터 확인이다. 두 실험을 같은 V2로 합치지 않는다.
- 이전 외부 데이터 문서의 정량 기준은 현행 [자격 심사](../EXTERNAL_DATA_QUALIFICATION.md)에
  자동 이식하지 않는다. 별도 타당성 검토 없이 데이터 진입 기준을 바꾸지 않는다.
- 이전 `docs/RELATED_WORK.md`의 추가 논문과 `docs/LOCKED_EVALUATION_DRY_RUN.md`의
  실패 사례 표는 위 고정 커밋에서 열람 가능하다. 재사용 시 원문·현재 테스트와 대조한다.
- 닫기는 구현·실험 완료 판정이 아니며, 브랜치·원본 문서·실험 결과를 삭제하지 않는다.

## 다음 작업 순서

1. **배포 웹 검증 마무리:** SMT 초기화/502 원인을 재현해 분리하고 모바일 탐색·WebGL·내보내기를 검증.
2. **미완료 기능 PR:** #110과 #111을 각각 독립 브랜치·독립 검증으로 진행. 과거 CI 성공만으로 병합하지 않음.
3. **RTE 증거:** 기존 산출물부터 확인하고 없으면 별도 결과 경로에 연간 E2E 실행. 원자료·품질 경고·해시를 보존.

독립 제조 데이터, 도메인 전문가 피드백, AOI GPU, upstream maintainer 승인은 외부 의존이다.
이 정리로 현장 성능·수율·비용 개선·공식 외부 기여를 새롭게 주장하지 않는다.

## 기여

- 최희찬: 저장소 정리 요청, 기존 기능·데이터 보존과 검증 중심 우선순위 결정.
- Codex: 원격 상태·코드·문서 비교, 로컬 테스트와 제한된 브라우저 검증, PR 분류·상태 문서 작성.
