import {AlarmLesson, LESSON_CASES} from './tour-model.mjs';
const root = document.querySelector('#fab-tour');
const lesson = new AlarmLesson();
function render() {
  const state = lesson.snapshot();
  const preset = LESSON_CASES[state.caseId];
  root.querySelector('[data-condition]').textContent = preset?.[state.condition] ?? '사례 선택 전';
  root.querySelector('[data-equipment]').textContent = state.equipment === 'ready' ? '준비 상태 (READY) · 가상 표시' : '이 사례에서 확인하지 않음';
  root.querySelector('[data-action="recover"]').textContent = preset?.recoverLabel ?? '조건 해소를 가정하기';
  root.querySelectorAll('[data-case]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.case === state.caseId)));
  root.querySelector('[data-ack]').textContent = state.condition === 'waiting' ? '—' : state.acknowledged ? '확인함' : '아직 확인하지 않음';
  root.querySelector('[data-condition]').dataset.state = state.condition;
  root.querySelector('[data-action="acknowledge"]').disabled = state.condition === 'waiting' || state.acknowledged;
  root.querySelector('[data-action="recover"]').disabled = state.condition !== 'active';
  const list = root.querySelector('[data-events]');
  list.replaceChildren();
  for (const event of state.events) {
    const li = document.createElement('li');
    li.textContent = event.message;
    list.append(li);
  }
  root.querySelector('[data-empty]').hidden = state.events.length > 0;
}
root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (action === 'begin') lesson.begin(button.dataset.case);
  if (action === 'acknowledge') lesson.acknowledge();
  if (action === 'recover') lesson.recover();
  if (action === 'reset') lesson.reset();
  render();
}));
render();
