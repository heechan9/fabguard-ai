# 실행 기록 — 2026-10-31 KST

기준 main 9d034091cc366d92df9cfeb45bcf21a2f04583d8. Codex 구현·로컬 실행, 독립 검토 대기. Python3.12.14.

- PYTHONPATH=src python -m unittest discover -s tests -v: 293개 중287통과,6기존환경 생략. 신규6개 생략 없음. 원문 python.log.
- node --test tests/web/*.test.mjs:153통과,실패0. 원문 web.log.
- python -m py_compile verification/compare_priority_runs.py: 성공.
- 문서의 비교 명령을 양쪽 모두 정본 priority_table.csv로 실행:392건 MATCH,종료0. self-comparison.json. 저장표 자기 비교이며 새 모델 실행/독립 성능 검증 아님.
- reference=/nonexistent로 동일 명령:BLOCKED,종료2. missing-input.json.
- 테스트가 여러 유효 차이의 수집,입력불변,행순서무관,명시허용오차,계약 위반 차단을 확인.
- 웹변경 없음. 실제브라우저·모바일·키보드 재실행하지 않음. 별도PC 독립추론·모델성능·Shadow 실행 미검증/미구현.
- 모델·분할·정본결과·임계값·배포 변경 없음. 기존 PR190 및 다른 Draft 미포함.
