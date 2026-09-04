# Fledge 연계 준비 계약

상태: **사전 검증용 로컬 경계 — Fledge 플러그인 또는 공식 연동 완료가 아님**

## 이번 단계에서 구현한 것

`fabguard.integrations.normalize_fledge_readings`는 Fledge 계열 reading envelope의 작은 부분을
FabGuard가 검사 가능한 표로 정규화한다. 외부 패키지 없이 다음을 검증한다.

- 비어 있지 않은 `asset_code`
- `user_ts` 또는 `ts`의 UTC 파싱
- `reading` 내부 측정값의 숫자/null 제한
- 필수 측정값 누락 시 fail-closed 처리
- `asset_code + timestamp` 중복 차단
- 안정적인 `sample_id`, `event_time`, `measurement__*` 출력

입력 예시:

```json
{
  "asset_code": "etch-01",
  "user_ts": "2026-09-04T01:00:00Z",
  "reading": {
    "pressure": 1.2,
    "temperature": 22.4
  }
}
```

이 예시는 FabGuard가 독자적으로 만든 최소 계약이며 외부 프로젝트의 코드나 문서를 복제하지 않는다.

## 의도적으로 연결하지 않은 것

- Fledge 런타임·Python 플러그인 API
- north/south service 배치 위치
- 재시도, 재시작, 상태 저장과 설정 수명주기
- SECOM V1 모델에 실시간 reading을 바로 넣는 경로
- Solar Data Tools 종속성

실제 플러그인은 해양 프로젝트 종료, FabGuard 출력계약 동결, upstream 이슈 논의 후 별도 PR로
진행한다. 이 모듈의 존재만으로 실시간 현장 연동이나 Fledge 호환을 주장하지 않는다.

## 다음 검토 게이트

1. Fledge maintainer에게 가장 작은 기여 후보와 reading schema 범위를 확인한다.
2. 공식 플러그인 예제의 수명주기와 오류 처리 규약을 조사한다.
3. 익명 SECOM 변수와 실제 설비 tag의 매핑은 별도 현장 스키마로 분리한다.
4. 정상·결측·지연·중복·비수치 payload fixture로 계약 테스트를 확장한다.
