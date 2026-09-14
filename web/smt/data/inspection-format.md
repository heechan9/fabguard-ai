# SMT 검사 기록 준비 형식 v1 (제안)

학교에서 제공 가능한 원본 표본을 확인하기 위한 CSV 양식입니다. 장비의 실제 내보내기 형식이나 API를 확인한 계약이 아닙니다. 현재 웹은 이 파일을 업로드하거나 분석하지 않습니다. 예제는 전부 합성이며 학교 측정값·검증된 예측값이 아닙니다.

UTF-8 CSV, 첫 줄은 열 이름입니다. 빈 양식에는 데이터가 없습니다. 측정 또는 검사 1건을 한 행에 기록합니다.

| 열 | 작성 기준 |
| --- | --- |
| data_source | 실제 관측은 observed, 가상 예제는 synthetic. 혼합하지 않음 |
| source_id | 제공 출처 식별자. 토큰·개인정보 제외 |
| run_id | 생산·시험 회차. 재작업은 별도 회차로 구분 |
| event_id | 출처·회차 안에서 고유한 기록 ID |
| board_id | 공정을 지나도 유지되는 기판 식별자 |
| event_time | 시간대가 명시된 ISO 8601 시각. 예: 2026-09-14T09:00:00+09:00 |
| station_id | 아래 공정 ID 중 하나 |
| record_type | measurement 또는 inspection |
| measurement_name | 측정 항목 이름. inspection 행에서는 빈칸 |
| value | 유한한 숫자. 누락은 빈칸이며 0으로 대체하지 않음. NaN·Infinity·1e999 금지 |
| unit | 측정 단위. %, degC 등. 측정 기준과 함께 제공자가 확인 |
| missing_reason | measurement 값이 없을 때 필수. 예: sensor_missing |
| inspection_result | inspection 행에 pass / fail / unknown. measurement 행에서는 빈칸 |
| defect_code | 검사 결과의 원본 불량 코드. unknown을 정상으로 바꾸지 않음 |

공정 ID: loader, printer, spi, mounter_chip, mounter_multi, work_table, reflow, cooling, aoi, ng_buffer, unloader.

측정 행에는 measurement_name과 unit이 필요합니다. 검사 행에는 측정 열을 비웁니다. 예제의 paste_volume_ratio는 가상 기준량 대비 비율이고 실제 SPI 출력 정의를 뜻하지 않습니다. SIM_PASTE_LOW는 합성 코드입니다. Reflow 최고 온도가 장비 설정값인지 기판 실측값인지도 원본에서 확인해야 합니다.

실제 연동 전에는 출처·회차·기판 ID 연결, 장비 시계 동기화, 재검사 순서, 단위·교정·판정 기준을 확인합니다. SPI에는 패드/부품 위치 식별자가 필요할 수 있으며 실제 표본에 맞춰 형식을 확장해야 합니다. 값이 부족하면 예측 학습이나 인과 판단을 하지 않습니다. SECOM 모델을 SMT 기록에 적용하지 않습니다.

## 학교 장비 참고 자료

사용자가 제공한 「한국산업기술대학교 첨단제조혁신원.mht」의 SMT 장비 11종을 대응시켰습니다. 원문 URL: https://amic.tukorea.ac.kr/equ/equInfo/equInfo.hs?sso=ok

첨부 SHA-256: 680a10eb6dbe107bfd792d262d91c9d1143623b0eb3c9d2e1785ff402e0310a3

자료 검토일: 2026-09-14. 원본 저장일과 현재 장비 보유 상태는 확인하지 않았습니다. 기판 대응 크기는 장비 외형 치수가 아닙니다. YAHAMA와 Reflow의 단일 수치 560은 원문을 유지했습니다. 3D 외형·처리 시간·가상값·규칙은 개념 시뮬레이션이며 해당 모델의 성능 사양이 아닙니다.
