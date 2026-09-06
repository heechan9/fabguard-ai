# Fledge 연계 준비 계약

상태: **공식 REST pull 경로 구현 및 로컬 E2E 검증 — 실제 Fledge 인스턴스 검증 대기**

## 이번 단계에서 구현한 것

`fabguard.integrations.normalize_fledge_readings`는 Fledge 계열 reading envelope의 작은 부분을
FabGuard가 검사 가능한 표로 정규화한다. 외부 패키지 없이 다음을 검증한다.

- 비어 있지 않은 `asset_code`
- `user_ts` 또는 `ts`의 UTC 파싱
- 단위가 모호한 숫자형 epoch timestamp 차단(현재 로컬 계약은 ISO 8601 문자열만 허용)
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

## 공식 REST pull 경로

`fabguard-fledge-rest`는 Fledge User API의 읽기 전용
`GET /fledge/asset/{code}?limit=N` 응답을 가져와 기존 운영 경계로 전달한다. Fledge 응답에
생략된 asset code를 URL 값으로 복원하고, 공식 예제의 timezone 없는 저장 timestamp는 이
어댑터 경계에서 UTC로 명시한다. 인증이 활성화된 인스턴스에서는 토큰을 명령행이 아니라
`FLEDGE_AUTHTOKEN` 환경변수로 받아 `authtoken` 헤더에만 넣으며 결과 파일에는 기록하지 않는다.
인증정보가 다른 endpoint로 전달되지 않도록 HTTP redirect는 동일 origin 여부와 관계없이 거부한다.

```bash
FLEDGE_AUTHTOKEN="<session-token>" fabguard-fledge-rest \
  --base-url http://localhost:8081 \
  --asset etch-01 \
  --limit 100 \
  --observed-at 2026-09-06T07:05:00Z \
  --require pressure \
  --require temperature \
  --output-dir results/fledge-live
```

## 아직 연결하지 않은 것

- Fledge 내부 Python filter-plugin 수명주기
- north/south service 배치 위치
- 재시도, 재시작, 상태 저장과 설정 수명주기
- SECOM V1 모델에 실시간 reading을 바로 넣는 경로
- Solar Data Tools 종속성

현재 테스트는 공식 REST 응답 형식을 제공하는 로컬 HTTP 서버를 통해 URL 인코딩, 인증 헤더,
응답 크기 제한, 오류 응답 차단과 운영 처리기 진입을 E2E로 확인한다. 실제 Fledge 3.x 인스턴스와
센서/네트워크 장애 검증은 별도 외부 증거로 남는다.

현재 계약 검사는 배치 내 위반 하나에도 전체 호출을 중단하는 strict fail-closed 방식이다. 이는
오프라인 검증 단계의 의도된 동작이다. 실시간 수집 단계에서는 전체 스트림을 중단시키지 않도록
오류 reading 격리, dead-letter queue 또는 명시적 skip 정책을 upstream과 합의한 뒤 별도로
설계한다. 지금 구현은 해당 운영 동작을 주장하지 않는다.

## 다음 검토 게이트

1. Fledge maintainer에게 가장 작은 기여 후보와 reading schema 범위를 확인한다.
2. 공식 플러그인 예제의 수명주기와 오류 처리 규약을 조사한다.
3. 익명 SECOM 변수와 실제 설비 tag의 매핑은 별도 현장 스키마로 분리한다.
4. 정상·결측·지연·중복·비수치 payload fixture로 계약 테스트를 확장한다.

공식 커뮤니티에 문의하거나 upstream 코드를 시작하기 전에는
[`FLEDGE_UPSTREAM_READINESS.md`](FLEDGE_UPSTREAM_READINESS.md)의 기여 절차, 후보 범위,
DCO 및 검증 게이트를 따른다.

## 로컬 smoke 실행

이 저장소가 제공하는 예시 입력만으로 계약 경계를 재현할 수 있다.

```bat
python -m fabguard.integrations.fledge_smoke ^
  --input examples\fledge\readings.json ^
  --output-dir results\fledge-smoke ^
  --require pressure ^
  --require temperature
```

성공 시 `normalized_readings.csv`와 `quality_report.json`을 만든다. 출력 상태
`contract_validated`는 로컬 형식 검증 성공만 뜻하며 Fledge 플러그인·실시간 연결·현장 검증을
뜻하지 않는다.
