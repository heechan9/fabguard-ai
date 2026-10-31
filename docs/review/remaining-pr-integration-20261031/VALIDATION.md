# 잔여 PR 통합 검증 — 2026-10-31 KST

## 고정 범위

- base main: 74827d1b89f71fb5a4133d910add59043ac3daf1 (#194 SECOM 검토 메모 포함).
- #182: b10b684e9e5094311a32055bde26c22fe99e46e6
- #183: 86dc09f703fa83f76dc3bf36bc2665023898c24a
- #184: 1055cf2d95cecc7e3a771b73739273af66772d72
- #179: 9d55b1fa7f77f30d489b404e2b306a424a5fb566

원본 PR의 변경·과거 실행 로그·기여는 보존한다. 병합 계산 중 #182/#183의 docs/README.md 인접 추가 링크만 충돌하여 양쪽 링크를 보존했다. 기능 충돌 해소를 위해 코드를 재작성하지 않았다. #180은 UR37파일 add/add 충돌이 있어 포함하지 않는다. 핵심 builder/core/data/hash는 최신 main과 바이트 동일하며, 나머지는 #190에서 변경된 화면·테마·검사·문서다. #180 종료는 별도 검토 대상이며 자동 종료하지 않는다.

## dot 작업 대조와 보존

기존 문서 '세프로젝트_검증근거_보완_20261031.md' 최신14:04KST 기록을 읽고 #194 병합 및 운영 검증41170431371 success를 원격 대조했다. dot의 web/review, web/app.js, web/theme.js, build_secom_review_source.py, secom-review.test.mjs, check_secom_review.cjs 등 #194 기능 파일은 base와 동일하다. 별도 기능/보고서 중복 구현 없음.

#183의 '웹 미연결'은 최초 작성 당시로 명시하고 이후 #185 선택 반영을 설명했다. P-A-D-A 요약에는 #194 오프라인 메모와 현장승인/조치/성과의 차이만 추가했다. 원본 성능·제출본·팀원기여 변경 없음.

## 실제 로컬 검사

Python3.12.14. 모델/실험 원본을 새로 실행하지 않았다.

- PYTHONPATH=src python -m unittest discover -s tests -v: 307개 중301통과/기존 환경생략6. python.log.
- node --test tests/web/*.test.mjs:185통과,실패0. web.log. dot의 신규12검사 포함.
- python verification/recompute_v1.py:저장392행 산술 consistent,기존AP/Top-K일치. evidence.json. 독립 모델추론 아님.
- python scripts/build_web_evidence.py --check:Shared evidence snapshot matches canonical source files.
- node --check web/robot/app.mjs 및 offline-evidence.mjs:성공.
- workflow YAML 파싱·diff check 성공(역사적 원문로그의 공백은 보존).

## 브라우저 게이트

로컬에 실행가능한 Chrome이 확인되지 않아 설치/우회하지 않았다. 기존 #174/#179 방식의 CI 사전설치 Chrome·격리Playwright1.62.1·loopback만 사용한다. 기존 robot-offline workflow에 PR trigger와 실제 head checkout을 추가했다. PC1366/360/390의 저장보고서/렌더러404/손상JSON/기존CSV4행/키보드/로봇/정비 회귀를 유지한다. 1366 job에서는 dot의 기존 SECOM 검사(자체3폭)를 변경없이 추가 실행한다. 워크플로 연결은 실행 성공이 아니며 원격 결과·캡처 확인 전 브라우저 통과로 처리하지 않는다.

Draft 통합 후보만 게시. main병합·운영배포·기존PR종료 없음. 실제휴대전화·스크린리더·현장성능·장비제어·새모델·Shadow실행 미검증/미구현. BOSCH 입력준비 false·성능null·IMAD9/0/3 탐색 범위 유지.
