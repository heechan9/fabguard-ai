# #173 후속 검증과 병합 준비도 — 2026-10-24

## 최신: 설치된 CI 브라우저로 수정본 검증 완료 범위 (2026-10-24)

**검증한 커밋:** `be404aae4e15716560722e9657799a322aae67c0`. 기존 GitHub Actions의 사전 설치 Chrome 155.0.8059.39를 사용했고 Chromium 설치를 재시도하지 않았다. Playwright 1.62.1은 테스트 드라이버로만 격리 설치했으며, 한글 스크린샷을 위해 테스트 환경에 fonts-noto-cjk를 설치했다. 서버는 127.0.0.1에만 바인딩하고 외부 페이지 요청은 차단했다. 공유 링크·접근 권한 확대·병합·운영 배포는 없다.

| CSS 화면 크기 | 동작 검사 | 결과 |
| --- | --- | --- |
| 1366×900 | 19 | 모두 통과 |
| 390×844 | 19 | 모두 통과 |
| 360×800 | 19 | 모두 통과 |

총 57/57, pageerror 0. 빈 값·최소 표본·tolerance/gap 오류와 aria-invalid, 첫 오류 초점, 고정 후 unlock 초점, Enter 해제 후 period 초점, 합성 계산과 성능 null, 해시 불일치·기준 파일 중복 시각 거부, 사용자 CSV 역할 부족·열/시각/UTF-8/5MB/20,000행 제한, 초기화, skip-link, SECOM 필터·Tab, 연구 화면 및 가로 넘침을 검사했다. 결과 원문은 local_ui/results.json, 화면별 SHA-256은 local_ui/file_hashes.json.

**화면 확인과 수정:** 첫 CI는 한글 글꼴이 없어 시각 판정에서 제외했다. 한글 글꼴을 갖춘 다음 화면에서 긴 오류 코드 때문에 모바일 계약 그리드가 카드 밖으로 밀리는 문제를 발견했다. 같은 회귀 검사를 수정 전 `b96dab97398a4ffb8a289227b32dfc268dacb92a`에 실행해 390px(field right 386 > card right 374.390625), 360px(384.8125 > 345.59375) 실패를 확인했다. 오류 문자열의 어디서든 줄바꿈과 minmax(0,1fr) 그리드로 수정 후 같은 검사가 통과했다. 테스트를 완화하지 않았다.

최종 스크린샷 15개 중 PC 초기·계산 결과, 모바일 390/360 오류 입력, 360 초기·SECOM 필터, 390 연구 화면 7개를 직접 열어 한글 표시·입력 초점 테두리·카드 내부 배치를 확인했다. SECOM 넓은 표는 내부 가로 스크롤 영역으로 표시되며 Tab으로 초점을 받을 수 있다. 캡처 위치 밖의 모든 화면을 시각 점검했다고 주장하지 않는다.

- 브라우저 실행: https://github.com/heechan9/fabguard-ai/actions/runs/40081768795
- 동일 커밋 기존 CI(test, robot-extra) success: https://github.com/heechan9/fabguard-ai/actions/runs/40081880104
- 수정 전 회귀 실패: https://github.com/heechan9/fabguard-ai/actions/runs/40081767082
- 화면 15개·결과 JSON·서버 로그 원본 ZIP은 기존 Drive 폴더에 보존: https://drive.google.com/file/d/1BK90BvGiSFhabhSm8Ie_iaXPfUakh-NK/view
- ZIP SHA-256: `de0b1d0e9344de67b6c1ccb0a4c8b06347f93820313340a060645650f14ad9df` (GitHub artifact digest와 다운로드 바이트 일치).

**판정 경계:** 수정된 코드의 위 로컬 브라우저 검증 범위는 통과. 실제 iOS/Android 단말·화면 낭독기·배포 서버 접근/인증·전체 탐색 화면은 미검증. 외부 웹폰트는 차단하고 Noto CJK fallback을 썼다. SPC 실제 실행은 별도 결과이며 이상 탐지 성능은 미평가다. 경보 9·0·3이나 EWMA 0건으로 우열·이상 탐지 성공을 주장하지 않는다. dot 검토·사용자 승인 전 병합·운영 배포 금지는 유지한다.

## 이전 이력: 로컬 Playwright 승인 후 실행 준비·환경 실패 (2026-10-24)

사용자는 #174 로컬 Playwright 검증을 명시 승인했다. 외부 공유 링크·권한 확대·main 병합·운영 배포 없이 127.0.0.1에만 서버를 준비했다. 비교 대상 원격 head는 `bf8221462a1d7a7d532ed12dd6e08bc91b28336b`, 로컬 head는 `956983c5f29e80a5559303061ee995e15bceda9a`이며 두 tracked tree의 diff는 0이었다.

**실제 실행 결과: 환경 실패, UI 검사는 0건.** Playwright Node 패키지는 있으나 Chromium 실행 파일이 없었다. 공식 `playwright install chromium` 다운로드의 자동 재시도는 모두 ZIP 중앙 디렉터리 오류(`End of central directory record signature not found`)로 실패했다. 설치 실패의 네트워크 원인은 확정하지 않았다. 우회 다운로드·다른 접근 권한·새 공유 링크는 사용하지 않았다. 따라서 #174 오류 입력·고정/해제·키보드 초점·모바일 통과를 주장하지 않는다.

`verification/local_ui_check.cjs`는 **미실행 준비 스크립트**다. 구문 검사만 통과했으며, 실제 선택자·기대값도 브라우저에서 검증되지 않았다. 예정 크기는 CSS px 1366×900, 390×844, 360×800이다. 오류 입력, 고정/해제 초점, 합성 계산의 null 지표 유지, CSV 스키마/시간/UTF-8/크기/행 제한, skip-link, SECOM 키보드 필터, 연구 화면 및 가로 넘침을 검사하도록 작성했다. 외부 요청은 차단하며 모바일은 실제 단말 대신 Chromium 에뮬레이션이다. 시도 기록은 local_ui/attempt.json이다.

대안: Chromium이 사전 설치된 허용 로컬/CI 환경에서 아래 명령을 실행하고 결과 JSON과 화면을 검토한다. 스크립트·CI 성공만으로 화면 검토를 대신하지 않는다. 현재 환경에서 금지된 경로로 설치하거나 외부 공개 테스트 서버를 만들지 않는다.

```bash
python -m http.server 8764 --bind 127.0.0.1 --directory web
# 별도 터미널, Playwright와 호환 Chromium이 설치된 환경:
node verification/local_ui_check.cjs
```

SPC의 실제 실행 상태는 아래와 같다. 경보 9·0·3건은 방법 우열의 근거가 아니며 EWMA 0건도 이상 탐지 성공을 뜻하지 않는다. 독립 이상 사례 평가가 별도로 필요하다.

## 추가: 실제 로봇 원본 train 멤버 SPC 실행 (2026-10-24)

이 절은 아래 과거 이력의 ‘실측 SPC 미실행’을 갱신한다. 설정·그룹 선택은 그대로 유지했다. 전체 다운로드 대신 공식 HTTP range로 train solid 블록 1,030,328,865 bytes와 7z 헤더를 취득했다. 취득 방식 변경은 신호 디코딩 전에 SOURCE_ACQUISITION_AMENDMENT.md와 로컬 commit b3d37e5로 고정했고, 실행기/가드 테스트는 a8b5d5e까지 고정했다. 아래 결과를 보고 설정을 바꾸거나 다시 실행하지 않았다.

**입력 검증:** 선택한 원시 가속도 Parquet 20개의 멤버명·비압축 크기·CRC32를 확인하고 파일별 SHA-256을 manifest_before_decode.json에 저장한 다음, run_protocol_from_bytes(decoder='parquet')가 같은 바이트를 디코딩했다. 원본/추출 데이터·모델은 Git에 포함하지 않는다. `whole_archive_hash_verified=false`: test 압축 블록을 받지 않은 희소 파일이므로 공식 전체 MD5/SHA-256 일치나 기존 전체 원본 재현을 주장하지 않는다. CRC32는 암호학적 진위 인증이 아니다.

| 구분 | 실제 결과 |
| --- | --- |
| reference | 정상 학습 1기록 그룹·12파일·1,788창, 중심 1.0182701273 g·표본 척도 0.0161708914 g |
| calibration | 정상 학습 1기록 그룹·1파일·149창, 사전 grid 첫 통과 임계값 3 / 3 / 4 |
| evaluation | 정상 개발 2기록 그룹·7파일, 완전/평가 가능 1,043/1,043창·52.15초 |
| Shewhart | raw alarm 9, episode 6 |
| EWMA | raw alarm 0, episode 0 |
| 양측 CUSUM | raw alarm 3, episode 2 |
| 종결 상태 | exploratory_alarm_activity_only; reasons=[] |
| 플래그 | near_boundary_timestamps_present, stability_unverified, reused_development_data |

**판정:** 숫자 신호를 처리하고 사전 계약대로 경보 활동을 계산하는 경로는 이 입력에서 실행됐다. 정상 개발 자료만 사용했으므로 ‘이상을 얼마나 잘 잡는가’는 평가하지 않았다. EWMA 0경보가 우수하다는 뜻도 아니다. 정상 라벨은 안정 정상을 입증하지 않으므로 오탐률·재현율·놓침률·검출 지연은 모두 null을 유지한다. 기록 그룹 2개·서로 겹치지 않는 창은 독립 장비/독립 현장 성능 근거가 아니다. 현재 로봇 모델의 낮은 target 성능과 운영 불승인 판정은 바뀌지 않는다.

실행 코드: verification/run_robot_spc_ranges.py. 원격 게시 전 로컬 실행 이력은 LOCAL_PREEXECUTION_COMMITS.txt, 입력 매니페스트·선택 멤버 체크·취득 영수증·보고서·실행 코드 해시는 robot_spc_results/에 있다. 재현 명령:

```bash
PYTHONPATH=src python verification/run_robot_spc_ranges.py --archive /path/to/train-only.sparse.7z --acquisition /path/to/range_acquisition.json --output-dir /path/to/private/output
```

추가 가드 2개를 포함한 전체 Python 271 tests OK (기존 3 skips), Node 112/112 통과. 기존 코드·모델·웹 시제품·SPC 설정은 변경하지 않았다. main 병합·운영 배포는 하지 않았다.

**이전 화면 차단 이력(아래 승인 전):** #174 별도 임시 접근 링크는 자동 승인 검토에서 거절됐다. 앞서 #173에 부여한 승인이 다른 배포의 링크 보유자 접근 확대까지 포함하지 않는다는 이유다. 모바일 viewport 변경도 현재 브라우저 API에서 지원되지 않는다. 더 안전한 대안은 공개 Git 소스의 정확한 수정 tree를 로컬에서만 띄워 별도 Playwright로 390px/데스크톱·사용자 CSV를 검증하는 것이나, 현재 브라우저 도구 규칙은 그 별도 자동화에 사용자 명시 지시를 요구한다. 이 검증은 아직 수행하지 않았다. 보호 설정을 바꾸거나 새 공개 배포를 만들지 않았다.

## 추가: 승인 후 실제 브라우저 점검 (2026-10-24)

아래 최초 보고의 프리뷰 접근 차단은 사용자가 임시 링크 생성을 명시 승인한 뒤 해소됐다. #173의 같은 고정 head를 1363×936 CSS px 브라우저에서 직접 조작했다. 임시 토큰 URL은 Git·Drive에 저장하지 않는다.

**실제 확인:** 홈→로봇 이동, 로봇 초기 데스크톱 배치, 빈 값 거절, 표본 용량 오류 재현, 합성 파일 4개 로딩, 경보 활동 계산, 성능 지표 null 유지, 해시 불일치 중단, 중복 시각 fixture 중단, 역할 수 충돌 중단, 초기화 후 결과 제거, 키보드 skip-link, SECOM 필터의 방향키·Enter와 표 영역으로 Tab 이동, 연구 근거 화면. 상세 관찰 15건은 BROWSER_CHECKS.json.

#173에서 실제로 최소 표본 오류가 period에 aria-invalid를 붙이고 초점은 lock에 남는 것, 해제 후 disabled unlock에 초점이 남는 것을 재현했다. #174의 수정 필요성을 뒷받침하지만 수정 버전의 실제 화면 통과를 뜻하지 않는다. 이전 수정 head c27c148a의 원격 CI success도 직접 확인했다.

**여전히 미완료:** 모바일 뷰포트 설정 기능이 현재 브라우저 API에 없고, 확대·디바이스 도구 단축키 시도도 실제 innerWidth를 바꾸지 못했다. 따라서 모바일 배치 통과를 주장하지 않는다. #174 프리뷰 별도 접근·수정 후 실제 화면, 임의 사용자 CSV 업로드/크기 제한, 터치·스크린리더도 미검증이다. 아래 ‘화면 차단’ 문구는 최초 점검 당시의 이력으로 읽는다. 실제 로봇 SPC와 탐지 성능 상태는 바뀌지 않았다.

## 최초 점검 판정 (승인 전 이력)

- **코드·계약 검증:** 기존 #173 head `966981b77ecd3a68385a818c4f6b65e6ec2abe48`에서 Python 269 tests OK (6 skips), Node 110/110 통과를 직접 재실행했다. 선택 robot 의존성 설치 후 robot 필수 엔진 테스트 72/72 통과. 후속 수정본 전체 Python 269 tests OK (3 기존 skips), Node 112/112 통과. 세부 실행 환경은 environment.json.
- **화면·모바일·실제 키보드 조작:** 미완료. 정확한 #173 프리뷰가 Vercel 로그인으로 이동하는 것을 브라우저에서 관찰했다. 공유 링크 생성은 자동 승인 검토에서 거절됐다(누구나 접근 가능한 URL을 만들 수 있어 권한 확대에 해당). 링크 생성·보호 설정 변경·대체 공개 배포로 우회하지 않았다. HTTP 200/CI/DOM 모형 테스트를 실제 화면 점검으로 계산하지 않았다.
- **실제 이상 탐지 성능:** 미판정. 원시 가속도 Parquet가 현재 환경과 확인한 기존 Drive 원본/평가 폴더에 없었다. 공식 3,545,453,763-byte RoboticArm.7z 다운로드를 시도했지만 30초 동안 1MB/s 미만으로 종료(curl 28). 약 19MB 부분 파일은 원본 검증·추출·RMS·SPC 계산에 쓰지 않았다.
- **운영 승인:** 없음. main 병합·운영 배포·기존 PR 종료·최종 모델 교체를 하지 않았다. 이 변경은 #173을 base로 하는 별도 수정 PR이다.

## 발견·수정한 코드 문제

계약 입력 실패 시 기존 코드는 period에만 aria-invalid를 설정했다. 최소 표본 오류도 period를 잘못 표시했고, tolerance/gap 오류는 해당 입력에 표시하지 않았다. submit 후 오류 필드로 초점을 보내지 않았고, 성공 후에는 초점이 있던 submit 자체가 disabled가 됐다.

- 실제 오류 사유를 해당 입력에 연결하고 aria-describedby로 기존 안내와 오류 상태를 함께 연결했다.
- 첫 오류 입력으로 초점을 보내고, 정상 재입력 시 이전 오류 속성만 지운다(기존 period-help 보존).
- 계약 고정 뒤 활성화된 고정 해제 버튼으로, 고정 해제 뒤 period로 초점을 보낸다.
- 두 회귀 테스트는 최소 표본 오류가 period에 잘못 붙는 사례와 여러 오류·기존 안내 보존을 검사한다. DOM 제어 모형 테스트이며 브라우저/스크린리더 실제 조작 확인은 아니다.

## #169 / #170 / #173 수치 구분

| 항목 | #169 | #170 | #173 |
| --- | --- | --- | --- |
| 입력 범위 | 공식 학습 1,175건 내부 | 공식 학습 1,175건만 파싱 | #170의 고정 산출물을 화면용 데이터로 옮김 |
| 시간 분할 | 고유 timestamp 초기 약 55% + 4 expanding folds | 고유 날짜 4블록 → 3 expanding folds | 새 모델 평가 없음 |
| 검증 건수 / 불량 | 중복 없는 525건 / 14건 | 구간 합계 불량 61건 | #170과 동일 |
| 점검 예산 | 각 fold ceil(10%), 합계 55건 | 각 fold ceil(10%), 합계 105건 | #170과 동일 |
| RF 기준 설정 | depth=None, leaf=8 | depth=8 (다른 고정 설정) | #170 표시 |
| L1 C | .01 | .1 | #170 표시 |
| 평균 AP (RF / boosting) | .060064 / .203387 | .088042 / .155006 (current) | #170 표시 |
| 포착 (RF / boosting) | 2/14 / 4/14 | 9/61 / 10/61 (current) | #170 표시 |
| 행 결측 개수 추가 | RF 2→3/14 | RF 9→7/61, boosting 10→10/61 | #170의 개선 미입증을 표시 |

서로 다른 표본·분할·모델 설정의 탐색 실험이다. 수치를 합산하거나 #169 AP .203을 기존 Test AP .0935와 비교해 성능 향상률로 표현하지 않는다. #173은 #169 코드를 포함한 통합 모델이 아니며 #170/#171/#168/#172의 연구 요약과 별도 SPC 시제품을 추가한다.

## 열린 PR 포함·중복·의존 관계

17개 열린 PR의 고정 head와 changed-file SHA를 pr_snapshot.json에 저장했다. main `cd7bf490a1d7ad3e53c77ea198e323b9d95c7ff3` 전체 tree와 최종 파일 blob을 대조한 것은 main_blob_comparison.json이다. 이는 파일 동일성/경로 충돌 검사이며 모든 PR 코드의 의미적 안전성을 승인하는 감사는 아니다.

| PR | 관계·누락 방지 판단 | 제안 순서 |
| --- | --- | --- |
| #159 | 유일한 변경 tests/test_results_contract.py의 blob이 이미 main과 동일 | 기록 확인만; 종료하지 않음 |
| #156 / #160 | 6개 changed-file 경로와 최종 SHA가 모두 같다. 그중 테스트 1개만 main 동일, replay 코드 등 5개는 미반영 | 하나를 정본으로 재기반·검토. 둘 다 병합하지 않음. 아직 종료 안 함 |
| #161 | DKASC 출처 재확인 1문서. 다른 연구와 독립 | 문서 검토 후 독립 병합 후보 |
| #154 | Steel 독립 감사 코드·문서·pyproject 변경 | 별도 범위 검토. docs/README·pyproject 변경 보존 필요 |
| #164 | 판단 보류 설계 문서. #168 구현 파일과 다름 | #168 전에 설계 기록 검토 |
| #165 → #167 | #167은 #165 head 기반 문서 갱신. 국제 검증·잠금평가 계약 포함 | #165 후 #167, 공통 문서 최신 내용 보존 |
| #168 | 42특징 판단 보류 API 구현. #173에 포함되지 않음 | 독립 검토·합성 계약 확인 후 병합 후보 |
| #169 | 이 대화의 4fold 결측 실험. #170과 연구 주제만 유사; 파일/평가 계약 다름 | 별도 연구 기록으로 보존. 합산 금지 |
| #170 | 3 날짜fold·13후보 비교. #173은 결과 스냅샷만 포함하고 Python 실행기/연구 원문은 포함하지 않음 | 연구 기록을 #173보다 먼저 검토 권장 |
| #171 | 원본 재현 수치 비교 감사·verifier. #173은 설명만 포함 | #173보다 먼저 감사 기록 검토 권장 |
| #172 | 독립 합성 SPC 실험. #173에 실제 study.py/results.json은 포함 안 됨 | #173보다 먼저 합성 연구 기록 검토 권장 |
| #173 | 연구 결과 화면·별도 로봇 SPC 엔진·CI. #168 API와 각 연구 실행기를 전부 포함한 PR 아님 | 근거 PR 검토 후 화면/접근성 점검과 이 수정본 반영 |
| #137 / #140 / #142 | 시간순 SECOM 음성결과 / KAMP / SCATIM의 서로 다른 연구 기록 | 별도 순서; 모델 승격과 분리 |

여러 PR이 docs/README.md·README.md·장비 UI를 동시에 바꾼다. 하나씩 적용한 후보 tree에서 CI와 링크/서술을 다시 검사해야 하며, 한 PR의 전체 파일 사본으로 나중 문서 내용을 덮어쓰지 않는다. #156/#160과 #173은 equipment 관련 경로도 겹치므로 독립 green CI만으로 결합 호환을 승인하지 않는다.

**제안 순서:** 문서/감사 기록(#161, #164, #165→#167) → 독립 연구 기록(#169, #170, #171, #172; #137/#140/#142 별도) → API #168 → replay #156 또는 동일 #160의 한 정본 → #173 + 이번 수정. #154는 별도 검토 후 공통 목차·의존성 충돌을 조정한다. 각 단계는 dot 검토와 사용자 승인 뒤 수행할 제안일 뿐, 실제 병합하지 않았다.

## 실제 로봇 SPC 사전 고정과 부족한 입력

robot_config.json은 숫자 신호·경보를 보기 전에 고정했다. 모듈 validate_config를 통과했고 config SHA-256은 `55794547c6d4355a6f407a049bf973abd4e0a34d01a0c1e208477f4d34aef1ce`이다.

- metadata SHA-256이 기존 정본 `6d810ca6...aa9d9`와 일치하는 특징 CSV에서 메타데이터 5열만 사용했다. 특징값·기존 예측 점수는 그룹 선택에 쓰지 않았다.
- normal_source_train / weight15 / BckgA의 그룹을 사전식 정렬해 첫 4개 선택. 각 그룹에 속하는 해당 train 세그먼트를 모두 선택했다. reference 12파일(1그룹), calibration 1파일(1그룹), evaluation 7파일(2그룹)이다. 그룹/구간 ID는 robot_plan.json.
- 50ms·vector RMS·DC 제거 없음, 공개 공칭 6.7kHz의 역수로 nominal period 고정, cadence 허용 5%, gap 3배, 창당 최소 300표본, reference 최소 10창. 실제 시간열이 이를 만족하지 않으면 실패를 기록하고 같은 평가 자료를 보며 수치를 고치지 않는다.
- λ=.2, k=.5, 경보 후 리셋 없음. Shewhart/EWMA grid [3,4,5], CUSUM [4,6,8], calibration raw alarm 상한 5%. calibration 첫 통과 threshold만 사용하고 실패 시 grid 확장 없음.
- 이 자료는 기존 개발에 쓰인 정상 그룹이므로 reused_development_data, 결과 최고 상태는 exploratory_alarm_activity_only. 안정 정상 미확립·onset/종료 라벨 부재로 오탐률/재현율/미탐률/지연은 null이다. 이상을 잘 잡는지 판정할 실험이 아니다.

**다음 실행에 필요한 것:** 완전한 공식 원본 7z(공식 MD5·저장 SHA 검증)와 선택된 원시 가속도 Parquet 20개, 매핑 참조·크기·CRC/멤버 검증. RMS 계산 전 파일별 SHA 매니페스트를 생성·고정하고 run_protocol_from_bytes(..., decoder='parquet')로 동일 바이트를 디코딩한다. 파일 해시 미확보 상태를 실제 실행용 manifest라고 부르지 않는다. pyarrow 26.0.0·py7zr 1.1.4는 이번에 설치했고 필수 엔진 테스트 통과했으므로 현재 막힌 것은 라이브러리가 아닌 원본 바이트다.

운영 성능 판정에는 추가로 미노출 세션, 동작/속도/하중/배경·정비 기록, 안정 정상 근거, 이상 onset/종료 독립 라벨과 사전 승인 운영 지표가 필요하다. 현재 수집 자료나 합성 결과로 이를 대신하지 않는다.

## 재현 명령과 완료 범위

저장소 루트:

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
node --test tests/web/*.test.mjs
FABGUARD_REQUIRE_ROBOT_EXTRA=1 PYTHONPATH=src python -m unittest tests.test_robot_window_spc tests.test_robot_benchmark -v
python verification/recompute_v1.py
python verification/source_clarifications.py
python scripts/build_web_evidence.py --check
node --check web/robot/app.mjs
node --check web/robot/contract-feedback.mjs
git diff --check
```

직접 확인: 테스트·산술/출처 재계산·웹 근거 동기화·선택 의존성·PR 파일 SHA 관계·메타데이터 해시·설정 스키마. 미확인: #173 실제 화면/모바일/키보드 조작/사용자 오류파일 UI/최종 탐색 경로, 실측 SPC 실행, 탐지 성능, 현장 KPI. 변경 후 프리뷰가 생겨도 HTTP나 CI 통과만으로 이 미확인 목록을 완료로 바꾸지 않는다.
