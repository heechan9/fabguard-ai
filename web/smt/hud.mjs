import {HUD_STATION, HUD_COPY, spiHudRecord, hudAnchorVisible} from './hud-model.mjs';

export function mountSpiHud({viewport, panel, selectStation}) {
  const controls = document.createElement('div');
  controls.className = 'hud-controls';
  controls.innerHTML = '<button type="button" id="hud-focus"></button><button type="button" id="hud-toggle" aria-pressed="true" aria-controls="spi-hud"></button><button type="button" id="hud-language">EN</button><span id="hud-hint"></span>';
  viewport.parentElement.after(controls);
  panel.innerHTML = '<div class="hud-topline"><span>FG / PROCESS 03</span><b data-hud="badge"></b></div><h2><span data-hud="title"></span><small>3D SPI</small></h2><p class="hud-board"><span data-hud="board-label"></span><strong data-hud="board"></strong></p><p class="hud-state" data-hud="state"></p><div class="hud-reading"><div><span data-hud="unit"></span><strong data-hud="value"></strong></div><span class="hud-range" data-hud="range"></span></div><p class="hud-phase" data-hud="phase"></p><p class="hud-scope" data-hud="scope"></p>';
  panel.setAttribute('aria-label', '03 SPI HUD');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('hud-overlay');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<g class="hud-target"><circle class="hud-ring" r="37"/><path class="hud-arcs" d="M -43 -16 A 46 46 0 0 1 16 -43 M 43 16 A 46 46 0 0 1 -16 43"/><path class="hud-ticks" d="M 0 -52 v 8 M 52 0 h -8 M 0 52 v -8 M -52 0 h 8"/><circle class="hud-center" r="2"/></g><path class="hud-leader"/><circle class="hud-end" r="3"/>';
  viewport.append(svg);
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-hud]')].map(el => [el.dataset.hud, el]));
  const focus = controls.querySelector('#hud-focus'), toggle = controls.querySelector('#hud-toggle');
  const language = controls.querySelector('#hud-language'), hint = controls.querySelector('#hud-hint');
  let enabled = true, lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
  let state = {board: null, station: HUD_STATION, suppressed: false, available: false};
  let visible = false, previousText = '', side = 'right';
  const render = () => {
    const copy = HUD_COPY[lang], record = spiHudRecord(state.board);
    visible = enabled && state.station === HUD_STATION && !state.suppressed && state.available;
    panel.hidden = !visible;
    svg.style.display = visible ? '' : 'none';
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = copy.toggle;
    focus.textContent = copy.focus;
    language.textContent = lang === 'ko' ? 'EN' : '한국어';
    language.setAttribute('aria-label', copy.language);
    panel.lang = lang;
    controls.lang = lang;
    hint.textContent = enabled && state.station !== HUD_STATION ? copy.hidden : '';
    panel.dataset.state = record.state;
    svg.dataset.state = record.state;
    const text = {badge: copy.badge, title: copy.title, 'board-label': copy.board,
      board: record.boardId ? `SIM · ${record.boardId}` : '—', unit: copy.unit, range: copy.range,
      state: copy.states[record.state], phase: copy.phases[record.phase], scope: copy.scope,
      value: record.value === null ? '—' : `${record.value}%`};
    const key = JSON.stringify(text);
    if (key !== previousText) {
      for (const [name, value] of Object.entries(text)) fields[name].textContent = value;
      previousText = key;
    }
  };
  focus.addEventListener('click', () => {enabled = true; selectStation(HUD_STATION); render();});
  toggle.addEventListener('click', () => {enabled = !enabled; render();});
  language.addEventListener('click', () => {lang = lang === 'ko' ? 'en' : 'ko'; render();});
  new MutationObserver(() => {lang = document.documentElement.lang === 'en' ? 'en' : 'ko'; render();})
    .observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  render();
  return {
    update(next) {state = {...state, ...next}; render();},
    project(point) {
      if (!visible) return;
      const width = viewport.clientWidth, height = viewport.clientHeight;
      const onScreen = hudAnchorVisible(point, width, height);
      svg.style.display = onScreen ? '' : 'none';
      panel.dataset.anchor = onScreen ? 'visible' : 'offscreen';
      hint.textContent = onScreen ? '' : HUD_COPY[lang].offscreen;
      if (!onScreen) return;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.querySelector('.hud-target').setAttribute('transform', `translate(${point.x} ${point.y})`);
      const docked = width < 760;
      if (point.x < width / 2 - 32) side = 'right';
      else if (point.x > width / 2 + 32) side = 'left';
      panel.dataset.side = side;
      // Resolve the new side before measuring its edge. The 64px dead band prevents flicker.
      const vr = viewport.getBoundingClientRect(), pr = panel.getBoundingClientRect();
      const end = docked ? {x: point.x, y: height - 12} : {
        x: side === 'right' ? pr.left - vr.left - 6 : pr.right - vr.left + 6,
        y: pr.top - vr.top + 36,
      };
      // Hide the leader rather than drawing through text when the camera is very close.
      const separated = !docked && Math.abs(end.x - point.x) > 65;
      svg.querySelector('.hud-leader').style.display = separated ? '' : 'none';
      svg.querySelector('.hud-end').style.display = separated ? '' : 'none';
      const startX = docked ? point.x : point.x + Math.sign(end.x - point.x) * 52;
      const startY = docked ? point.y + 52 : point.y;
      svg.querySelector('.hud-leader').setAttribute('d', `M ${startX} ${startY} L ${docked ? end.x : (startX + end.x) / 2} ${end.y} L ${end.x} ${end.y}`);
      svg.querySelector('.hud-end').setAttribute('cx', end.x);
      svg.querySelector('.hud-end').setAttribute('cy', end.y);
    },
  };
}
