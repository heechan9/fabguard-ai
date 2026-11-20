# Contribute to FabGuard AI

[프로젝트 소개](README.md) · [문서 지도](docs/README.md) · [기여 기록](docs/governance/CONTRIBUTIONS.md)

## Start here (English)

[Collaboration page](https://fabguard-ai.vercel.app/collaborate/) · [English technical handoff](docs/TECHNICAL_HANDOFF_EN.md) · [Japanese technical handoff](docs/TECHNICAL_HANDOFF_JA.md)

- **Question, idea, or unconfirmed symptom:** use the [Collaboration question or idea form](https://github.com/heechan9/fabguard-ai/issues/new?template=collaboration-question.yml). Do not file an unconfirmed symptom as a bug.
- **Confirmed, reproducible finding:** use [Focused review feedback](https://github.com/heechan9/fabguard-ai/issues/new?template=review-feedback.yml) for one finding. Include the commit SHA, environment, minimal steps, expected result, and actual result. A patch is optional.
- **Larger change:** propose the problem, interface or evaluation impact, acceptance checks, and scope first. Open an issue once the approach is agreed, then link one focused PR. Small corrections can go directly to a PR.
- **Private material:** do not post production data, keys, identifiers, confidential screenshots, or raw site logs. Use a synthetic example; do not move real data into a public thread. If redaction is not possible, stop and arrange an authorized private route separately.

### One-question replay

**Can the synthetic receipt distinguish matching, missing, and substituted roster IDs?** From the repository root, run `python examples/collaboration_replay.py`. No package, network, or measurement data is needed. The fixed roster is SYN-01/02/03; the second case omits SYN-02 and the third replaces it with SYN-99. Expected: `MATCH`, `MISSING`, `SUBSTITUTED` in that order. Report only the fixture version/digest, commit SHA, OS and Python version, and `PASS`, `FAIL`, or `NOT_RUN` (and reason if applicable). This tests the demonstration receipt, not a production verifier or a model.

### Leave a reproducible review receipt

A review can be useful without a patch. Try a single synthetic case in the public collaboration page and keep the original expected result separate from what your browser actually displayed. A concise note is enough:

```text
Question:
Public URL and commit SHA (or unknown):
Fixture and case:
Expected:
Observed:
Result: CONFIRMED / DIFFERENT / NOT_RUN
Environment and one next check:
```

If you could not run the case, say why. Share synthetic outputs only, and do not claim maintainer approval, a partnership, or factory performance from this exercise.

### Review routing and decisions

| Area | Reviewer role, not an assignment |
| --- | --- |
| SMT / web | Interaction, accessible fallback, and demo boundaries |
| Evaluation | Splits, metric definitions, and reproducibility |
| Intake / data contracts | Source identity, eligibility, missingness, and visibility |
| Docs / English | Clarity, links, terminology, and claim boundaries |

Name a human decision owner for each significant change once the person has agreed. Review the exact PR head; AI reviews are advisory. Keep the asynchronous decision in the issue/PR: **decision · why · owner/role · head/evidence · next check**. If the supporting material is private, record only a sanitized decision publicly. Credit actual contributions by role and only with permission for public attribution; cite source inspiration separately from implementation, review, or partnership. The workflow is informed by [Autoware’s public contribution guidelines](https://docs.autoware.org/main/contributing/) and [review guidelines](https://docs.autoware.org/main/contributing/pull-request-guidelines/review-guidelines/); this is not an affiliation or endorsement.

## 한국어 작업 안내

이 문서는 변경 방법을 안내한다. 누가 무엇을 구현했는지는 [CONTRIBUTIONS.md](docs/governance/CONTRIBUTIONS.md), AI 활용 내역은 [AI_USAGE.md](docs/governance/AI_USAGE.md)에 기록한다. 구현 규칙은 [AGENTS.md](AGENTS.md)가 기준이다.

## 작업 시작

1. [요구사항](docs/project/PRD.md)과 관련 문서를 읽고 변경 목적을 하나로 좁힌다.
2. 최신 `main`에서 작업 브랜치를 만든다. 예: `docs/문서주제`, `fix/오류주제`, `feat/기능주제`.
3. 기존 실행 명령과 정본 결과 경로를 확인하고 필요한 파일만 수정한다.
4. 관련 검증을 실행하고 실제 결과를 PR에 기록한다.
5. 리뷰와 필수 검사가 완료되면 병합한다. `main` 변경은 연결된 웹 배포에 반영될 수 있다.

## 변경 종류별 확인할 곳

| 변경 | 기준 문서·검증 |
|---|---|
| 문서·탐색 링크 | [문서 지도](docs/README.md), 변경한 상대 링크의 대상·앵커 확인 |
| 웹 화면 | [웹 코드 안내](web/README.md), 관련 JavaScript 검사와 웹 테스트 |
| 모델·전처리·평가 | [실험계약](docs/validation/EXPERIMENT_CONTRACT.md), [재현 가이드](docs/validation/REPRODUCIBILITY.md), 관련 Python 테스트 |
| 외부 데이터·연동 | [문서 지도](docs/README.md)의 수집·연동 계약, [결과 카탈로그](results/README.md) |

전체 자동 검사의 실제 명령은 [CI 워크플로](.github/workflows/ci.yml)를 따른다. 문서 변경만으로 학습을 다시 실행하거나 정본 결과를 덮어쓸 필요는 없다.

## 이슈와 PR 작성

- 오류 보고: 발생 화면 또는 파일, 재현 순서, 기대 동작, 실제 동작을 적는다.
- 모델·현장 적합성 검토: GitHub의 기존 **Focused review feedback** 이슈 양식을 사용한다.
- PR: 해결할 문제, 변경 내용, 검증 명령·결과, 미검증 사항을 적는다. 실행하지 않은 검사를 통과했다고 표시하지 않는다.
- AI가 구현한 작업은 AI 사용 범위와 사람이 확인한 내용을 구분한다.

## 자료와 파일 관리

- 새 문서는 [문서 지도](docs/README.md)에 연결한다. 실행 증거와 설계 제안을 구분한다.
- 정본 결과는 기존 경로를 참조하고 소개 문서마다 수치를 복사하지 않는다.
- 원본 데이터·외부 자료를 추가할 때는 재배포 가능 여부와 출처를 확인한다. 인증정보와 비공개 현장 자료를 커밋하지 않는다.
- 브랜치 정리는 병합 여부와 다른 PR의 참조 여부를 확인한 뒤 진행한다.
- 실제 수율·비용 개선이나 익명 변수의 공정 원인을 검증 없이 주장하지 않는다.
