// Educational event sequence inspired by a user's fab-tour observations.
// No equipment connection, process recipe, prediction or automatic control.
export class AlarmLesson {
  constructor() { this.reset(); }
  reset() { this.condition = 'waiting'; this.acknowledged = false; this.events = []; }
  record(message) { this.events.push({step: this.events.length + 1, message}); }
  begin() {
    this.reset();
    this.condition = 'active';
    this.record('가상 용액 부족 알람 발생');
  }
  acknowledge() {
    if (this.condition === 'waiting' || this.acknowledged) return;
    this.acknowledged = true;
    this.record('사용자가 알람을 확인함 · 문제 해결과 별개');
  }
  recover() {
    if (this.condition !== 'active') return;
    this.condition = 'recovered';
    this.record('가상 알람 조건 해소 · 실제 정비나 운전 재개 아님');
  }
  snapshot() {
    return {condition: this.condition, acknowledged: this.acknowledged,
      events: this.events.map(event => ({...event})), quality: 'not_assessed'};
  }
}
