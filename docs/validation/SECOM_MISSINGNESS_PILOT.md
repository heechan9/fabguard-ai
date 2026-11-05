# SECOM 결측 정보 파일럿 — 사전 실험 계약

2026-10-23. 기존 V1/Phase1 결과와 운영 모델을 변경하지 않는 탐색 실험이다.
기존 코드는 이미 학습 폴드별 고결측/상수/중복 열 제거와 결측 indicator를 사용한다.
이번 가설은 indicator 제거, 필터 이전 원본 590열의 행별 결측 개수 추가,
scikit-learn 내장 histogram boosting 비교다. 새 의존성은 없다.

## 평가 설계와 변경 이유

공식 시간순 Train 1,175 / Test 392 계약은 유지한다. Test에 대한 fit/predict/평가는 하지 않는다.
탐색 비교는 Train 내부의 고유 timestamp를 기준으로 초기 약 55%를 학습하고,
나머지를 연속 4구간으로 나누는 expanding window를 사용한다.
동일 timestamp는 경계를 넘지 않는다. 기존 반복 층화 CV를 대체하지 않는 별도
시간 일반화 진단이며 수치도 기존 Test AP와 직접 비교하지 않는다.

사전 후보: Dummy prior, V1 L1 C=.01, V1 RF depth=None/leaf=8/120 trees,
동일 RF에서 indicator 제거, 동일 RF에 원본 행별 결측 개수 추가,
HGB 100 iterations/7 leaves/min leaf=20/l2=1/learning rate=.05.
부스팅은 fold 내 class_weight=balanced, early_stopping=False를 사용한다.
추가 튜닝이나 결과를 본 뒤 후보 변경은 하지 않는다.

평가지표는 기존 AP와 Top10%(ceil, 동률 sample_id 순) 포착률/포착수다.
모든 후보는 같은 fold를 사용한다. 필터/중앙값은 각 fit 구간에서만 학습한다.
평균 AP·포착률과 RF 대비 fold별 차이를 함께 기록한다.
적은 불량과 4개 구간의 결과는 탐색 근거이며 독립 성능 개선 입증이 아니다.
입력 SHA-256, 환경, seed, split ID, 실행 명령을 JSON/CSV로 저장한다.
원본 데이터와 강의 PDF는 PR에 포함하지 않는다.

## 실행

```bash
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 PYTHONPATH=src python -m fabguard.missingness_pilot --output-dir docs/validation/secom_missingness_pilot
```
