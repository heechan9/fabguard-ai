# FabGuard AI 완료 판정 케이스

| # | 입력·상황 | 기대 결과 | 판정 |
|---:|---|---|---|
| 1 | 공식 SECOM 원본 입력 | 1,567행·590 측정변수·Fail 104건을 확인 | 계약값과 정확히 일치 |
| 2 | timestamp 포함 원본 | 모든 행이 파싱되고 시간순 정렬 가능 | 파싱 실패 0건 |
| 3 | 시간순 분할 실행 | Train 1,175건·Test 392건 생성 | 행 중복 0, 누락 0 |
| 4 | CV 전처리 실행 | imputer·scaler·selector가 각 학습 폴드에만 fit | pipeline 검사 테스트 통과 |
| 5 | Dummy baseline | 모든 필수 지표와 예측 결과 생성 | NaN 없이 스키마 충족 |
| 6 | L1 Logistic·Random Forest | 동일 분할·동일 지표로 비교 | 결과표에 모델별 동일 열 존재 |
| 7 | Top-K 평가 | K별 점검 건수와 포착 Fail 수·비율 생성 | 단조성·분모 테스트 통과 |
| 8 | priority table 생성 | ID·risk_score·rank·prediction·label·suggested_features 존재 | risk_score 내림차순, rank 유일 |
| 9 | 같은 seed와 환경으로 재실행 | 선택된 결과가 허용오차 내에서 동일 | manifest·수치 비교 통과 |
| 10 | 원본 파일 누락 | 명확한 오류와 예상 경로를 출력하고 중단 | 임의 더미 데이터로 계속하지 않음 |
| 11 | 전부 결측인 변수 포함 | 학습 폴드 규칙에 따라 제거·기록 | 조용한 실패 없이 제거 수 기록 |
| 12 | 익명 변수 설명 출력 | 실제 센서명·원인·조치를 추정하지 않음 | 한계 문구 포함 |

## 모델 선택 규칙

Accuracy 단독으로 선택하지 않는다. 반복 CV에서 Fail Recall, PR-AUC, Balanced Accuracy, False Alarm Rate와 Top-K Risk Capture를 함께 보고, 성능 변동성과 해석 가능성을 고려한다. 선택 기준은 보존 Test를 열기 전에 고정한다.

## 최종 게이트

- 모든 자동 테스트 통과
- 데이터·코드·환경·seed manifest 존재
- 보존 Test 결과가 한 번의 승인된 실행으로 생성됨
- priority table과 보고서의 수치가 일치
- 실제 원인 규명·수율 개선·생산 배포를 주장하지 않음
