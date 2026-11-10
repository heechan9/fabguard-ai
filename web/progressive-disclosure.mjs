/** Reveal a deep-linked element without constructing a selector from untrusted hashes. */
export function openDetailsForHash(hash = globalThis.location?.hash, root = globalThis.document) {
  if (!root || typeof hash !== 'string' || !hash.startsWith('#') || hash.length < 2) return null;
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
  const target = root.getElementById(id);
  if (!target) return null;
  const ancestors = [];
  for (let node = target; node; node = node.parentElement) {
    if (node.tagName?.toLowerCase() === 'details') ancestors.push(node);
  }
  for (const details of ancestors.reverse()) details.open = true;
  return target;
}

/** Install once per window; reveal initial, changed, and restored fragment targets. */
const installations = new WeakMap();
export function installProgressiveDisclosure(windowObject = globalThis.window) {
  if (!windowObject?.document || !windowObject.addEventListener) return () => {};
  if (installations.has(windowObject)) return installations.get(windowObject);
  const reveal = () => {
    const target = openDetailsForHash(windowObject.location?.hash, windowObject.document);
    // Native fragment navigation may have happened while the ancestor was closed.
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (target && typeof target.focus === 'function') {
      if (!target.hasAttribute('tabindex') && !target.matches('a[href], button, input, select, textarea, summary')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  };
  windowObject.addEventListener('hashchange', reveal);
  windowObject.addEventListener('pageshow', reveal);
  if (windowObject.document.readyState === 'loading') windowObject.document.addEventListener('DOMContentLoaded', reveal, { once: true });
  else reveal();
  const cleanup = () => {
    windowObject.removeEventListener('hashchange', reveal);
    windowObject.removeEventListener('pageshow', reveal);
    windowObject.document.removeEventListener('DOMContentLoaded', reveal);
    installations.delete(windowObject);
  };
  installations.set(windowObject, cleanup);
  return cleanup;
}
