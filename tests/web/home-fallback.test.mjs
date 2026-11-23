import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../web/app.js', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const actual = [
  between('async function load()', 'const selectedTest'),
  between('function waferVisual()', 'function beginnerEntry()'),
  between('function homeIntro()', 'function summaryView()'),
  between('function route()', 'window.addEventListener("hashchange", route)'),
].join('\n');

function fixture({ path = '', brokenJson = false, invalidSchema = false, english = false } = {}) {
  let retry, renders = 0, hits = 0, request;
  const app = {innerHTML: '', querySelector: () => ({ addEventListener: (_type, callback) => { retry = callback; } })};
  const identity = () => {};
  const context = vm.createContext({
    app, dataStatus: 'loading', state: {}, isEnglish: english, location: { hash: '' },
    document: {body: {classList: {toggle: identity}}},
    syncNavigation: identity, finishRoute: identity, translateEnglish: identity,
    validateSummaryDataset: identity, storyEvidence: identity, validatePhase1: identity,
    validateDKASC: identity, validateGlobalE2E: identity,
    validateGlobalCandidates: () => { if (invalidSchema) throw Error('bad schema'); },
    summaryView: () => { renders++; app.innerHTML = 'verified results'; },
    fetch: resource => { hits++; return (request ?? Promise.resolve()).then(() => ({
      ok: resource !== path,
      json: async () => { if (brokenJson) throw Error('bad JSON'); return {}; },
    })); },
  });
  vm.runInContext(actual, context);
  return {app, context, retry: () => retry(), load: () => vm.runInContext('load()', context),
    route: () => vm.runInContext('route()', context), renders: () => renders, hits: () => hits,
    hold: promise => { request = promise; }, recover: () => { path = ''; brokenJson = false; invalidSchema = false; }};
}

function assertHero(html) {
  assert.match(html, /class="hero project-intro home-review-hero"/);
  assert.match(html, /fabguard-dusk-hero-v3.jpg/);
  assert.match(html, /href="\/equipment\/#synthetic-receipt"/);
  assert.match(html, /href="\/smt\/"/);
}

test('home introduction appears immediately, before six result requests finish', async () => {
  const f = fixture();
  let finish;
  f.hold(new Promise(resolve => { finish = resolve; }));
  const waiting = f.load();
  assertHero(f.app.innerHTML);
  assert.match(f.app.innerHTML, /불러오는 중/);
  assert.equal(f.renders(), 0);
  finish();
  await waiting;
  assert.equal(f.hits(), 6);
  assert.equal(f.renders(), 1);
});

for (const config of [{path:'/data/global_candidates.json'}, {path:'/data/summary.json'}, {brokenJson:true,english:true}, {invalidSchema:true}]) {
  test(`cannot show unverified numbers, but preserves links and art: ${JSON.stringify(config)}`, async () => {
    const f = fixture(config);
    await f.load();
    assertHero(f.app.innerHTML);
    assert.match(f.app.innerHTML, /retry-load/);
    assert.equal(f.renders(), 0);
    f.context.location.hash = '#risks';
    f.route();
    assert.doesNotMatch(f.app.innerHTML, /home-review-hero|verified results/);
    f.context.location.hash = '#summary';
    f.route();
    assertHero(f.app.innerHTML);
    f.recover();
    f.retry();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.renders(), 1);
    assert.equal(f.hits(), 12);
  });
}

test('links into the homepage keep the introduction when saved results fail', async () => {
  const f = fixture({path:'/data/global_candidates.json'});
  await f.load();
  for (const hash of ['#result', '#answer-overview', '#global', '#process']) {
    f.context.location.hash = hash;
    f.route();
    assertHero(f.app.innerHTML);
    assert.match(f.app.innerHTML, /retry-load/);
  }
  assert.equal(f.renders(), 0);
});
