# 프로젝트

FabGuard AI는 UCI SECOM 데이터에서 Fail 위험 생산 건을 우선순위화하고 익명 측정변수 근거를 제시하는 2주 개인 포트폴리오 MVP다.

# 규칙

- `AGENTS.md`, `PRD.md`, `PLAN.md`를 먼저 읽는다.
- 한 번에 한 수직 슬라이스만 구현한다.
- 새 의존성·데이터 분할·평가 정의 변경 전에는 멈추고 이유를 알린다.
- 테스트를 먼저 만들고 실패를 확인한 뒤 구현한다.
- 전처리는 학습 폴드에만 fit하고 테스트 세트는 최종 1회만 사용한다.
- 익명 변수의 중요도를 실제 원인으로 표현하지 않는다.

# 실행

- 스켈레톤: `PYTHONPATH=src python -m fabguard.skeleton --output results/skeleton_priority.csv`
- 테스트: `PYTHONPATH=src python -m unittest discover -s tests -v`

# 금지

- 딥러닝, LLM, RAG, LangChain/LangGraph 도입
- 검증되지 않은 성능·비용·수율 개선 주장
- 요청하지 않은 대형 UI와 리팩터링
- 테스트 skip 또는 평가 기준 완화

