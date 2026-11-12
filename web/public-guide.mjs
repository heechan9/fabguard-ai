// Public presentation only. No private research, new metrics or model execution.
const COPY = {
  ko: {
    title: '쉬운 설명 보기 · 지금 웹에서 할 수 있는 일',
    subtitle: '저장된 결과 · 파일 점검 · 실제 기록 · 합성 체험을 구분해요',
    intro: 'FabGuard는 생산 기록을 보고 무엇을 먼저 확인할지 돕는 연구용 프로젝트입니다. 아래 기능은 서로 다른 자료와 목적을 사용합니다.',
    items: [
      ['저장된 분석 결과', '무엇부터 살펴볼까요?', 'SECOM 기록을 이미 계산된 점수 순으로 봅니다. 점검 범위를 바꾸고 근거·메모를 확인할 수 있습니다. 새 파일을 예측하거나 공장에 연결하는 화면은 아닙니다.', [['/#risks', '우선점검 목록'], ['/review/', '검토 메모']]],
      ['브라우저 안에서 파일 점검', '측정값과 변경 이력을 확인해요', '장비 CSV의 형식과 참고 관리선을 확인합니다. 정비 이력 화면에서는 변경 뒤 기존 기준을 계속 적용해도 될지 검토하고 보류 이유를 남깁니다. 정비 전후 모델 성능을 평가하는 기능은 아닙니다.', [['/equipment/', '장비 CSV 점검'], ['/equipment/context-review.html', '정비 이력·기준선 검토']]],
      ['실제로 측정된 과거 기록', '로봇 센서는 어떻게 변했을까요?', 'UR3 공개 센서 기록을 시간순으로 탐색·재생합니다. 저장된 기록을 읽는 기능이며 실시간 연결, 고장 예측이나 로봇 제어는 하지 않습니다.', [['/robot/ur3/', 'UR3 센서 기록']]],
      ['설명용 합성 장면', '가상 공정에서 흐름을 익혀요', 'SMT에서는 기판 이동·검사·보류와 온도 가정·가상 정지를, OHT에서는 천장 이송을 살펴봅니다. 실제 설비의 물리 해석·제어·안전 인증이나 SECOM 예측 결과가 아닙니다.', [['/smt/', 'SMT 3D 체험'], ['/oht/', 'OHT 천장 이송']]],
      ['선택형 학습', '근거를 읽는 연습도 할 수 있어요', '이 페이지 아래의 ‘선택형 학습’에서 합성 사례 3개로 데이터 품질과 판단 근거를 연습합니다. 실제 안전 판정이나 학습자의 능력 평가가 아닙니다.', []],
    ],
    boundary: '코드 검사가 통과했거나 저장 결과를 다시 계산해 일치해도, 실제 공장의 예측력·정비 효과가 입증된 것은 아닙니다. 별도 연구·검토용 코드가 이 웹에 자동으로 연결되는 것도 아닙니다.',
    source: '공개 근거와 평가 상태',
    date: '공개 화면 안내 · 2026-11-12 내용 점검. 새 실험 결과나 현장 배포 완료를 뜻하지 않습니다.',
  },
  en: {
    title: 'Easy guide · what you can do on this site',
    subtitle: 'Saved results · file checks · real recordings · synthetic demonstrations',
    intro: 'FabGuard is a research project that helps people decide which production records to inspect first. These features use different data and serve different purposes.',
    items: [
      ['Saved analysis', 'What should we inspect first?', 'Browse SECOM records in their saved score order. Change the review budget and inspect evidence or notes. This does not predict a new file or connect to a factory.', [['/#risks', 'Review queue'], ['/review/', 'Review notes']]],
      ['In-browser file checks', 'Inspect measurements and change history', 'Check equipment CSV structure and reference control limits. The maintenance screen helps review whether an existing baseline remains applicable and records reasons to hold. It does not evaluate model performance before and after maintenance.', [['/equipment/', 'Equipment CSV checks'], ['/equipment/context-review.html', 'Maintenance and baseline review']]],
      ['Real historical recordings', 'How did robot sensor values change?', 'Explore and replay public UR3 sensor recordings over time. This reads saved records, without a live connection, fault prediction or robot control.', [['/robot/ur3/', 'UR3 sensor recordings']]],
      ['Synthetic demonstrations', 'Learn the flow in a virtual process', 'Explore PCB movement, inspection, holds, temperature assumptions and a simulated stop in SMT, or overhead transport in OHT. These are not physical equipment simulations, control, safety certification or SECOM predictions.', [['/smt/', 'SMT 3D lab'], ['/oht/', 'OHT overhead transport']]],
      ['Optional learning', 'Practise reading evidence', 'Use Optional learning below to explore data quality and reasoning in three synthetic cases. It does not make real safety decisions or assess your ability.', []],
    ],
    boundary: 'Passing code checks or reproducing saved calculations does not establish factory prediction quality or maintenance impact. Separate research and review tools are not automatically connected to this website.',
    source: 'Public evidence and evaluation status',
    date: 'Public-site guide · content checked on 2026-11-12. This is not a new experiment result or proof of field deployment.',
  },
};

export function renderPublicGuide(language = 'ko') {
  const copy = COPY[language === 'en' ? 'en' : 'ko'];
  return `<details class="public-guide" id="public-guide">
    <summary><span>${copy.title}</span><small>${copy.subtitle}</small></summary>
    <div class="public-guide-body portfolio-story"><p>${copy.intro}</p>
      <div class="portfolio-cards">${copy.items.map(([kind, title, description, links]) => `<article><span class="portfolio-tag">${kind}</span><h2>${title}</h2><p>${description}</p>${links.map(([href, label]) => `<a href="${href}">${label} →</a>`).join('')}</article>`).join('')}</div>
      <p class="notice">${copy.boundary}</p>
      <p><a href="/research/">${copy.source} →</a></p><p class="portfolio-credit">${copy.date}</p>
    </div>
  </details>`;
}
