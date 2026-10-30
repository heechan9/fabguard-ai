# 저장된 우선점검 결과 비교

새 모델 실험이 아니라 읽기 전용 재현 점검 도구다. 폴가드의 표본별 차이 수집과 구조 오류 즉시 차단, 병커의 동일 관측 trace 비교·비간섭 원칙을 참고해 FabGuard 표에 맞춰 독자 구현했다. 외부 프로젝트 코드를 복사하거나 의존성을 추가하지 않았다.

## 실행 계약

같은 모델·같은 표본 ID·같은 timestamp·같은 정답 라벨의 두 priority_table.csv를 비교한다. CSV 행 순서는 달라도 ID로 대응시키며, 각 파일의 rank는 1..n 순열이고 점수 내림차순이어야 한다. 점수는 유한한 0..1, prediction/label은 0 또는 1이어야 한다. 누락·중복·자료 부재·계약 불일치는 BLOCKED다.

점수 절대 허용오차와 top-k는 필수 인자다. 결과를 보기 전에 환경과 비교 목적에 맞게 고정한다. 기본 허용오차를 제공하거나 차이를 보고 완화하지 않는다. rank·prediction·top-k 포함 여부의 차이는 점수 허용오차로 숨기지 않는다. 같은 점수의 동률 순위도 바뀌면 차이로 보존한다. 서로 다른 모델의 우열 비교에는 사용할 수 없다.

```bash
python verification/compare_priority_runs.py \
  --reference results/v1/priority_table.csv \
  --actual /path/to/rerun/priority_table.csv \
  --score-atol 0 --top-k 40 > /tmp/priority-comparison.json
```

종료코드: MATCH=0, DIFFERENT=1, BLOCKED=2. 유효한 비교의 모든 표본별 차이를 수집하며, 입력 파일은 수정하지 않는다. 출력은 stdout이고 입력 SHA256·Python 버전·고정 비교 조건을 포함한다. 출력 리다이렉션 경로를 입력 파일로 지정하면 셸이 먼저 입력을 비우므로 반드시 별도 경로를 사용한다.

## 검토 의미와 주장 경계

| 기록 | 뜻 | 입증하지 않는 것 |
|---|---|---|
| MATCH | 두 저장표의 점수(선언한 허용오차 내)·순위·예측 일치 | 새 추론, 독립 실행, 정답 정확성, 현장 성능 |
| DIFFERENT | 같은 비교 계약의 저장표에 차이 존재 | 어느 결과가 더 정확한지 또는 차이 원인 |
| BLOCKED | 자료 없음 또는 비교 조건/구조 위반 | 재현 성공이나 실패의 성능 판정 |
| 화면 검토 | 표시·조작을 확인한 별도 기록 | 계산 재현 또는 정답 검증 |
| 독립 재실행 | 다른 수행자가 고정 입력·모델로 실행한 근거 필요 | 이 도구 실행 자체로 인정하지 않음 |

공식 392건을 자기 자신과 비교한 smoke는 비교 도구 동작 확인일 뿐 새 독립 성능 검증이 아니다. 모델 추론·재학습·성능 산출·기존 점수 변경 없음. 사용자/검토자 신원 인증도 없다.

## 범위와 다음 단계

- 기존 해시·저장 지표 재계산·변조 검사는 verification/recompute_v1.py와 기존 테스트를 재사용한다.
- 기존 합성 시뮬레이션 설명의 비간섭 검사는 tests/web/smt-context-review.test.mjs에 이미 있다. 중복 구현하지 않았다.
- 새 모델 후보의 Shadow 비교·프로세스 시간 제한·실제 장비 연결은 이번 미구현이다. 별도 계약과 검토가 필요하다.
- 화면·3D·모델·평가 분할·임계값·정본 결과는 바꾸지 않는다. 독립 수행자의 재실행 자료는 이번 확보하지 않았다.

참고 고정 소스:
- 폴가드 main 08b33ae04248798de76cebba2e7d242d134d28c7: tests/test_stage_b_differences.py, tests/test_review_semantics.py
- 병커 research/fair_replacement_eval/SHADOW_MODE.md (2026-10-31 조회): 불일치가 성능 우열이 아니라는 경계와 비간섭 원칙만 참고.
