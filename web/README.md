# FabGuard 웹 코드 안내

[프로젝트 소개](../README.md) · [문서 지도](../docs/README.md)

정적 HTML·CSS·JavaScript 웹 데모다. 배포 대상 폴더는 루트의 [vercel.json](../vercel.json)에 정의되어 있다.

## 어디를 수정하나요?

| 대상 | 진입 파일 | 관련 자료 |
|---|---|---|
| 메인 화면 | [index.html](index.html), [app.js](app.js) | [style.css](style.css), [navigation.css](navigation.css), [readability.css](readability.css) |
| 소개 화면의 판단·근거 카드 | [portfolio-story.mjs](portfolio-story.mjs), [portfolio-story.css](portfolio-story.css) | [설계 근거](../docs/AX_PORTFOLIO_APPLICATION.md) |
| SMT 3D 실험실 | [smt/index.html](smt/index.html), [smt/app.mjs](smt/app.mjs) | [구현 문서](../docs/SMT_WEB_INTEGRATION.md), [합성 시나리오](../docs/SMT_INSPECTION_SCENARIOS.md), [제조 검토 슬라이스](../docs/MANUFACTURING_REVIEW_SLICE.md) |
| 반도체 분석 화면 | [secom/index.html](secom/index.html), [secom/secom.mjs](secom/secom.mjs) | [정본 결과](../results/v1/RESULTS_SUMMARY.md) |
| SECOM 전처리 비교 기록 | [secom/research.html](secom/research.html) | #170 고정 head e7cdc47b, 개선 미입증 |
| 로봇 확장 시연 | [robot/index.html](robot/index.html) | 별도 합성/사용자 CSV 프로토타입, Python API 호출 아님 |
| 화면에 표시할 데이터 | [data/](data/) | [증거 스냅샷 생성기](../scripts/build_web_evidence.py), [입력 목록](../scripts/web_evidence_sources.json) |
| 이미지·아이콘 | [assets/](assets/) | 출처와 라이선스를 함께 확인 |
| 웹 동작 검증 | [tests/web/](../tests/web/) | [CI 정의](../.github/workflows/ci.yml) |

## 로컬에서 보기

저장소 루트에서 실행한다.

```bash
python -m http.server 8000 --directory web
```

브라우저에서 `http://localhost:8000/`, `/smt/`, `/secom/`을 확인한다. Python API 서버를 연결하는 명령이 아니라 정적 파일을 제공하는 명령이다.

## 수정 후 확인

저장소 루트에서 실행한다. 전체 CI 명령은 [워크플로](../.github/workflows/ci.yml)가 기준이다.

```bash
node --check web/app.js
node --check web/smt/app.mjs
node --check web/secom/secom.mjs
node --test tests/web/*.test.mjs
python scripts/build_web_evidence.py --check
```

`evidence_snapshot.json`은 입력 자료와 생성기를 통해 갱신한다. 표시 수치를 임의로 수정하지 않는다. SECOM 오프라인 결과, SMT 합성 시뮬레이션, PV 연동 검증은 각각의 증거 범위를 유지한다.

## 장비 CSV 입력 제한

장비 입력 화면은 UTF-8 CSV 최대 5MiB(화면 표기는 5MB), 측정 20,000행(헤더 제외), 200열을 지원한다.
행·열 한도는 파싱 도중 확인하며, 초과하면 후속 텍스트 처리를 중단한다. 200열은 SPI 입력 화면의
브라우저 처리·열 선택 UI 제한으로 SECOM 원본 590개 변수 계약과 무관하다.
파일 읽기 전 크기 검사, 읽은 바이트 재검사, 대표 압축/PDF/OLE/7z/RAR 시그니처와 제어문자 검사,
엄격한 UTF-8 디코딩을 수행한다. BOM·탭·인용된 줄바꿈은 허용한다.
모든 바이너리 형식이나 악성 파일을 탐지하는 백신은 아니며, 메모리 사용량 전체를 제한하지 않는다.
입력 검사는 기존 [contract.mjs](equipment/contract.mjs), 회귀 검사는
[equipment-input.test.mjs](../tests/web/equipment-input.test.mjs)에 있다.

## 2026-10-23 연구 근거 화면

`/research/`는 고정 커밋의 공개 보고서를 요약한 정적 근거 화면이다. #168/#170/#171/#172의 실험·감사·프로토타입과 미실행 작업을 구분한다. 새 모델 추론이나 SPC 계산을 제공하지 않으며 기존 정본 데이터는 바꾸지 않는다. 링크된 PR 상태는 확인 시각의 스냅샷이다.

로봇 시연은 최대 20,000행의 CSV 조각을 처리합니다. 6.7kHz라면 약 2.99초에 불과하므로 안정 정상 기준의 충분성을 입증하지 않습니다. 사용자 CSV는 선택한 바이트를 해시하고 같은 바이트를 디코딩합니다. 해시는 출처 인증이 아니며 Python의 legacy 배열 API와도 별개입니다. 실제 로봇 SPC 실험은 미실행입니다.

## 2026-10-30 학습 분포와 3D 상태 연결

`/secom/#distribution-evidence`는 PR #183의 고정 커밋
`86dc09f703fa83f76dc3bf36bc2665023898c24a`에서 검증된 학습 통계 사본을 표시한다.
`data/session5-20261030/manifest.json`에 원본 경로·커밋·각 파일 SHA-256이 있다.
`node --test tests/web/distribution-evidence.test.mjs`로 사본 무결성과 분모·방향·민감도 표시를 검사한다.
서버 모델 호출·재학습·새 통계 계산이 아니라 저장된 observed-only 기술통계의 탐색이다.
기존 평가 수치와 독립 로딩되며, 근거가 없으면 별도 오류와 고정 원본 링크를 보여 준다.

SMT의 기존 분류 로봇에서는 선택 기판의 검사 근거→분류/보류→다음 확인을 연결한다.
선택 기판의 목적지 강조와 지금 이송 중인 기판을 구분하며 기존 합성 규칙·내보내기·재생 동작은 유지한다.
실제 SECOM 변수와 가상 설비를 매핑하지 않는다. WebGL 실패 시 기존 대체 화면과 표·재생 컨트롤을 사용한다.

## 실버 / 다크 테마

소개 화면(국가별 자료·우선점검·검증과 한계 포함), SMT, SECOM의 상단 버튼으로
테마를 전환한다. 기본은 한 단계 낮춘 실버(`#AAB6C5`, 카드 `#C2CDDA`)이며,
`theme.js`가 스타일 로딩 전에 `fabguard-theme` 저장값을 적용해 첫 화면의 색상 전환을 방지한다.
저장소 접근이 차단되면 현재 페이지에서만 선택을 유지한다. 언어 URL, 경로, 3D 상태는 바꾸지 않는다.
별도 장비·연구·로봇 확장 페이지는 기존 디자인/CSP를 유지하며, 돌아오면 저장된 테마가 적용된다.

`node --test tests/web/theme.test.mjs tests/web/silver-theme.test.mjs`가 저장 실패·잘못된 값·반복 전환을 검사한다.
기존 Silver UI CI에서 `verification/check_theme_ui.cjs`도 실행해 두 테마의 실제 대비,
키보드·언어·페이지 이동·3D 상태 보존을 1366/390/360px에서 확인하고 화면을 남긴다.
배포 뒤에는 `release-browser.yml`의 정적 파일 바이트 일치 확인 후 같은 테마·이송 로봇
브라우저 검사를 실제 공개 주소에 실행한다. 루프백 통과와 실제 배포 검증은 별도 결과다.

## 합성 바닥형 AGV A-01

SMT의 `floor-agv-model.mjs` / `floor-agv-view.mjs`는 R-01 분류 팔과 R-02 고정 갠트리와
별개인 바퀴형 차량 1대와 합성 자재 트레이를 표시한다. 조립 라인 밖 고정 바닥 경로에서
운반(12초) → 인계 대기(4초) → 운반(8초) → 가상 장애물에 의한 경로 막힘을 설명한다.
막힘은 사용자 재설정까지 유지된다. 전용 멈춤·재설정은 선택 기판과 카메라를 바꾸지 않고,
공통 재생 시계·속도·동작 줄이기·처음부터는 함께 따른다. 소개 영상 중에는 AGV 상태가 보존된다.
기판 12개의 공정·검사·분류·내보내기를 변경하지 않으며, 실제 UR3 기록과도 연동하지 않는다.
AMR 자율주행, SLAM, 실제 물류 최적화, 충돌 회피나 안전 인증 구현이 아니다. OHT는 제외한다.

`node --test tests/web/floor-agv.test.mjs`는 경로·상태 경계·형상·시계 정지·재설정·재현성과
기판 상태 불변을 확인한다. `verification/check_floor_agv.cjs`는 CI에서 실제 장면과 카메라를
읽어 차량·경로 가시성 및 운반/대기/막힘 화면을 두 테마 × 1366/390/360px로 검사한다.
운영 검사는 기존 정적 파일 바이트 일치 게이트 뒤 실행한다. 검사 코드 추가는 브라우저 통과 증거가 아니다.

## 별도 OHT 설명용 장면

`/oht/`는 SMT·바닥 AGV와 분리된 반도체 팹 개념 장면이다. 천장 레일·차량·호이스트와
합성 FOUP 1개가 A에서 B로 이동한다. 지연 사례의 사람 확인 기록은 지연을 해제하지
않으며 실제 장비 복구·작업 승인이 아니다. 실버/다크, 한국어/영어, 시점과 재생·초기화가
분리되어 있고 WebGL 실패 시 설명·상태·컨트롤을 유지한다.
[상태 계약·검증 범위](../docs/OHT_CONCEPT.md)를 참고한다. 원본 데이터·학습·모델 결과는 바꾸지 않는다.
