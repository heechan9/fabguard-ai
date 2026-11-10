import { installProgressiveDisclosure } from './progressive-disclosure.mjs';
/* Shared presentation only. Dataset loading, lab playback and page language
   controls stay owned by their existing modules. The research snapshot remains
   deliberately script-free and uses the same static navigation markup. */
const labels = {
  overview: ['운영 개요', 'Overview'],
  risks: ['우선점검', 'Review queue'],
  secom: ['반도체 분석', 'Analysis'],
  limitations: ['검증과 한계', 'Validation & limits'],
  summary: ['프로젝트 소개', 'Project'],
  global: ['국가별 자료', 'Global data'],
  smt: ['3D 모델링', '3D models'],
  equipment: ['장비 CSV 점검', 'Equipment CSV check'],
  ur3: ['UR3 센서 기록', 'UR3 sensor records'],
  research: ['연구 근거·적용 상태', 'Research evidence'],
  oht: ['OHT 천장 이송 체험', 'OHT transport concept'],
  robot: ['로봇 진동·SPC 실험', 'Robot vibration / SPC'],
  context: ['정비 이력·기준선 검토', 'Maintenance context review'],
  preprocessing: ['학습 구간 비교 기록', 'Training-window comparisons'],
  references: ['3D 참고자료·재현 범위', '3D sources & limits'],
  review: ['SECOM 검토 메모', 'SECOM review notes'],
};
const pages = {
  '/secom': 'secom', '/smt': 'smt', '/equipment': 'equipment',
  '/robot/ur3': 'ur3', '/research': 'research', '/oht': 'oht',
  '/robot': 'robot', '/equipment/context-review.html': 'context',
  '/secom/research.html': 'preprocessing', '/smt/references.html': 'references',
  '/review': 'review',
};
const bilingualPages = new Set(['/', '/oht', '/review']);

export function normalizePagePath(pathname) {
  return pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
}

export function navigationKey(href, base = 'https://fabguard.invalid/') {
  const url = new URL(href, base);
  const path = normalizePagePath(url.pathname);
  if (path !== '/') return pages[path] || null;
  const route = url.hash.slice(1) || 'summary';
  if (route.startsWith('detail/')) return 'risks';
  if (['result', 'process', 'answer-overview'].includes(route)) return 'summary';
  return labels[route] ? route : 'summary';
}

export function navigationHref(href, language, base = 'https://fabguard.invalid/') {
  // Same-document routes retain the existing app router and its query string.
  if (href.startsWith('#')) return href;
  const url = new URL(href, base);
  if (url.origin !== new URL(base).origin) return href;
  if (language === 'en' && bilingualPages.has(normalizePagePath(url.pathname))) {
    url.searchParams.set('lang', 'en');
  } else {
    url.searchParams.delete('lang');
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function bindSiteShell(doc = document, win = window) {
  const header = doc.querySelector('.topbar[data-site-nav-owner]');
  const nav = header?.querySelector('.cc-navigation');
  if (!nav || header.dataset.siteNavOwner === 'static' || header.dataset.siteShellBound) return;
  header.dataset.siteShellBound = 'true';
  const root = doc.documentElement;
  const appOwnsNavigation = header.dataset.siteNavOwner === 'app';
  const links = [...nav.querySelectorAll('a[href]')];
  const originalHrefs = new Map(links.map(link => [link, link.getAttribute('href')]));
  const brand = header.querySelector('.brand');
  const brandHref = brand?.getAttribute('href');
  const more = nav.querySelector('.cc-more');
  const trigger = more?.querySelector('summary');

  const render = () => {
    const english = root.lang === 'en';
    const current = navigationKey(win.location.href);
    nav.setAttribute('aria-label', english ? 'Main navigation' : '주요 화면');
    if (trigger) trigger.textContent = english ? 'More screens' : '다른 화면';
    if (brand) {
      brand.setAttribute('aria-label', english ? 'FabGuard AI home' : 'FabGuard AI 홈');
      brand.setAttribute('href', navigationHref(brandHref, root.lang, win.location.href));
    }
    for (const link of links) {
      const href = originalHrefs.get(link);
      const key = navigationKey(href, win.location.href);
      if (labels[key]) link.textContent = labels[key][english ? 1 : 0];
      link.setAttribute('href', navigationHref(href, root.lang, win.location.href));
      const target = new URL(href, win.location.href);
      if (english && !bilingualPages.has(normalizePagePath(target.pathname))) {
        const note = doc.createElement('small');
        note.className = 'language-note';
        note.textContent = ' (Korean page)';
        link.append(note);
      }
      // The homepage router owns its active state, including nested record views.
      if (!appOwnsNavigation) {
        const active = key === current;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    }
  };

  if (!appOwnsNavigation && more && trigger) {
    nav.addEventListener('click', event => {
      if (event.target.closest?.('a')) more.open = false;
    });
    doc.addEventListener('click', event => {
      if (!more.contains(event.target)) more.open = false;
    });
    doc.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !more.open) return;
      more.open = false;
      trigger.focus();
      event.preventDefault();
    });
    win.addEventListener('hashchange', render);
  }
  // Observe language only: never touch the page's calculation or scene state.
  new MutationObserver(render).observe(root, {attributes: true, attributeFilter: ['lang']});
  win.addEventListener('pageshow', render);
  render();
}

if (typeof document !== 'undefined') { bindSiteShell(); installProgressiveDisclosure(); }
