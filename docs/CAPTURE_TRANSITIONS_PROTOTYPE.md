# 행별 Top-K 포착 전이: 검토용 진단

기준 main: 56e7a49679674c4883b3334188e31ca5d475e03d. 새 의존성, 모델 학습, 승인, 운영 adapter, 기존 출력 변경 없음.

## 목적과 기존 기능 차이
`fabguard.capture_transitions.compare_capture_transitions(baseline_raw, candidate_raw=None)`는 JSON 원본 bytes를 받는 읽기전용 함수다. 반복CV 평균 비교(`paired_comparison.py`) 및 동일 모델 재현 비교(`verification/compare_priority_runs.py`)를 대체하지 않는다. 서로 다른 모델의 고정 행별 점수에서 검사예산 Top-K의 선택 이동만 설명한다. threshold FN과 Top-K 미선택을 혼동하지 않는다.

기준·후보에 정확히 같은 dataset_sha256, split_sha256, split_id, label_rule, cutoff, K, tie_policy, exposure 선언이 필요하다. ID집합 및 행별 label/timestamp/split도 같아야 한다. cutoff와 timestamp는 명시적 timezone ISO 시각만 허용한다. timestamp가 cutoff보다 나중이면 거부한다. equivalent timezone은 UTC로 비교한다. 점수 내림차순·ID 오름차순으로 선택을 재계산하므로 입력 rank를 믿지 않는다. K는 1~N의 정확한 정수다.

입력 exact schema는 tests/test_capture_transitions.py fixture 참조. 중복 JSON key/ID, 누락·추가 필드, 비정상 JSON, 비유한 점수, bool 숫자, 불일치 계약을 거부한다. label은 정수0/1 또는 null만 허용한다. null은 unknown으로 남기며 normal에 합치지 않는다.

## 출력
fail/normal/unknown별로 newly_selected, newly_removed, jointly_selected, jointly_unselected의 12개 묶음에 count, sample_ids, 해당 라벨 모집단 denominator를 준다. Fail의 newly_selected는 새 포착, newly_removed는 새 누락이다. 각 ID를 정확한 입력 SHA256으로 원본 행에 연결할 수 있다. 상쇄된 순개선 수치로 해로운 전이를 숨기지 않는다. fraction을 만들지 않아 분모0을 성과로 오인하지 않는다.

candidate 없음은 NOT_RUN이며 transitions 숫자를 만들지 않는다. 후보가 있으면 DESCRIPTIVE_COMPARISON일 뿐이다. 항상 operational_status=WITHHELD, independent_evaluation=false.

## 출처와 한계
해시는 제출 bytes의 동일성만 나타낸다. dataset/split 해시를 원본 파일과 대조하는 검증기, 시각·라벨·모델 진실성 인증, 분할·후보 사전 고정, 점수 산출 시점, label availability, 데이터 사용권 검증은 제공하지 않는다. 동일하게 위조된 계약은 검출할 수 없다. 모델 버전이 같아도 입력이 같아도 기술통계 비교를 허용하되 성능 향상을 주장하지 않는다. exposure는 exposed/unverified만 허용하며 독립 평가 선언을 받지 않는다. label_rule 문자열 일치도 의미의 타당성 입증은 아니다.

실제 main 저장 V1은 이미 노출된 평가자료다. 새 후보 출력이 없어 실제 비교 NOT_RUN을 유지한다. 기존 V1 시각은 timezone 없는 문자열이라 이 계약에 임의 UTC를 붙여 넣지 않았다. 실제 사용 전 timezone/시점/분할 근거와 후보 출력 계약을 먼저 확정해야 한다. 실증·독립 일반화·수율·비용·인과 효과를 주장할 수 없다. 모델의 직렬화 파일은 읽거나 실행하지 않는다.

## 검증
합성 고정 fixture, 난수 없음. 아래 20개 methods를 일반/최적화 Python에서 반복 검증한다(40개 독립 tests 아님).

```
PYTHONPATH=src python -B -m unittest discover -s tests -p test_capture_transitions.py -v
PYTHONPATH=src python -O -B -m unittest discover -s tests -p test_capture_transitions.py -v
```

기존 기능과 연결·merge한 상태나 전체 CI 통과를 뜻하지 않는다. Draft 검토용 후보이며 운영 승인이나 배포 상태를 의미하지 않는다.


## R2 최소 수정
- offset hour 00~23 / minute 00~59를 변환 전에 확인한다. +09:60 같은 정규화 허점을 거부하고 -00:00은 알려지지 않은 offset으로 보수적으로 거부한다. 이 범위는 일반 offset 문법이며 실제 지역 시간대 존재를 인증하지 않는다.
- JSON 소수/지수 토큰을 Decimal로 정확하게 읽는다. 순위 키는 copy_negate()로 생성하여 decimal context precision에도 반올림되지 않는다. 따라서 0.50000000000000001과 0.5는 다르고 5e-1과 0.5는 같다. 입력 생성자가 이미 float로 반올림한 정보는 복구하지 못한다. 문자열 점수는 여전히 거부한다. 출력 score_policy로 이 정책을 명시한다.
- V1 CSV의 실제 392개 점수 토큰을 합성 입력의 점수 자리로 넣고 Decimal 원문값 보존을 검사했다. 점수 형식 호환성 검사일 뿐 실제 baseline 전체를 평가하거나 timezone을 보충한 것이 아니다. 신규 후보 부재, 실제 비교 NOT_RUN 유지.

## Draft #221과의 경계
2026-11-18 GitHub 조회: #221 open/draft, merged=false, head e0fc1b5d88b8acd8e151e9b4a0fd7700dd3cce04. 본 작업에서 PR을 수정하지 않았다.
#221은 original = eligible + held 분할, held 사유·출처, original/eligible 중 분모, 정수 분수 ceil, 같은 K라도 다른 규칙 차단을 검증한 뒤 pinned 동일모델 재현 비교기를 호출한다. 이 후보는 그 역할을 구현하거나 대체하지 않는다.
이 후보 K는 제출된 전체 행 집합에 대한 명시적 fixed count만이다. fractional 예산·원래 모집단·held 구분을 전달하거나 검증하는 계약이 없다. 따라서 #221을 거친 eligible subset으로의 자동 변환/운영 연결은 미구현이며 호환 완료를 주장하지 않는다. 그 연결이 필요하면 #221의 분할/예산 계약을 그대로 재사용하고 원본 SHA·원래/eligible/held 집합·같은 budget 규칙을 함께 결합하는 별도 설계와 승인이 먼저 필요하다. #221의 unknown label 거부와 본 후보의 별도 unknown 분류, naive timestamp와 엄격 timezone, float와 정확 JSON decimal, 동일모델 제한과 서로 다른 모델 허용도 다르다. 스키마를 묵시적으로 바꾸거나 K만 복사해서 호환이라고 하지 않는다.
