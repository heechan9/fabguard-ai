# 제조 Agentic AI 자료 반영: 판단 근거 sidecar

## 출처와 상태

장윤석, 「제조 Agentic AI: 감각의 재현, 경험지식과 온톨로지」, 2026-11-15 V1.4, 41쪽.
공개 원문: https://lnkd.in/p/g9myM_qk
이 문서는 원문 재배포가 아닌 FabGuard 적용 판단이다. 특히 p28·32의 판단 당시 근거 기록을 참고했다. p29–30은 설계 구상·실증 전, p31·33의 성능 수치는 가상 예시다. 원문에 인용된 개별 연구의 성과를 독립 재현한 것은 아니다.

**비공개 검토용 오프라인 구현. 운영 기능 배포·외부 AI 승인·현장 실증 완료가 아니다.**

## 기존 기능과 겹치는 것

- `manufacturing_review.record_review_decisions`: review_id, rationale, 역할·판단시각, 이벤트 해시와 pending 상태 이미 구현.
- `maintenance_review.record_context_review`: 원본 재계산, 전체 패키지 해시, as_of 지식시점, 이력 가용시점, 보류 해제 금지 이미 구현.
- `DOMAIN_EXPERT_REVIEW.md`: reason_code/evidence_refs 최소 기록 계약 이미 설계.
- `SEMICONDUCTOR_REVIEW_WORKFLOW.md`, `ROLE_ALIGNMENT.md`: 현업 역할·업무 흐름·해외 설명 문서는 유지. 새 자료로 시장·실증 성과를 덧씌우지 않는다.
- PR222 최신 변경 파일 확인 결과는 선택형 학습 UI·관련 테스트·검증 workflow 5개. 본 변경은 해당 파일을 건드리지 않는다. 합치기 전 최신 base/head 재검증 필요.

## 실제 추가 범위

기존 두 audit 함수를 대체하지 않고 `fabguard.decision_basis`의 선택형 CLI/API를 추가한다. 원래 context audit 검증을 먼저 그대로 수행하고, 제출한 판단 각각에 아래 sidecar를 정확히 한 개 요구한다. 미판단 관측치는 pending으로 유지한다.

- 전체 decisions 원본 바이트 SHA-256. 공백 변경도 재결합 필요.
- review_id 및 전체 관측 행 canonical SHA-256. 숫자뿐 아니라 당시 context/관련 변경 참조를 결합.
- 통제된 reason_code: context_changed, measurement_missing, additional_inspection, reference_only, other. 상세 이유는 기존 rationale에 남긴다.
- evidence_status: observed(사용자가 직접 확인했다고 선언), inferred(추론), unverified(미확인). observed는 사실 입증이나 인증이 아니다.
- captured_at: snapshot as_of 이상, decided_at 이하의 timezone 포함 선언 시각. 사후 작성·시각 위조 방지는 **인증된 수집 시스템 없이는 불가능**하다.
- change_refs: 해당 관측 행에 이미 결합된 변경 ID만 허용. 임의 URL, 외부 자료 또는 미래 결과를 새 근거로 가져오지 않는다. 변경 참조는 선택이며 전체 관측 해시 참조는 필수다.

누락·중복·미지 참조·잘못된 grade/code·시간역전·변조 입력은 거부한다. 기존 schema/웹 UI/저장된 audit 소비자에는 변경 없음. 선택형 경로이므로 기존 기록 경로가 새 sidecar를 강제한다고 주장하지 않는다.

## 실행과 검증

```bash
PYTHONPATH=src python -m fabguard.decision_basis \
  --events events.json --history history.json --package package.json \
  --decisions decisions.json --basis basis.json \
  --recorded-at 2026-09-01T00:22:00Z --output audit.json
PYTHONPATH=src python -m unittest discover -s tests -p test_decision_basis.py -v
```

전체 신규 envelope와 항목 필드는 `tests/test_decision_basis.py`의 합성 fixture를 참고한다. 자동 생성된 이유·전문가 승인·학습 정답으로 사용하지 않는다. 테스트는 기존 합성 제조 fixture만 사용하며 SECOM 최종평가·학습·분할·성능 정의를 변경하지 않는다. 새 dependency 없음.

## 하지 않은 것

IRL/SAC/BO, 온톨로지 프레임워크, 자동 재학습, 설비 제어, 실제 출하 승인, LLM 근거 생성, 인증·접근통제, append-only 보관, 실증 성능 향상은 구현하지 않았다. 근거 기록 완전성과 판단의 정확성은 다른 평가다. 강사 자료도 단일 시스템·고정 구조에는 DB schema가 충분함을 명시한다. SECOM 익명 변수에 센서·공정 의미를 추정 부여하지 않는다.

## R2 독립 검토 수정

R1의 공용 writer는 고정 output + `.tmp` 경로를 써서 그 경로가 입력이면 입력을 덮고 삭제할 수 있었다. R2는 새 CLI에만 배타 생성한 임의 이름의 같은 디렉터리 임시파일을 사용하고 교체·실패 정리를 수행한다. 출력의 입력 alias(직접 경로, symlink, hardlink)는 거부하며 기존 `.tmp` 파일·symlink를 건드리지 않는다. 모든 입력 종류별 회귀검사를 추가했다. 동시 공격자가 상위 디렉터리 자체를 교체하는 상황에 대한 보안 sandbox는 아니다. 기존 공용 writer는 이번 변경 범위 밖이며 수정하지 않았다.

## R3 검토 테스트 보강

Claude 정적 검토 권고로 중복 ID 테스트는 두 판단·두 근거로 길이 상한을 통과한 뒤 실제 중복 경로를 확인하도록 추가했다. CLI 입력덮어쓰기 테스트도 유효 basis를 복원해 다른 validation 실패로 거짓 통과하지 않도록 했다. 각각 guard를 제거한 격리 사본에서 테스트가 실패하는 negative control을 수행했다. 제품 코드는 R2와 동일하다.

이 기능은 사유코드와 근거 사이의 의미적 타당성을 판정하지 않는다. 예를 들어 context_changed와 빈 change_refs의 조합 자체는 금지하지 않으며 판단의 품질 검증은 사람에게 남는다. 원본 decisions 바이트 해시는 basis envelope에 결합되고, 반환 audit의 decisions_sha256은 기존 내부 정규화된 decisions의 해시이므로 원본 파일 해시와 혼동하지 않는다. 파일교체는 directory fsync까지 제공하지 않으며 crash-durable 저장 또는 악의적 동시 디렉터리 변경 방어를 보장하지 않는다.
# 유효 제출 근거의 기타 코드 사용 비율

기존 `summarize_basis_quality`가 원본을 재검증한 뒤 `other_reason_usage`를 추가로 반환한다. 기존 판정·보류·검증·출력 필드는 변경하지 않는다.

- numerator: 유효 제출된 basis 중 reason_code가 정확히 `other`인 건수.
- denominator: 이 호출의 유효 제출 basis 건수. 전체 관측 수나 공장 전체 판단 수가 아니다.
- fraction: numerator / denominator. 제출이 없으면 null이며, 제출은 있으나 기타가 없으면 0이다.
- 미제출 관측은 기존 pending 집계에 남는다. 제출했으나 근거·코드가 누락/잘못된 경우 기존 검증이 예외를 내며 기타로 대체하지 않는다.
- observed/inferred/unverified 등급은 이유코드와 별개다. 기타 사용이 많거나 적다는 사실만으로 판단정확성·근거진위·안전·승인·현장 효과를 평가하지 않는다.
- 거절 시도 이력이 없으므로 거절 건수/비율은 기존 unknown/null을 유지한다. 유효 제출만 집계한 결과를 성공률로 부르면 안 된다.

제조 Agentic AI 자료의 코드목록 갱신·기타 비율 점검이라는 설계 관점을 좁게 적용한 것이다. 원문 수치·도표·사용자 자료를 포함하지 않는다. 새로운 모델·온톨로지·현장 제어·승인 기능은 아니다.

합성 회귀 실행:
```sh
PYTHONPATH=src python -m unittest discover -s tests -p 'test_decision_basis*.py' -v
```
