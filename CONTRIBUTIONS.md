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

### PR #14 - Phase 1 고급 검증

- **Codex (OpenAI)**: 비용 기반 Top-K, bootstrap 신뢰구간, PSI 드리프트, walk-forward 평가, 확률 보정 코드와 단위·회귀 테스트 및 실험계약 문서를 직접 구현
- **최희찬 (`heechan9`)**: 연구 문제와 우선순위 설정, 활용 범위·수용 기준 결정, 결과 검토 및 병합·공개 여부 최종 승인
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

### Paired repeated-CV comparison

- **Codex (OpenAI)**: 동일한 반복 CV 분할에서 각 repeat의 5개 fold를 먼저 평균내고 exact
  sign-flip 검정을 수행하는 비교 모듈·회귀 테스트·파생 증거 파일과 통계적 한계 문서 구현
- **최희찬 (`heechan9`)**: 모델 간 비교의 연구 우선순위와 기존 V1 결과 불변조건 승인

최종 책임과 공개 여부에 관한 결정은 프로젝트 소유자에게 있습니다.
