/* Run before styles: saved themes must be selected before the first paint.
   Theme changes only touch presentation, never routing, language or lab state. */
(() => {
  const root = document.documentElement;
  let theme = 'silver';
  try {
    if (localStorage.getItem('fabguard-theme') === 'dark') theme = 'dark';
  } catch { /* Private/blocked storage still permits an in-page choice. */ }
  root.dataset.theme = theme;

  const bind = () => {
    const button = document.querySelector('#theme-toggle');
    if (!button) return;
    const render = () => {
      const english = root.lang === 'en';
      const dark = root.dataset.theme === 'dark';
      button.textContent = english ? 'Silver / Dark' : '실버 / 다크';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', english ? 'Silver / Dark theme (dark on when pressed)' : '실버 / 다크 테마 (눌림 상태는 다크)');
      button.title = english ? (dark ? 'Switch to silver theme' : 'Switch to dark theme') : (dark ? '실버 테마로 전환' : '다크 테마로 전환');
      const color = document.querySelector('meta[name="theme-color"]');
      if (color) color.setAttribute('content', dark ? '#070b0f' : '#aab6c5');
    };
    button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'silver' : 'dark';
      try { localStorage.setItem('fabguard-theme', root.dataset.theme); } catch { /* Keep the current choice usable. */ }
      render();
    });
    // A history-restored document may predate a choice made on another page.
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      try { root.dataset.theme = localStorage.getItem('fabguard-theme') === 'dark' ? 'dark' : 'silver'; }
      catch { /* Do not discard a usable in-page choice when storage is blocked. */ }
      render();
    });
    new MutationObserver(render).observe(root, {attributes: true, attributeFilter: ['lang']});
    render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once: true});
  else bind();
})();
