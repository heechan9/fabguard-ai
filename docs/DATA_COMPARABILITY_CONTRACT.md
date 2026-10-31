# 데이터 비교 가능성 계약 — 직무 전달용 적용표

상태: **기존 입력 게이트의 문서 수준 적용. 새 validator·실험·현장 승인 아님.**
기준 코드: `d534d6ef6f9dd819d8d993e51c0eb31402b328be` (2026-10-31).

이 문서는 [외부 데이터 자격 심사](EXTERNAL_DATA_QUALIFICATION.md)와
[BOSCH 입력 계약](BOSCH_INPUT_CONTRACT.md)을 대체하지 않는다. 그 계약을
CPI 중심의 제품/테스트/수율 통합, MAE 표준화, ATE 이전 준비, RDA 데이터 검토에
어떻게 설명할지 정리한다. 이 네 직무를 실제 수행한 실적이나 Micron의 검증·제휴가 아니다.

본 문서는 2026-10-31 로컬에서 준비한 추가 문서이며 위 과거 기준 SHA에는 포함되지 않는다. 게시·병합 상태는 해당 PR 기록으로 확인한다.

## 먼저 비교 목적을 고정한다

`COMPARABLE_FOR_SAVED_AUDIT`는 **동일 저장 결과의 산술·파일 대조**만 허용한다.
공정 간 동등성, 독립 성능 검증, 제품 qualification으로 승격되지 않는다.
`BLOCKED`는 필수 근거가 unknown이거나 불일치한 상태다.
`NOT_APPLICABLE`은 해당 비교 질문이 다른 도메인이거나 합성 장면에 실측 생산 성능을 요구해 적용할 수 없는 경우다. 이는 통과가 아니다.
이 세 표시는 전달용 표기이며 기존 실행 게이트의 상태 enum을 변경하지 않는다.

| 비교 질문 | 필수 근거 | 현재 상태 | 이유/해제에 필요한 근거 |
|---|---|---|---|
| 동일 SECOM 저장 예측의 집계가 맞는가? | 고정 파일 해시, ID·시각·label·model, 고정 검사 예산 | COMPARABLE_FOR_SAVED_AUDIT | 기존 `verification/recompute_v1.py` 사용; 추론 없음 |
| SECOM으로 두 fab의 수율을 비교할 수 있는가? | 실제 site·제품·공정·tool/recipe·표본 정의, 동일 검사/라벨 조건 | BLOCKED | 실제 두 site 자료 없음. 익명 변수를 임의 매핑하지 않음 |
| SECOM 변수와 다른 자료 열이 같은 물리량인가? | 변수 사전·단위·교정·측정 시점·샘플 대응 | BLOCKED | 열 수/이름 일치만으로 동등성 입증 불가 |
| SECOM 기록 시각을 국제 사업장 시간과 정렬 가능한가? | 원 시간대·검사 시점·label 확정 지연 | BLOCKED | 알려지지 않은 시간대를 UTC로 가정하지 않음 |
| BOSCH를 다음 모델 실험에 사용 가능한가? | 기존 계약의 시간 의미·단위·타깃/마스크·LOT 분할 | BLOCKED | 기존 `model_experiment_ready=false` 유지 |
| UR3와 IMAD를 같은 장비/세션 결과로 결합 가능한가? | 실제 공통 장비/세션/시간 키와 관측 설계 | BLOCKED | 별개 공개 기록, 공통 키 증거 없음 |
| AGV/OHT의 이동을 실제 공장 처리량으로 평가 가능한가? | 실제 이송/정차/지연 관측 및 검증 설계 | NOT_APPLICABLE | 현재는 합성 설명 장면, 실측 생산량 아님 |

## unknown 처리 예시 — 정적 설명만, 새 데이터 아님

1. 단위가 비어 있는 두 채널: 이름이 같아도 `BLOCKED`. 값 규모로 단위를 추정하지 않는다.
2. 시간대 불명인 문자열: 국가를 근거로 시차를 붙이지 않고 `BLOCKED`.
3. label 확정 시점 불명: 의사결정 때 사용 가능했는지 입증 전 prospective 성능 주장을 `BLOCKED`.

이 예시는 실제 Site A/B 측정이나 새 테스트 fixture가 아니다. 기존 판정이
blocked이면 사람이 사유를 적었다고 자동 해제하지 않는다. 제공자 근거·권리·독립성·
도메인 검토가 모두 필요하다. 외부 자료 요청/접근/새 실험은 별도 승인 범위다.

## 보존 및 검토 책임

원본·결측/보간 마스크·제외 사유·변환·SHA와 노출 이력을 보존한다.
자료가 있는 것과 사용/재배포 권리가 있는 것을 구분한다.
SECOM·IMAD·UR3·BOSCH는 각 출처 계약을 유지하며 합성 SMT/AGV/OHT와 합산하지 않는다.
기존 [기여 기록](governance/CONTRIBUTIONS.md), [AI 사용 기록](governance/AI_USAGE.md)을 따른다.
다음 문서: [분석 전달 준비도](ANALYSIS_HANDOFF_READINESS.md), [영문 전달서](TECHNICAL_HANDOFF_EN.md).
