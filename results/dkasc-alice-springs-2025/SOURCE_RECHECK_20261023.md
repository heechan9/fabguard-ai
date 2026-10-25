# DKASC Alice Springs 2025 원본 확보 후 재대조 (2026-10-23)

## 입력과 출처 경계

- 개인 FabGuard Drive에 보관된 원본 CSV를 읽었다. 공개 저장소에 원본 222,967,385바이트나 비공개 Drive 주소를 복제하지 않는다.
- 파일명: `Alice_Springs_2025.csv`; SHA-256: `d10ebe27ea417a36d5abcf552c6c29aa0ec932b36aa61eab5be0732854dcb896`.
- 바이트 해시가 기존 [`normalization_audit.json`](normalization_audit.json)의 `source_sha256`과 정확히 일치한다. 이 결과는 **이 파일과 당시 감사 입력의 동일성**을 확인한다. 공급처 인증, 사용 허가 또는 단위의 직접 확인을 추가로 증명하지 않는다.
- 기존 감사의 공급처 URL은 `https://dkasolarcentre.com.au/download?location=alice-springs`, 접근일은 2026-09-07이다. 이번 검사는 공급처에 다시 접속하지 않았다.

## 재실행 범위

저장소의 `src/fabguard/integrations/dkasc_normalizer.py`를 Python 3.12.14, pandas 2.2.3, NumPy 2.3.5에서 다음 조건으로 실행했다: `--start 2025-01-01 --end 2026-01-01` (기본 5분 간격, 최대 30초 시각 오차, `Australia/Darwin`, `241_DKA_Totals_PV_Active_Power`). 원본 105,393개 데이터 행 중 기간 내 105,105개를 읽었다.

| 항목 | 기존 감사 | 이번 재실행 |
| --- | ---: | ---: |
| 정규화 행 | 105,120 | 105,120 |
| 시각 보정 / 충돌 그룹 | 7 / 4 | 7 / 4 |
| 결측 시각 슬롯 / 최종 전력 결측 | 19 / 93 | 19 / 93 |
| SDT용 음수 전력 0 처리 | 53,817 | 53,817 |

**출력 바이트 해시 불일치:** 기존 감사와 [`report.json`](report.json)은 정규화 CSV SHA-256 `219a54ed6014671aa79b941247eb73f0e0888d682f35c2e8b18322d327156cc2`를 기록한다. 이번 환경의 출력은 `217a33a52d8aa4b62d240b2b90466f9de743edec43483437172c7b72ccd906bd`였다. pandas `read_csv(float_precision='round_trip')`도 별도 해시 `b35f14ecb2bf6a567734a0aa6fce72918f3ac57a23297162c56ee8349977752a`를 만들었고, 기본 파싱과 전력값 두 곳이 달랐다. 당시 정규화 CSV 자체는 이 저장소나 개인 Drive에서 찾지 못했으므로 정확한 차이 위치와 원인은 아직 검증하지 못했다.

기존 SDT 보고서는 보존한다. **이번 확인으로 그 보고서의 바이트 단위 재현이나 SDT 재실행이 완료된 것은 아니다.** 다음 검증은 당시 실행 환경과 정규화 CSV 확보, 값별 차이 및 CSV 직렬화 비교, 그 뒤 동일 입력 해시의 Frictionless→SDT 재실행이다. 전력 단위는 기존 감사대로 `inferred_kW_pending_direct_schema_confirmation`을 유지한다.
