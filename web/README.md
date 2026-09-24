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
