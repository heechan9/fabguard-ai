# Contributions

FabGuard AI는 사람의 문제 정의와 검토, AI 보조 구현을 구분해 기록합니다.

## 최희찬

- 프로젝트 문제 정의, 요구사항과 활용 범위 결정
- 반도체 제조·스마트팩토리 맥락 및 공개 데이터 후보 검토
- 결과 해석 경계, 사용자 관점과 최종 산출물 검수
- 저장소 운영 및 배포 의사결정

## Codex (OpenAI)

- 공개 데이터 기반 실험·평가 코드 및 문서화 보조
- 일반 사용자를 위한 화면 문구와 정보구조 개선
- 반도체 클린룸 콘셉트의 웹 UI 구현 및 반응형 스타일링
- 코드·데이터 형식·정적 웹 동작 검증 보조
- Phase 1 비용 기반 Top-K·bootstrap·드리프트·walk-forward·확률 보정 코드와 테스트 구현
- Fledge·Solar Data Tools 단계적 연계를 위한 구조 검토와 로드맵 문서 작성
- 산업 AI 협업 콘셉트의 독자 제작 대표 이미지 생성과 글로벌 기술 검토 중심 README 정보구조 개선
- 사용자 실행 결과를 바탕으로 Phase 1 확률 보정·비용 시나리오·bootstrap·walk-forward 결과 해석 및 문서화
- 신규 산업 AI 대표 이미지 기반 웹데모 재설계, 일반 사용자용 설명·가독성·모바일 반응형 개선 및 Phase 1 결과 데이터 계약 추가
- Fledge 사전 연계를 위한 dependency-free reading 정규화 계약, fail-closed 검증, 테스트와 설계 경계 구현
- Fledge 후보 reading의 로컬 smoke 실행기, 예시 fixture, 정규화 CSV·품질 리포트와 회귀 테스트 구현

## PR별 구현 기록

### 2026-09-23 SMT intro desktop validation

- **최희찬**: Windows Chrome에서 GPU 렌더링과 녹화, 중단 후 재시작, 창 닫은 뒤 덮개 복원, 다운로드 MP4 외부 재생을 직접 확인하고 영상 파일을 제공. 통합·병합·배포 요청.
- **Codex**: 소개 영상 코드 작성, 최신 main 통합, 51개 웹 테스트·문법 검사, 제공 영상의 해상도·길이·전체 디코딩·장면 검증 및 배포 확인. 모바일 녹화나 실공장 성능 검증으로 확대 해석하지 않음.

### 2026-09-23 RTE annual verification

- **최희찬**: RTE 연간 수집·검증 완료 요청 및 범위 결정.
- **Codex**: 체크포인트 재개, 원자료 366일 수집, 기존 계약·Frictionless·SDT 실제 실행, 해시 대조 및 [결과 기록](../../results/rte-france-national-solar-2024/README.md). 현장 성능·외부 전문가 검증 또는 공식 upstream 기여를 주장하지 않음.


### 2026-09-22 저장소 상태와 PR 정리

- **최희찬 (`heechan9`)**: 기존 기능·데이터를 보존하는 정리 작업과 검증 우선순위 요청.
- **Codex (OpenAI)**: 최신 main·PR·CI 대조, Python·웹 테스트 재실행, 공개 파일 배포 및 제한된 실제 브라우저 동작 확인, 연구 PR 차이 보존과 작업 상태 문서 작성.
- 확인한 범위와 남은 검사는 [작업 상태](../project/WORK_STATUS.md)에 기록. 새 모델 실험·현장 성능이나 사용자 직접 코딩 성과로 표현하지 않음.

### Manufacturing event-to-review audit slice

- **Codex (OpenAI)**: SMT 합성 실행을 Fledge 호환 reading과 LOT·Unit·장비·Run·Recipe·규격 버전 계약으로 내보내고, Frozen SPC 우선검토 큐 및 사람의 판정·보류 감사 로그로 연결하는 CLI·예시·회귀 테스트 구현
- **최희찬 (`heechan9`)**: 기존 Fledge·SPC·SMT 기능을 하나의 제조 의사결정 흐름으로 연결하는 우선순위와 공개·병합 범위 결정
- **경계**: 합성 오프라인 검증이며 실제 MES/FDC/APC, 물리 장비, 불량 판정, 자동 재학습 또는 현장 개선 실적이 아님

### Repository document structure cleanup

- **Codex (OpenAI)**: 루트 문서를 프로젝트·검증·거버넌스 폴더로 재분류하고 README, 웹 링크, 문서 지도와 경로 회귀 테스트를 함께 갱신
- **최희찬 (`heechan9`)**: GitHub 첫 화면의 파일 과밀 문제를 제기하고 정리 작업 및 병합을 요청

### PR #14 - Phase 1 고급 검증

- **Codex (OpenAI)**: 비용 기반 Top-K, bootstrap 신뢰구간, PSI 드리프트, walk-forward 평가, 확률 보정 코드와 단위·회귀 테스트 및 실험계약 문서를 직접 구현
- **최희찬 (`heechan9`)**: 연구 문제와 우선순위 설정, 활용 범위·수용 기준 결정, 결과 검토 및 병합·공개 여부 최종 승인
- **Claude 감사 → Codex 구현 (2026-09-18)**: V1 연구질문, V2 독립 확인, 외부 데이터 자격, 관련 연구 문서와 global-section 가독성·데이터 유형·후보 레지스트리 시각 계약을 정리했다. SMT reflow 간격은 기존 3D 교차판정 테스트가 충족하므로 형상을 변경하지 않았다.
- GitHub Contents API를 통한 업로드 특성상 커밋 업로더 계정과 실제 파일 작성 주체가 다를 수 있으므로 이 기록과 PR 설명을 기여 근거로 사용합니다.

### Global collaboration README and Phase 1 result interpretation

- **Codex (OpenAI)**: FabGuard 전용 산업 AI 협업 대표 이미지 생성, 해외 기술 검토자가 실험계약·재현성·검증 경계를 빠르게 확인하도록 README를 재구성하고 Phase 1 실행 결과를 과장 없이 문서화
- **최희찬 (`heechan9`)**: 글로벌 협업 지향 디자인 요구사항 설정, 로컬 공식 데이터 실험 실행 및 결과 제공, 최종 표현·공개·병합 승인

### Industrial web demo and README usability refresh

- **Codex (OpenAI)**: 신규 대표 이미지를 웹 첫 화면에 통합하고 일반 사용자가 문제·작동 방식·잠정 결과·한계를 바로 이해하도록 정보구조, 문구, 가독성, 반응형 화면과 Phase 1 JSON 계약을 구현
- **최희찬 (`heechan9`)**: 웹데모와 GitHub의 일반 사용자 가독성 개선 방향 설정, 디자인 요구사항과 공개 범위 승인

### Dusk industrial identity and first-visit clarity refresh

- **Codex (OpenAI)**: 노을·야간 반도체 팹을 주제로 한 독자 제작 대표 이미지 생성, README 첫 화면의 문제·결과·검증 경계 재배치, 웹 첫 방문용 4단 요약과 결과 바로가기 구현
- **최희찬 (`heechan9`)**: 대표 이미지의 분위기와 일반 사용자 중심 정보구조 요구사항 설정, 시안 선택 및 공개·병합 승인

### Fledge adapter contract preparation

- **Codex (OpenAI)**: Fledge 코드를 복제하거나 런타임 종속성을 추가하지 않고 reading envelope를 안정적인 FabGuard 입력 표로 변환하는 독자 구현, 오류·중복 차단 테스트와 연계 경계 문서 작성
- **최희찬 (`heechan9`)**: FabGuard → Fledge 단계적 확장 방향 결정, Anaconda 기반 로컬 재현 실행과 결과 검토, 실제 upstream 참여·병합 범위 최종 승인

### Fledge contract smoke runner

- **Codex (OpenAI)**: 샘플 reading을 계약 검증하고 정규화 CSV와 데이터 품질 JSON을 생성하는 재현 CLI, 독자 제작 fixture와 테스트 구현
- **최희찬 (`heechan9`)**: Anaconda에서 전체 테스트와 smoke 명령을 재현하고 결과·향후 upstream 공개 범위를 승인

### Independent manufacturing data validation gate

- **Codex (OpenAI)**: 외부 제조 CSV의 SHA-256 출처, 식별자·시간·라벨·수치형 변수 계약과 결측·상수 품질을 fail-closed로 검사하는 어댑터, JSON·Markdown 자동 보고서 및 회귀 테스트 구현
- **최희찬 (`heechan9`)**: 독립 데이터 검증 우선순위와 기존 SECOM 실험 불변조건 결정, 공개·병합 범위 최종 승인

### Locked independent-evaluation readiness gate

- **Codex (OpenAI)**: 데이터·특징 순서·모델 파일·모델 매니페스트·평가 승인서의 SHA-256 결합, 경로 격리, 무역직렬화 readiness 검사와 회귀 테스트 구현
- **최희찬 (`heechan9`)**: 잠금 평가 단계의 범위와 기존 V1 결과 불변조건 승인

### Locked V1 model export

- **Codex (OpenAI)**: 고정 Train-CV 선정 결과·원본 해시·시간순 Train 식별자를 재검증하고
  Train에만 fit한 pipeline을 해시·환경·입력 계약과 함께 원자적으로 내보내는 CLI, 테스트와
  신뢰된 joblib 사용 경계 문서 구현
- **최희찬 (`heechan9`)**: 잠금 모델 export 우선순위와 canonical 결과 불변조건 승인

### Locked independent scoring runner and pre-departure solar roadmap

- **Codex (OpenAI)**: 승인된 바이트 재해시, 명시적 pickle 신뢰 확인, 환경 버전 잠금,
  무재학습 확률 scoring, 고정 지표·Top-K·calibration·bootstrap 산출물과 회귀 테스트 구현;
  출국 전 Solar Data Tools 재현 패키지와 멜버른 연구 피드백 단계를 로드맵에 구분해 기록
- **최희찬 (`heechan9`)**: 석사·기업 연구직 수준 목표, 출국 전 태양광 시계열 이전과 멜버른
  대학 연계 방향 승인

### Phase 1 web evidence provenance

- **Codex (OpenAI)**: calibration, 비용 시나리오, Top-K bootstrap, walk-forward CSV에서
  웹 요약 JSON을 자동 생성하는 reporting 계약과 회귀 테스트 구현; 화면의 고정 결과 문구를
  동적 증거값으로 교체하고 Phase 1 오류를 fail-closed로 표시하도록 검증 강화
- **최희찬 (`heechan9`)**: 고급 검증 결과를 일반 사용자에게 노출하는 방향과 주장 경계 승인

### Failure governance and rollback design

- **Codex (OpenAI)**: 입력·모델·큐·드리프트·미탐·오경보 실패 모드, 역할 분리,
  fail-closed 기본 동작, 사고 조사와 롤백·재개 조건의 현장 도입 전 초안 작성;
  V1 단일 holdout 수치 옆에 Phase 1 walk-forward 변동성 병기
- **최희찬 (`heechan9`)**: 현업 도입 논의를 위한 실패 책임·롤백 문서화 우선순위와
  공개 범위 승인
### Paired repeated-CV comparison

- **Codex (OpenAI)**: 동일한 반복 CV 분할에서 각 repeat의 5개 fold를 먼저 평균내고 exact
  sign-flip 검정을 수행하는 비교 모듈·회귀 테스트·파생 증거 파일과 통계적 한계 문서 구현
- **최희찬 (`heechan9`)**: 모델 간 비교의 연구 우선순위와 기존 V1 결과 불변조건 승인

### Global E2E evidence and navigation synchronization

- **Codex (OpenAI)**: 영국 PV_Live·EU JRC PVGIS 정본 보고서와 웹 표시를 자동 대조하는 데이터 계약·회귀 테스트 구현, 프랑스 RTE 사전계약 상태 반영, README의 두 탐색 링크 줄과 이미지 고지 중앙 정렬 및 실제 클릭 가능한 절대 링크 검증
- **최희찬 (`heechan9`)**: 국가별 검증 진행 방향, 공개 화면 배치와 사용자 경험 요구사항 결정, 로컬 RTE 계약 테스트 재현 및 최종 병합 승인

### Cross-platform country flag rendering

- **Codex (OpenAI)**: Windows에서 국가 이모지가 US·AU 같은 문자로 표시되는 문제를 진단하고, 국가 카드·도구 역할·후속 후보 목록을 로컬 SVG 국기 자산으로 교체했으며 자산 라이선스와 회귀 테스트를 추가
- **최희찬 (`heechan9`)**: PC 실화면에서 플랫폼별 렌더링 결함을 발견하고 수정 범위와 공개 여부를 승인

### RTE live-schema reconciliation

- **Codex (OpenAI)**: 사용자 실 API 응답에서 확인된 15분 레코드 외피와 :15/:45 구조적 결측을 30분 태양광 발전 시계열의 실제 누락과 분리하고, fail-closed 정규화·감사 필드·회귀 테스트·계약 문서를 구현
- **최희찬 (`heechan9`)**: 프랑스 RTE 공식 API를 직접 실행해 실제 응답 스키마를 확인하고 결과를 제공했으며, 공개·병합 범위를 최종 승인

### RTE annual collection pipeline

- **Codex (OpenAI)**: 프랑스 RTE 공식 API를 UTC 일 단위로 분할 수집하고 응답 개수·구조적 null·30분 연속성·중복·해시를 검증하는 연간 수집 CLI, 회귀 테스트와 실행 계약을 구현
- **최희찬 (`heechan9`)**: 하루치 공식 API 실응답과 Frictionless 검증을 재현하고 연간 E2E 진행 범위 및 최종 공개 여부를 승인

### RTE DST artifact governance

- **Codex (OpenAI)**: 사용자 실 API 진단으로 확인된 봄 전환일의 동일 중복 4행과 가을 전환일의 누락 4행을 `Europe/Paris` 실제 오프셋 변경일에만 제한적으로 처리하고, 충돌 중복 차단·발전량 null 보존·연속 UTC 격자·품질 경고·감사 카운터와 회귀 테스트를 구현
- **최희찬 (`heechan9`)**: 프랑스 RTE 연간 수집을 직접 실행해 DST 경계의 100/92행 현상을 발견하고 원본 중복·누락 타임스탬프를 진단해 구현 근거를 제공했으며, 공개·병합 범위를 최종 승인

### RTE mixed revision lineage

- **Codex (OpenAI)**: 공식 API의 2024년 전체 상태를 직접 집계해 마지막 UTC 1시간의 consolidated 4행을 특정하고, strict 상태 검증은 유지하면서 두 공식 상태를 행별로 보존하는 명시적 `published` 수집 모드·날짜 포함 오류·회귀 테스트·계약 문서를 구현
- **최희찬 (`heechan9`)**: 연간 실수집에서 revision 불일치를 발견하고 중단 결과를 제공했으며, 확정값 위장 없이 공식 상태를 보존하는 후속 처리 방향과 공개·병합 범위를 승인

### France Enedis and Météo-France preflight

- **Codex (OpenAI)**: Enedis 배전망 태양광 주입량의 공식 범위·단위·시간대 계약과 Météo-France 파리 몽수리 2024 관측 기상의 공식 gzip 수집·정규화 실행기, 품질코드 보존, 단위 변환, fail-closed 회귀 테스트 및 실행 문서를 구현
- **최희찬 (`heechan9`)**: 프랑스 후속 데이터 확장 순서와 연구 역할을 결정하고, 로컬 실수집·결과 검토 및 공개·병합 범위를 최종 승인

### Enedis bounded live collector

- **Codex (OpenAI)**: Enedis Data Fair의 구조화 필터·정확한 전체 행 수·deep pagination·공식 호스트 제한·반복 링크 차단·UTC 반시간 격자·페이지 해시를 검증하는 실수집 CLI와 회귀 테스트를 구현
- **최희찬 (`heechan9`)**: 프랑스 배전망 데이터의 연구 역할과 실수집 범위를 결정하고 로컬 실행 결과·공개 여부를 최종 승인

### Enedis France 2024 E2E evidence

- **Codex (OpenAI)**: 로컬 실수집·Frictionless·Solar Data Tools 결과를 정본 감사 JSON과 보고서로 구조화하고, 행 수·SHA-256 계보·207개 원본 결측 보존을 회귀 테스트와 웹데모·README에 동기화
- **최희찬 (`heechan9`)**: Enedis 공식 연간 데이터를 로컬에서 수집하고 Frictionless·SDT를 실행해 결과를 제공했으며, 공개·병합 범위를 최종 승인

### Country-organized evidence catalog

- **Codex (OpenAI)**: 미국·호주·영국·EU/벨기에·프랑스 정본 증거를 국가→출처→역할 구조로 탐색하는 JSON 카탈로그와 문서·회귀 테스트를 구현하고, 기존 경로를 유지해 링크 파손과 증거 복제를 방지
- **최희찬 (`heechan9`)**: 국가별 데이터 분류 방향과 적용 범위를 결정하고 공개·병합을 승인

### Portfolio evidence and repository documentation organization

- **Codex (OpenAI)**: 포트폴리오 판단·근거 카드와 검증 코드 구현, 문서 지도·웹 코드 안내·작업 참여 안내·PR 양식 작성, 상대 링크와 탐색 테스트 확인, README 중복 안내 축소와 초기 계획의 기록 성격 명시
- **최희찬 (`heechan9`)**: 교육자료 원칙의 팹가드 적용과 GitHub 정리 방향 요청, 공개 및 병합 승인
- 구현과 병합 이력: [#112](https://github.com/heechan9/fabguard-ai/pull/112), [#113](https://github.com/heechan9/fabguard-ai/pull/113), [#114](https://github.com/heechan9/fabguard-ai/pull/114)

### Result-to-evidence portfolio flow

- **Codex (OpenAI)**: 수업의 결과·근거·계산 검증·연락 구조를 실제 V1 증거에 맞춰 웹에 구현하고, lift 산식과 원자료가 불일치하면 표시를 중단하는 회귀 검증 추가
- **최희찬 (`heechan9`)**: 추가 수업 화면을 제공하고 FabGuard 적용을 요청했으며, 없는 공정 전후 성과는 만들지 않는 기존 주장 경계를 유지

### NVIDIA TAO AOI preflight contract

- **Codex (OpenAI)**: NVIDIA 공식 Optical Inspection 스킬의 TAO 7.1.0 실행 요구사항을 검토하고, 기존 SECOM 결과와 분리된 AOI 데이터·GPU·누출 방지·평가·주장 계약, 시뮬레이션 준비 패널과 회귀 테스트 구현
- **최희찬 (`heechan9`)**: NVIDIA 플러그인 활용 방향을 승인하고 FabGuard의 후속 시각검사 준비 작업을 요청

최종 책임과 공개 여부에 관한 결정은 프로젝트 소유자에게 있습니다.

### Persisted evidence recomputation and source clarification contracts

- **최희찬 (`heechan9`)**: Bunkering·Adversarial AI 프로젝트에서 재사용할 검증 원칙의 검토와 FabGuard 적용·병합을 요청하고 승인.
- **Codex (OpenAI)**: 표준 라이브러리 기반의 독립 계산 구현, 저장된 V1 예측과 정본 지표 대조, 해시에 연결된 자료 의미 정정 기록 검증, 변조 테스트와 CI 연결 및 오래된 scoring 상태 문서 정정.
- 독립 **코드 경로**를 추가한 것이며 독립 **외부 검토자**가 검증했다는 뜻은 아님. 실제 제공자 정정 기록은 없고 합성 사례는 테스트에만 존재. [범위와 출처](../INDEPENDENT_EVIDENCE_AUDIT.md).

### 2026-09-24 현재 상태 정리·외부 검토 준비

- **최희찬**: 완료/미완료 상태 정리와 외부 검토 자료 준비를 요청.
- **Codex**: main·PR·정본 근거 대조, 과거 인수인계 기록 보존, 현재 상태표와 외부 검토 요약·질문·답변 양식 작성.
- 자료 준비이며 실제 발송·전문가 회신·외부 승인 또는 새 모델 실험을 수행한 기록이 아님.

### 2026-09-24 장비 CSV 입력 방어 보완

- **최희찬**: TriGuard의 일반 CSV 방어 원칙을 FabGuard에 적용하도록 요청.
- **Codex**: 파싱 도중 행·열 한도, 대표 바이너리 시그니처·제어문자 차단, 엄격한 UTF-8과 바이트 제한, 경계·정상 CSV 회귀 검증 구현.
- [TriGuard 일반 통계 도구](https://github.com/heechan9/triguard-ai/blob/main/public-statistics/statistics-tools.js)와 [업로드 방어](https://github.com/heechan9/triguard-ai/blob/main/modules/upload_security.py)의 일반 입력 방어 원칙을 참고해 브라우저용으로 적용. 군사 도메인 로직·위험 점수는 이식하지 않음.
