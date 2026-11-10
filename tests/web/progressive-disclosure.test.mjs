import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDetailsForHash, installProgressiveDisclosure } from '../../web/progressive-disclosure.mjs';

function fixture() {
  const outer = { tagName: 'DETAILS', open: false, parentElement: null };
  const inner = { tagName: 'DETAILS', open: false, parentElement: outer };
  const target = { tagName: 'H2', parentElement: inner };
  const root = { getElementById: id => id === '측정:결과' ? target : id === 'panel' ? inner : null };
  return { outer, inner, target, root };
}
test('encoded deep links open every ancestor without CSS selectors', () => {
  const { outer, inner, target, root } = fixture();
  assert.equal(openDetailsForHash('#' + encodeURIComponent('측정:결과'), root), target);
  assert.equal(outer.open, true);
  assert.equal(inner.open, true);
});
test('a detail itself is a valid deep target', () => {
  const { outer, inner, root } = fixture();
  assert.equal(openDetailsForHash('#panel', root), inner);
  assert.equal(inner.open, true);
  assert.equal(outer.open, true);
});
test('invalid, malformed and missing fragments are harmless and do not open panels', () => {
  const { outer, inner, root } = fixture();
  for (const hash of [undefined, null, '', '#', '#%E0%A4%A', '#missing', 'panel', '#x"]']) {
    assert.equal(openDetailsForHash(hash, root), null);
  }
  assert.equal(outer.open, false);
  assert.equal(inner.open, false);
});
test('initial load, hash changes and page restoration reveal targets; installation is idempotent', () => {
  const { outer, inner, target, root } = fixture();
  const events = new Map();
  let scrolls = 0;
  let focuses = 0;
  const attributes = new Map();
  target.hasAttribute = name => attributes.has(name);
  target.setAttribute = (name, value) => attributes.set(name, value);
  target.matches = () => false;
  target.focus = options => { assert.deepEqual(options, { preventScroll: true }); focuses++; };
  target.scrollIntoView = () => scrolls++;
  Object.assign(root, { readyState: 'complete', removeEventListener() {} });
  const windowObject = { document: root, location: { hash: '#' + encodeURIComponent('측정:결과') }, addEventListener: (event, fn) => events.set(event, fn), removeEventListener: event => events.delete(event) };
  const cleanup = installProgressiveDisclosure(windowObject);
  assert.equal(scrolls, 1);
  assert.equal(installProgressiveDisclosure(windowObject), cleanup);
  for (const event of ['hashchange', 'pageshow']) {
    outer.open = inner.open = false;
    events.get(event)();
    assert.equal(outer.open && inner.open, true);
  }
  assert.equal(scrolls, 3);
  assert.equal(focuses, 3);
  assert.equal(attributes.get("tabindex"), "-1");
  cleanup();
  assert.equal(events.size, 0);
});
test('loading documents reveal after DOM readiness and cleanup removes that listener', () => {
  const { root, inner } = fixture();
  const events = new Map();
  Object.assign(root, { readyState: 'loading', addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) });
  const win = { document: root, location: { hash: '#panel' }, addEventListener() {}, removeEventListener() {} };
  const cleanup = installProgressiveDisclosure(win);
  assert.equal(inner.open, false);
  events.get('DOMContentLoaded')();
  assert.equal(inner.open, true);
  cleanup();
  assert.equal(events.size, 0);
});
test('new static explanations are native closed details, with no controls or result containers inside', () => {
  for (const [path, id] of [['secom', 'expert-metrology'], ['smt', 'expert-aoi-requirements'], ['oht', 'expert-oht-sequence']]) {
    const html = readFileSync(new URL(`../../web/${path}/index.html`, import.meta.url), 'utf8');
    const panel = html.match(new RegExp(`<details class="professional-details" id="${id}">([\\s\\S]*?)</details>`));
    assert.ok(panel, path);
    assert.match(panel[1], /<summary>전문 설명과 근거 보기/);
    assert.doesNotMatch(panel[1], /<(?:input|select|button|canvas|svg)\b|role="(?:status|alert)"/);
  }
});
