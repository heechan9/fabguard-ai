# 5회차 적용 검사 기록 — 2026-10-30 KST

기준 main `cce8360fba1920fa8465da79dbd3b35cee2c4ae8`. 최종 head는 이 파일을 포함하는 Draft PR 본문에 고정한다.

## 변경과 실제 실행

1. 기존 모델에서 고정된 변수5개에 대한 학습구간 분포·결측·그룹/월별 설명을 생성했다. 공식 원본3개는 기존 SHA-256 계약과 대조했다. 코드·원본·train manifest·중요도표 해시는 summary.json 및 아래 코드 해시에 남긴다.
2. 기존 1페이지 요약을 P-A-D-A로 재구성했다. 기존 대표 수치·노출 이력·통계 한계·원본 링크를 보존했다.
3. #182의 고정 감사에서 BOSCH 입력 문제와 미해결 조건을 JSON/문서 계약으로 구체화했다. 원본을 다시 계산하거나 #182를 포함/병합하지 않았다.

실제 실행 환경: Python3.12.14, pandas2.2.3, numpy2.3.5, matplotlib3.10.8. 런타임 의존성 추가 없음. 무작위 알고리즘/새 모델 적합/시험 점수 계산 없음(seed 해당 없음).

```bash
PYTHONPATH=src python scripts/build_secom_distribution_evidence.py --data-dir /tmp/fabguard-session5-source
PYTHONPATH=src python -m unittest discover -s tests -v
node --test tests/web/*.test.mjs
```

- Python: **292개 중286통과·6생략·실패0**. [원문](python.log). 신규5검사는 시험 값/라벨을 바꿔도 설명 불변, 표준화 차이 부호·표본분산, 전부 결측/0분산 null, 매니페스트 불일치/중복 거부, 비유한 관측 거부를 확인했다.
- 생략6: 공식 SECOM 원본은 검사 기본경로 data/raw/에 두지 않아 기본 계약1건 생략(실제 설명 실행은 별도 원본 경로와 해시를 검증). 선택 pyarrow3, 선택 Frictionless2 미설치. 테스트 삭제·skip 추가 없음. Parquet 실회귀는 기존 CI robot-extra 범위다.
- Node: **120통과·실패0**. [최종 원문](web.log). 첫 실행은 기존 문서 계약이 요구한 ‘현장 의사결정 구조’ 표제가 사라져1건 실패했다. 표제/기존 앵커를 복원하고 실제 현장 구현 전 범위를 명시해 같은 검사 통과. [수정 전 실패 원문](web-before-doc-fix.log). 테스트 조건은 바꾸지 않았다.
- 독립 계산: 표준 라이브러리 statistics.mean/stdev로 원본 텍스트의 학습 ID 행만 직접 읽어5변수의 관측/결측 수·평균 차이·pooled SD 표준화 차이를 별도 재계산, JSON과 오차1e-12 범위에서 일치.
- 재현: 다른 임시 출력 디렉터리에 재실행한 JSON/CSV/SVG **8파일 바이트 일치**. 선택 변수나 결과를 보며 튜닝하지 않았다.
- 시각 점검: 생성SVG5개를 로컬 렌더링해 직접 확인. 두 그룹 동일bins·밀도 축·관측n·상자그림/IQR 꼬리와 원시 전체범위 표시. 극단값은 삭제하지 않았다. 첫 SVG 렌더링은 선택 CairoSVG 미설치로 실패했고, 설치하지 않고 기존 PyMuPDF의 SVG 렌더러로 확인했다. 제품 코드/의존성에 영향 없음.

## 미검증과 변경하지 않은 것

- 웹/UI 파일은 변경하지 않았다. 실제 브라우저·360/390·키보드·휴대전화·스크린리더 재검사는 이번 작업에서 실행하지 않았다.
- 분포는 모델 학습에 사용한 자료의 탐색적 설명이다. 정규성·독립성·인과·공정 센서 의미·새 예측 성능·현장 효과를 입증하지 않는다. 그룹 차이는 추가 이력·독립 자료에서 확인할 가설이며 원인 확정이나 재학습/선택 기준이 아니다.
- BOSCH 시간 의미·단위·타깃/보간 정책 승인·LOT 분할은 미확정이다. 입력 계약을 만들었다고 원본 문제가 해소됐거나 모델 실험 준비가 완료됐다고 하지 않는다.
- 원본 SECOM files, results/v1 및 results/phase1·web/·모델·정본 지표·기존9/0/3·null 성능을 수정하지 않았다.
- #178~#182는 미병합 Draft 그대로다. 본 변경은 최신 main에서 독립된 Draft이며 문서 공통 경로의 나중 통합은 별도 검토가 필요하다.
- Claude/별도 담당의 독립 검토는 대기다. 최희찬 승인 전 병합·배포 없음.

소스·문서·SVG의 `git diff --cached --check` 통과(원문 로그는 공백을 수정하지 않고 보존하므로 *.log 제외). 생성 SVG의 줄 끝 공백만 정규화했으며 숫자·그림은 변경하지 않았다.

## PR #183 해석 보완 (2026-10-30 UTC)

위 실행 기록과 `implementation_hashes.json`은 최초 head `9cf0bb9`의 이력으로 보존한다. 이번 보완은 같은 Draft의 설명·민감도만 추가한다. Codex가 구현·실행했고, 최희찬은 보완을 요청했다. heechan9 연결 계정으로 게시하되 커밋에 Codex 공동 기여를 표시한다. 이번 변경의 새 독립 외부 검토·사용자 직접 실행을 주장하지 않는다.

- 공식 UCI SECOM ZIP을 다시 받아 기존 원본3개 SHA-256 계약을 통과했다. frozen Train/importance 해시도 통과했다. `PYTHONPATH=src python scripts/build_secom_distribution_evidence.py --data-dir /tmp/fabguard-secom-183 --output /tmp/fabguard-secom-183/generated` 실행. 새 민감도 JSON만 저장소에 추가했다. 기존 summary.json은 객체 전체 일치, group/monthly CSV는 바이트 일치다. 기존 그림은 수정하지 않았다.
- `feature_475` 양군 최대 각각 한 건 제외 진단: Pass39.3528 제외 차이0.5950141513761462, Fail38.2143 제외 차이0.14064860713084126. 별도 표준라이브러리 경로로 원본 Train 행을 읽고 평균을 재계산해 오차1e-12 안에서 일치했다. 전체 최대와 Fail 최대를 구분한다. 원본과 모델 입력의 행 삭제는 없다.
- `PYTHONPATH=src python -m unittest discover -s tests -v`: **296개 중290통과·6환경생략·실패0**. 신규4개: 양군 최대/동률/중복 index/원본 불변, 결측·단일 관측·비유한값, Test 변화 불변, 저장 민감도와 기존 요약·한 건 제외 산술 일치. 환경생략은 위 최초 실행과 동일한 공식 원본 기본경로1·pyarrow3·Frictionless2다. 별도 원본 경로의 실제 빌드는 해시 검증 후 성공했다.
- 기존 CI 명령의 JS 문법4개, `verification/recompute_v1.py`, `verification/source_clarifications.py`, `scripts/build_web_evidence.py --check`, `node --test tests/web/*.test.mjs` 통과(웹120/120). persisted-evidence 검사는 저장된 과거 결과 일관성 검사일 뿐 새 모델 inference/시험 평가가 아니다.
- 새 학습·대치 fit·변수 재선택·시험 원본 통계·점수 생성·SPC 변경 없음. 원본·models·results·web·BOSCH 계약·다른 Draft #184 변경 없음. 브라우저/UI 재검증 및 외부 인과·현장 효용 검증은 하지 않았다.
- 동일 실행 환경은 기존 summary.json과 일치한다. 무작위 계산 없음(seed 해당 없음). Matplotlib의 기본 캐시 경로가 읽기 전용이어서 자동 임시 캐시 경고가 있었으나 빌드 exit0. 새 그림은 게시하지 않았다.
