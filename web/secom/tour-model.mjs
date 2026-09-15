// Educational event sequence inspired by a user's fab-tour observations.
// No equipment connection, process recipe, prediction or automatic control.
export const LESSON_CASES = Object.freeze({
  solution: Object.freeze({
    active: '용액 부족 · 가상 알람 지속', recovered: '가상 알람 조건 해소',
    beginEvent: '가상 용액 부족 알람 발생',
    recoverEvent: '가상 알람 조건 해소 · 실제 정비나 운전 재개 아님',
    recoverLabel: '조건 해소를 가정하기', equipment: 'not_assessed'
  }),
  maintenance: Object.freeze({
    active: '정비 시기 지남 · 가상 알림 지속', recovered: '가상 정비 완료로 가정',
    beginEvent: '준비 상태(READY)와 정비 시기 초과 알림이 함께 있는 가상 사례',
    recoverEvent: '가상 정비 완료로 가정 · 실제 정비나 운전 재개 아님',
    recoverLabel: '정비 완료를 가정하기', equipment: 'ready'
  })
});
export class AlarmLesson {
  constructor() { this.reset(); }
  reset() { this.caseId = null; this.condition = 'waiting'; this.acknowledged = false; this.events = []; }
  record(message) { this.events.push({step: this.events.length + 1, message}); }
  begin(caseId = 'solution') {
    if (!Object.hasOwn(LESSON_CASES, caseId)) return;
    this.reset();
    this.caseId = caseId;
    this.condition = 'active';
    this.record(LESSON_CASES[caseId].beginEvent);
  }
  acknowledge() {
    if (this.condition === 'waiting' || this.acknowledged) return;
    this.acknowledged = true;
    this.record('사용자가 알람을 확인함 · 문제 해결과 별개');
  }
  recover() {
    if (this.condition !== 'active') return;
    this.condition = 'recovered';
    this.record(LESSON_CASES[this.caseId].recoverEvent);
  }
  snapshot() {
    return {caseId: this.caseId, condition: this.condition, acknowledged: this.acknowledged,
      equipment: LESSON_CASES[this.caseId]?.equipment ?? 'not_assessed',
      events: this.events.map(event => ({...event})), quality: 'not_assessed'};
  }
}
