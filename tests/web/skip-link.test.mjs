import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('skip link focuses the current main content without changing the hash route', () => {
  const source = readFileSync(new URL('../../web/app.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/\nload\(\);\s*$/, '\n');
  let click, prevented = false, focused = false, scrolled = false;
  const app = {focus: () => {focused = true;}, scrollIntoView: () => {scrolled = true;}};
  const location = {search: '', hash: '#risks'};
  runInNewContext(source, {
    URLSearchParams, location,
    document: {documentElement: {}, querySelector: selector => selector === '#app' ? app : selector === '.skip-link' ? {addEventListener: (_, handler) => {click = handler;}} : null},
    window: {addEventListener: () => {}}
  });
  click({preventDefault: () => {prevented = true;}});
  assert.equal(prevented, true);
  assert.equal(focused, true);
  assert.equal(scrolled, true);
  assert.equal(location.hash, '#risks');
});
