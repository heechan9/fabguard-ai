import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, receiptText, replay } from '../../web/collaborate/replay.mjs';

test('starter separates full, missing and equal-count substituted rosters', () => {
  assert.equal(replay('complete').status, 'MATCH');
  assert.equal(replay('missing').status, 'MISSING');
  const replaced = replay('replacement');
  assert.equal(replaced.status, 'SUBSTITUTED');
  assert.match(replaced.observed, /Candidate \(3\): SYN-01, SYN-99, SYN-03\. Missing: SYN-02\. Foreign: SYN-99\./);
  assert.match(replaced.expected, /Fixed review budget per workflow: 2\./);
  assert.throws(() => replay('toString'), TypeError);
});

test('manually sharable receipt identifies observed, expected and provenance', () => {
  const text = receiptText(replay('missing'));
  for (const field of ['Scenario', 'Expected', 'Observed', 'Provenance', 'Outcome', 'Boundary']) {
    assert.match(text, new RegExp('^' + field + ':', 'm'));
  }
  assert.match(text, /synthetic-roster\/v1/);
  const fingerprint = createHash('sha256').update('SYN-01\nSYN-02\nSYN-03\n').digest('hex');
  assert.ok(text.includes(fingerprint));
  assert.match(text, /version fingerprint, not authenticity/);
});

test('native control wiring clears stale receipt when changing case and populates it on click', () => {
  const elements = Object.fromEntries(['scenario', 'run', 'status', 'expected', 'observed', 'provenance', 'receipt']
    .map(id => [id, {
      on: {},
      addEventListener(type, fn) { this.on[type] = fn; }
    }]));
  mount({ getElementById: id => elements[id] });
  elements.scenario.value = 'complete';
  elements.run.on.click();
  assert.match(elements.status.textContent, /^MATCH:/);
  assert.match(elements.receipt.value, /^Outcome: MATCH/m);
  elements.scenario.value = 'replacement';
  elements.scenario.on.change();
  assert.equal(elements.receipt.value, '');
  assert.equal(elements.observed.textContent, '—');
  elements.run.on.click();
  assert.match(elements.status.textContent, /^SUBSTITUTED:/);
  assert.match(elements.receipt.value, /Foreign: SYN-99/);
});

test('source has native keyboard controls, status announcement and no posting form', () => {
  const html = readFileSync(new URL('../../web/collaborate/index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<label for="scenario">.*?<select id="scenario"/s);
  assert.match(html, /<button id="run" type="button">/);
  assert.match(html, /<p id="status" [^>]*role="status"/);
  assert.match(html, /<textarea id="receipt" readonly/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<form\b|<input[^>]+type="file"/i);
  assert.match(html, /CONTRIBUTING\.md/);
  assert.match(html, /template=review-feedback\.yml/);
});
test('public entry points lead to distinct GitHub issue lanes', () => {
  const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  const html = read('web/collaborate/index.html');
  assert.match(read('web/index.html'), /href="\/collaborate\/index\.html"/);
  assert.match(read('README.md'), /fabguard-ai\.vercel\.app\/collaborate\//);
  for (const template of ['collaboration-question.yml', 'review-feedback.yml']) {
    assert.ok(html.includes('template=' + template));
    assert.ok(read('CONTRIBUTING.md').includes('template=' + template));
    assert.ok(read('.github/ISSUE_TEMPLATE/' + template).includes('required: true'));
  }
  assert.equal(html.match(/template=collaboration-question\.yml/g)?.length, 2);
  assert.equal(html.match(/template=review-feedback\.yml/g)?.length, 1);
});
