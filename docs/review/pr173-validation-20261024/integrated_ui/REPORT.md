# #174를 #173에 병합한 통합본 재검증

- 검토 head: 470d97c6a5c2853a3d47b3bc9100bf0a9f4ddacf. 병합 직전 동일 head와 해당 CI success를 확인했다.
- #174 → #173 merge commit: 153e2f5b0d71c182a61ae95c10bf40ef8ac69179. merge tree는 검토 head와 동일하다.
- 재검증 commit: dca72e58959c5414f354ed8f1d18d92b871c0f48. 보고서 과거 이력 안내 및 기존 browser workflow의 #173 branch 대상만 추가했다. 검토 head 대비 web 전체·verification/local_ui_check.cjs diff 0.
- CI: https://github.com/heechan9/fabguard-ai/actions/runs/40082489521 (test 및 robot-extra success)
- Browser: https://github.com/heechan9/fabguard-ai/actions/runs/40082488304 (success)
- 기존 설치 Chrome 155.0.8059.39 / Playwright 1.62.1 / Noto CJK. 127.0.0.1 서버만 사용, 외부 페이지 요청 차단. Chromium 설치 반복·공개 공유 링크·접근 확대 없음.
- CSS px 1366×900, 390×844, 360×800 각 19개, 총 57/57 통과. pageerror 0. 오류 입력·고정/해제·초점·CSV 거부·모바일 그리드·합성 계산·null 지표·skip-link·SECOM 필터·연구 화면 검사를 모두 재실행했다. 결과 원문은 results.json.
- 직접 시각 재검토한 4개: 1366-contract-error.png, 390-contract-error.png, 360-contract-error.png, 390-synthetic-results.png. 오류 필드 초점 표시, 카드 내부 배치, 합성 결과·안정성 미확인 안내를 확인했다. 화면 밖 전부를 보았다고 주장하지 않는다.
- 15 screenshots + results.json + server log ZIP: https://drive.google.com/file/d/1s6cviCStCrGK_k1JWn3npLJH7CmcpJne/view (기존 폴더, 권한 변경 없음).
- ZIP SHA-256: 0a800dcdc5a2348ab221d33716187dc5c2008f847d0d69b498fb309663876162. 다운로드 바이트와 Actions artifact digest 일치. 개별 파일 SHA-256은 file_hashes.json.

연구용 시제품의 위 동작·화면 범위만 통과다. 실제 iOS/Android 단말·스크린리더·배포 서버 접근/인증·실제 이상 탐지 성능은 미검증이다. SPC 원본 실행과 화면 검사 및 탐지 성능은 서로 다른 판정이다. 경보 9·0·3으로 방법 우열을 주장하지 않는다.

main은 cd7bf490a1d7ad3e53c77ea198e323b9d95c7ff3 그대로다. #173은 열린 Draft로 유지한다. main 병합·운영 배포는 하지 않았고 별도 승인 전 수행하지 않는다. 이 기록 이후 추가하는 것은 결과 문서뿐이며, 재검증 이후 웹·검사·모델·평가 계약을 변경하지 않는다.
