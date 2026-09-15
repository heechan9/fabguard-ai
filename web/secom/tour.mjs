import {AlarmLesson} from './tour-model.mjs';
const root = document.querySelector('#fab-tour');
const lesson = new AlarmLesson();
const states = {waiting:'사례 선택 전', active:'용액 부족 · 가상 알람 지속', recovered:'가상 알람 조건 해소'};
function render() {
  const state = lesson.snapshot();
  root.querySelector('[data-condition]').textContent = states[state.condition];
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
  if (action === 'begin') lesson.begin();
  if (action === 'acknowledge') lesson.acknowledge();
  if (action === 'recover') lesson.recover();
  if (action === 'reset') lesson.reset();
  render();
}));
render();
