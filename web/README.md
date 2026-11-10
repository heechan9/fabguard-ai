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
테마를 전환한다. 메인 관제실은 다크그린을 기본으로, 별도 실험실은 한 단계 낮춘 실버(`#AAB6C5`, 카드 `#C2CDDA`)를 기본으로 사용하며,
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


## 점검 범위 선택과 검토 인계

- `/#risks`에서 기존 공개 상위 50건 가운데 20·40·50건을 표시합니다. 20건에는 과거 불량 4건, 40건에는 5건이 포함됩니다. 점수·순위·0.5 임계값·정본 평가는 그대로이며 새 예측이나 성능 향상이 아닙니다.
- 각 사례의 `/review/`에서는 기록한 메모의 직전 버전과 달라진 입력을 비교합니다. 기존 메모 JSON 형식과 이력은 유지됩니다.
- 추가 근거 체크리스트와 기록된 메모를 JSON 인계 패킷으로 보존하고 같은 사례에 다시 열 수 있습니다. 읽기용 TXT는 최신 메모 요약이며 전체 이력 보존에는 JSON을 사용합니다.
- 체크리스트의 역할·상태는 자기기재입니다. 전부 작성해도 `not_validated`이며 원인 확정·현장 승인·조치 수행을 뜻하지 않습니다. 서버 전송·자동 저장이 없고 개인정보·기밀을 입력하면 안 됩니다.
- 소개·우선점검·근거 화면의 영어 표시를 보완했습니다. 기존 데이터·모델·디자인·별도 3D 시연은 유지합니다.

단위검사는 `node --test tests/web/*.test.mjs`, 실제 파일 다운로드·재열기·오류/취소·모바일 검사는
`verification/check_secom_review.cjs`, `verification/check_secom_review_handoff.cjs`,
`verification/check_review_budget.cjs`를 사용합니다. `FABGUARD_BASE_URL`로 검사 주소를 지정합니다.
운영 검사는 정적 자산의 바이트 일치 확인 이후 별도로 수행합니다. 검사 코드의 존재 자체는 통과 근거가 아닙니다.

## 2026-11-10 다크그린 운영 개요

루트 `/`와 `/#overview`는 다크그린 관제실 레이아웃의 읽기 전용 개요입니다.
이 페이지에서만 저장된 테마가 없을 때 다크를 기본값으로 사용하고, 명시적으로 저장한
실버/다크 선택은 그대로 존중합니다. 기존 소개는 `/#summary`에 유지됩니다.

6개 공정 그림은 새로 제작한 SVG 개념도이며 실제 장비·센서 상태가 아닙니다.
노광·식각·증착 순서는 단순화한 설명이며 실제 생산 경로를 뜻하지 않습니다.
SECOM의 익명 변수를 장비나 센서 이름에 매핑하지 않습니다.
점검 우선순위·순위별 점수·최근 원본 측정 시각은 기존 `priority_top50.json`만 읽고,
점검 예산별 과거 Fail 포착 건수는 기존 `summary.json`의 분모 24와 함께 표시합니다.
새 센서 파형, 실시간 알림, 정상 표시, 모델 실행은 추가하지 않습니다.

기존 상세·검토 메모·분석·3D 페이지로 연결하며 공정 선택은 설명만 바꿉니다.
새 모듈이 없거나 저장 목록이 계약을 충족하지 않으면 개요를 보류하고 기존 목록으로
연결합니다. 외부 영화 이미지·로고·폰트나 비공개 실험 자료는 포함하지 않았습니다.

검사: `node --test tests/web/command-center.test.mjs`,
`verification/check_command_center.cjs` (실제 브라우저, 1366/390/360, 두 테마/언어,
키보드, 상세/뒤로, 기존 탐색, 모듈 404 격리, 데이터 손상 보류, 텍스트 대비).
테스트 기대값의 변경은 새 기본 경로·탐색 순서·홈의 기본 테마를 반영하며 기존 기능의
검사는 유지합니다. 검사 코드의 존재는 실행 완료 증거가 아닙니다.

### 시안 대비 조정과 교차검토

같은 날 공개 코드·공개 배포 캡처를 Claude와 교차검토한 뒤, 주요 탐색은 4개로 정리하고
기존 소개·국가별 자료·3D·장비·UR3·연구는 키보드로 여는 ‘다른 화면’에 보존했습니다.
한국어 모드의 주요 패널 제목을 번역하고, 6개 장비 개념도를 크게 다시 그려 실루엣을 구분했습니다.
데스크톱 1366×941에서 4개 패널을 볼 수 있도록 높이를 줄이고 모바일은 점검 순위부터 읽도록
DOM 순서도 바꿨습니다. 공정 선택은 녹색과 ‘선택한 설명’ 문구로 표시하며 경보가 아닙니다.

상위 5개 과거 라벨(Pass/Fail), 2008년 저장 순위, 선택 모델의 잠정 상태와 저장된 기준값·Fail
재현율을 원본 JSON에서 표시합니다. 기존 값·평가·데이터는 바꾸지 않았습니다.
시안의 가상 정상/주의 상태, 실시간 센서 파형과 최근 알림은 실제 데이터처럼 구현하지 않았습니다.
Claude 검토는 코드·캡처 검토이며 브라우저 실행·키보드·대비 검증은 별도 자동검사로 확인합니다.

## Sitewide command-room presentation (2026-11-10)

The shared `command-center.css`, `sitewide-command.css`, and `site-shell.mjs`
now cover all 12 HTML documents and the retained root views (summary, global,
risks, limitations, and sample detail). This includes SECOM and its training
comparison, equipment CSV and maintenance context, review notes, robot SPC,
UR3 records, OHT, SMT and its references, and the static research snapshot.

All pages use the same four primary links and a keyboard-accessible secondary
menu. Neutral reader text, links, controls, panels and focus rings use one
emerald/cream palette with a corresponding high-contrast silver palette.
Warnings, errors, historical outcomes, missing-data states and diagnostic
color legends remain distinct. No data, model, evaluation, simulation or
physical-equipment control was changed by this presentation layer.

Scripted pages default to dark when no valid preference exists and preserve
an explicit saved silver choice. The research snapshot deliberately retains
its no-script Content Security Policy: its native checkbox switches its own
palette using CSS, without reading or persisting preferences. Its secondary
menu uses native disclosure keyboard behavior rather than JavaScript Escape
or outside-click handling.

`verification/check_sitewide_command.cjs` inventories every document and root
view, enters destinations using real shared-navigation links, captures both
palettes at 1366/390/360 pixels, and checks supported English views, controls,
contrast, scrolling and data-boundary text. It reports graphics/HUD and inactive
control exclusions explicitly; it is not a screen-reader certification.
`sitewide-command-ui.yml` runs the same checks on loopback and, after a main
merge, on the public deployment behind a static-byte equality gate.

## 2026-11-10 소개 우선 · 상단 탐색

후속 사용자 요청에 따라 빈 경로 `/`의 첫 화면은 이제 `#summary` 프로젝트 소개입니다.
기존 운영 개요는 `#overview`에 보존됩니다. 로고도 소개로 돌아갑니다.
12개 문서에서 프로젝트 소개 → 운영 개요 → 3D 모델링 → 우선점검 → 반도체 분석 →
검증과 한계를 기본 메뉴로 제공하고, 나머지 화면은 기존 ‘다른 화면’에 유지합니다.
넓은 PC에서도 메뉴를 왼쪽으로 이동하지 않으며, 900px 이하에서는 가로 스크롤 없이
두 줄로 표시합니다. 스크립트 없는 연구 화면의 기본 disclosure 동작도 그대로입니다.

소개 첫 화면은 목적·하는 일·사람의 판단·연구용 한계와 바로가기부터 보여줍니다.
잠정 평가 수치·분모·미포착 건수·홀드아웃 사전 노출·실패 기록과 상세 근거는 유지됩니다.
읽기 쉬운 문장과 글자 크기만 조정하며 데이터, 모델, 시뮬레이션, 계산 결과는 바꾸지 않습니다.
3D 모델링은 기존 합성 SMT 체험으로 연결되며 실제 장비 제어나 SECOM 분석을 뜻하지 않습니다.

`verification/check_top_navigation.cjs`는 기본 진입, 상단 메뉴의 위치·스크롤·줄바꿈,
모든 기본 링크, 키보드/반복 열기/닫기/뒤로, 직접 3D 이동을 확인합니다.
사이트 전체 검사에도 이 위치 검사를 적용합니다. 실제 실행 상태는 PR 및 CI 기록으로 구분합니다.

### 쉬운 설명과 전문 설명

소개 첫 화면은 쉬운 안내를 기본으로, 긴 평가·설계·원자료 설명은
‘전문 설명과 근거 보기’에서 펼칩니다. 분류 기준 0.5의 Fail 재현율 0%, 주요
점검 수치·분모·미포착 수, 잠정 상태·홀드아웃 노출·현장 미검증은 접지 않습니다.
SECOM 측정 방법, SMT AOI 준비 조건, OHT 이송 순서, UR3 원본 근거도 네이티브
펼치기 요소를 사용합니다. 입력·현재 결과·3D·경고는 숨기지 않습니다.

`progressive-disclosure.mjs`는 직접 링크가 가리키는 요소의 모든 상위 패널을 열고
해당 위치로 이동합니다. `/research/`의 무스크립트 정책은 변경하지 않습니다.
키보드·반복 열기·닫기·뒤로·직접 링크와 펼친 뒤의 대비·넘침을 별도로 검사합니다.
