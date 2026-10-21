# 강의 참고자료 적용: 별도 Steel 데이터 구조 감사

2026-10-21 UTC. 기준 main: `519654ea2362accf2127f4255a4379132402383c`.

## 실제 적용 범위

사용자가 제공한 렛유인 「반도체 Data 분석 1회차: Data 기초 및 이론」의
데이터 종류·변동·분석 전 확인 원칙을 별도 참고 데이터 감사에 적용했다.
강의 원본과 원본 데이터는 저장소에 포함하지 않는다.

- `fabguard.steel_reference_audit`: 표준 라이브러리만 사용하는 로컬 ZIP 감사.
- 순서가 고정된 27개 feature/7개 one-hot target, 결측·비유한값,
  중복·동일 feature의 상충 라벨, 좌표/밝기 경계, 강종 flag를 점검한다.
- ZIP을 추출하거나 코드를 실행하지 않는다. 전체 입력 3 MB, 각 멤버 1 MB로
  제한하고 동일 바이트 스냅샷을 파싱·해싱한다. 중복 ZIP 멤버도 거부한다.
- 기존 SECOM `TrainColumnFilter`와 데이터 감사는 이미 존재하므로 변경하지 않는다.
  새로운 의존성, 모델, 분할, 평가 정의, 운영 화면 변경이 없다.

## 재현

공식 출처: https://archive.ics.uci.edu/dataset/198/steel+plates+faults

Buscema, M., Terzi, S., & Tastle, W. (2010). Steel Plates Faults [Dataset].
UCI Machine Learning Repository. https://doi.org/10.24432/C5J88N
CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

공식 ZIP을 로컬의 `data/raw/steel.zip`에 별도로 준비한 다음:

```sh
PYTHONPATH=src python -m fabguard.steel_reference_audit data/raw/steel.zip --output /tmp/steel-audit.json
PYTHONPATH=src python -m unittest discover -s tests -p test_steel_reference_audit.py -v
PYTHONPATH=src python -m unittest discover -s tests -v
```

설치 환경에서는 `fabguard-steel-audit` 명령도 사용할 수 있다.
출력 파일은 입력 파일과 다른 경로여야 하며 같은 파일의 hard link도 거부한다.
출력 JSON은 구조 감사 결과이며, 성공 종료 자체를 학습 자격 승인으로 쓰지 않는다.
`structural_gate_passed`는 구조 검사 통과와 중복 feature 부재만 나타낸다.
입력은 공식 데이터와 같은 스키마인지 검사할 뿐 공식 원본임을 인증하지 않는다.
공식 사이트의 라이선스·저자 메타데이터는 임의 입력의 권리 보증이 아니다.

이번 로컬 공식 ZIP 감사는 1,941행 / 27개 feature / 7개 불량 유형이며,
결측·비유한값·중복·상충 라벨 0건이다. 입력 ZIP SHA-256:
`cb8eb9859198b63f053e443513036b401746fa517ef58bd17c846c6741c93919`.
재실행 시 JSON의 Python 버전, 입력·멤버 해시와 실행 명령을 함께 보존한다.

## 해석 금지 및 후속 검증 조건

Steel은 정상/불량 이진 분류가 아니라 7가지 불량 유형이다. `Other_Faults`를
정상으로 바꾸지 않는다. SECOM 모델에 입력하거나 SECOM 성능 향상·외부 반도체
검증으로 합산하지 않는다. 기존 성능 수치와 정본 결과를 변경하지 않았다.

현재는 분할·학습·추론을 전혀 하지 않았다. 전체 자료의 기술 통계는 이미
살펴본 데이터이므로 이후 untouched holdout이라고 주장하지 않는다.
단위·수집 시점·LOT/장비 ID가 확인되지 않아 시간순/그룹 독립성을 보장할 수 없다.
관측 최솟값/최댓값은 규격 한계가 아니며 Cp/Cpk에 사용하지 않는다.
상관관계나 변수 중요도를 실제 공정 원인으로 명명하지 않는다.

별도 탐색 실험을 제안할 때만 먼저 다음을 문서화한다.
1. 라벨/단위/출처/사용 권리와 분할 계약. 정확한 중복도 서로 다른 split에 두지 않는다.
2. 결측 대치·필터·스케일러·선택기는 각 training fold에만 fit한다.
3. 실행 예산·중단 조건·성공/실패 기준을 사전에 고정한다. 실패 테스트를 약화하지 않는다.
4. 독립 검증은 원본 해시·스키마·집계·분할 누수를 확인하고 실제 실행 증거와 제안을 구분한다.

참고로 제공된 loop-engineering 자료의 검증/종료 조건은 위 프로젝트 실험 절차에만
반영했다. 새 자동 반복 실행이나 무제한 실험을 만들지 않았다.

## 보류 사항

- WM-811K: 원저작권·이용 허용 범위·안전한 포맷·LOT/wafer split 계약 확인 전 보류.
  pickle 파일 다운로드·로드·학습을 수행하지 않는다.
- JMP: 분석 방법의 참고 자료이지 무료 이용권이나 직접 실행 증거가 아니다.
- 10월 30일 예정 원자료: 아직 수신·검증되지 않았다. 받은 후 권리, 사전,
  단위, 결측 sentinel, timestamp, LOT/장비 ID, 라벨 정의와 확정 시점부터 확인한다.

## 기여

사용자는 강의 자료 적용을 요청했다. Codex가 구현·테스트·문서를 작성했으며,
사람의 직접 코딩, 강사의 검토, Claude/Jules 검토 또는 모델 성능 개선으로 표시하지 않는다.
