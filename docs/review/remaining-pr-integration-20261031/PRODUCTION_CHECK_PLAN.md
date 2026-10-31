# Production 검사 공백 보완

기준: #195 675302c317ffb08ececf21758cf5efe53e83798a / main 74827d1b89f71fb5a4133d910add59043ac3daf1.

기존 CI 5종 성공은 loopback 등 해당 검사 범위의 결과이며 IMAD production 검증이 아니다. dot의 읽기 전용 대조 역시 전체 릴리스 승인이 아니다.

- 기존 main push release-browser 워크플로의 자산 목록에 robot 보고서 모듈 2개·JSON·app·style 5경로 추가(총 42경로). 배포 파일 바이트가 checkout SHA와 일치해야 브라우저 검사를 진행한다.
- 기존 production matrix에 offline-report를 추가하여 PC 1366·390·360에서 저장 보고서 표/다운로드/해시, null, 키보드와 넘침을 검사한다.
- production 모드는 정상 제공 화면의 읽기 전용 검사만 수행한다. 404·손상 응답 주입 검사는 기존 loopback에서 유지한다. 결과 JSON에 URL·모드·checkout SHA를 기록한다.
- main push의 배포 대기/바이트 대조를 재사용한다. PR CI 통과를 배포 성공으로 쓰지 않는다. 실제 배포 후 main SHA·자산 해시·브라우저 결과를 별도로 확인해야 완료다.

현재: Draft 보완이며 병합·운영 배포·실제 production 실행은 하지 않음. 실제 휴대전화·스크린리더·탐지 성능 미검증. 모델·데이터·임계값·결과는 변경하지 않음.
