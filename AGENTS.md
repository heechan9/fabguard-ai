# FabGuard AI 작업 규칙

## 프로젝트

UCI SECOM 데이터에서 Fail 위험이 높은 생산 건을 우선순위화하고 우선 확인할 익명 변수를 제시하는 2주 개인 포트폴리오 MVP다. 프로덕션 시스템이 아니다.

## 실행 원칙

- Python 기반의 읽을 수 있는 함수와 scikit-learn Pipeline부터 사용한다.
- 새 의존성 추가, 데이터 분할 변경, 평가 정의 변경 전에는 이유를 문서화한다.
- 한 작업은 한 수직 슬라이스와 한 검증 단위로 제한한다.
- 테스트를 삭제·skip·완화해서 통과시키지 않는다.
- 고정 seed, 입력 데이터 해시, 환경 버전, 실행 명령을 남긴다.

## 현재 실행

- 스켈레톤: `PYTHONPATH=src python -m fabguard.skeleton --output results/skeleton_priority.csv`
- 테스트: `PYTHONPATH=src python -m unittest discover -s tests -v`

## 실험 불변조건

- 원본 데이터: 1,567개 생산 건, 590개 측정변수, Fail 104건을 기대한다.
- 시간순 Train 1,175건 / Test 392건을 기본 계약으로 사용한다.
- Test는 최종 1회 평가에만 사용한다.
- 결측치 처리, 상수 제거, 스케일링, 특성 선택은 학습 폴드에만 fit한다.
- 기본 비교 모델은 Dummy, L1 Logistic Regression, Random Forest다.

## 하지 말 것

- 익명 변수를 실제 센서·공정 원인으로 명명하지 않는다.
- Accuracy 개선만을 목표로 하지 않는다.
- 실제 수율 개선, 고장 예방, 비용 절감 효과를 검증 없이 주장하지 않는다.
- 요청하지 않은 리팩터링·대시보드 확장·프레임워크 도입을 하지 않는다.
