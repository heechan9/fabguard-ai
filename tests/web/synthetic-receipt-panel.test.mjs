import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
class Element {
  constructor(name = '') { this.children = []; this.attrs = {}; this.name = name; }
  setAttribute(k,v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(event, fn) { this[event] = fn; }
}
const scenarios = ['clean','late-but-complete','late-only','scoring-record-missing'];
const controls = scenarios.map(receiptCase => Object.assign(new Element('button'),{disabled:true,dataset:{receiptCase}}));
const ids = ['#receipt-scenario-output','#receipt-scenario-status','#receipt-scenario-meta',
             '#receipt-scenario-events','#receipt-count-rows','#receipt-count-total',
             '#receipt-detail','#receipt-scenario-reason','#receipt-raw-count','#receipt-admitted-count','#receipt-scored-count'];
const nodes = Object.fromEntries(ids.map(id => [id,new Element(id)]));
const panel = Object.assign(new Element('panel'),{querySelector:id => nodes[id], querySelectorAll:() => controls});
globalThis.document = {querySelector:() => panel,createElement:tag => new Element(tag)};
await import('../../web/equipment/synthetic-receipt-panel.mjs');
assert(controls.every(e => !e.disabled));
const outcome = ['MATCH','MATCH','BLOCKED','MISSING'];
for (let i = 0; i < controls.length; i++) {
  controls[i].click();
  assert.equal(panel.attrs['data-receipt-result'],outcome[i]);
  assert.equal(nodes[ids[1]].children[0].textContent,['예제 대조 일치','예제 대조 일치','검토 보류','검토 필요'][i]);
  assert.match(nodes[ids[1]].children[1].textContent,/기대 기록 4건, 마감 내 접수 [34]건, 점수 기록 (미실행|[34]건)\. 운영 판정 없음/);
  assert.equal(controls[i].attrs['aria-pressed'],'true');
  assert.equal(controls.filter(e => e.attrs['aria-pressed']==='true').length,1);
  assert.equal(nodes[ids[0]].hidden,false);
  const totals = nodes[ids[5]].children[0].children;
  assert.equal(totals[0].scope,'row');
  assert.equal(totals.length,4);
  assert.equal(nodes[ids[6]].hidden,false);
  assert.deepEqual(ids.slice(8).map(id=>nodes[id].textContent),[['4','4','4'],['4','4','4'],['4','3','미실행'],['4','4','3']][i]);
  assert.doesNotMatch(nodes[ids[7]].textContent,/SYN-/);
  if (i===2) {
    assert.equal(totals[3].textContent,'미실행');
    assert.match(nodes[ids[7]].textContent,/1초/);
    assert.match(nodes[ids[3]].children.map(x=>x.textContent).join(' '), /SYN-03/);
  }
  else assert.match(totals[3].textContent,/^\d+$/);
}
controls[0].dataset.receiptCase = 'undefined';
controls[0].click();
assert.equal(nodes[ids[0]].hidden,true);
assert.equal(nodes[ids[6]].hidden,true);
assert.equal(panel.attrs['data-receipt-result'],undefined);
console.log('4-state panel event and accessibility semantics smoke passed + invalid scenario hidden');

for (const [index, initialHash] of ['', '#csv-screening', '#synthetic-receipt'].entries()) {
  const listeners = {};
  let focused = 0, scrolled = 0;
  panel.focus = ({preventScroll}) => { assert.equal(preventScroll,true); focused++; };
  panel.scrollIntoView = ({block}) => { assert.equal(block,'start'); scrolled++; };
  globalThis.window = {
    location: {hash: initialHash},
    addEventListener: (name,fn) => { listeners[name] = fn; },
    requestAnimationFrame: fn => fn(),
  };
  controls[0].dataset.receiptCase = 'clean';
  await import(`../../web/equipment/synthetic-receipt-panel.mjs?anchor-test=${index}`);
  assert.equal(focused, initialHash === '#synthetic-receipt' ? 1 : 0);
  assert.equal(scrolled, focused);
  if (initialHash !== '#synthetic-receipt') {
    assert.equal(panel.attrs['data-receipt-result'], undefined);
    assert.equal(nodes[ids[0]].hidden,true);
    window.location.hash = '#synthetic-receipt';
    listeners.hashchange();
  }
  assert.equal(panel.attrs['data-receipt-result'],'BLOCKED');
  assert.equal(focused,1);
  assert.equal(scrolled,1);
  controls[3].click();
  assert.equal(panel.attrs['data-receipt-result'],'MISSING');
  assert.equal(focused,1,'selecting a different scenario must not steal focus');
  window.location.hash = '#csv-screening';
  listeners.hashchange();
  assert.equal(focused,1,'other anchors remain native navigation');
  window.location.hash = '#synthetic-receipt';
  listeners.hashchange();
  assert.equal(focused,2);
  assert.equal(panel.attrs['data-receipt-result'],'MISSING','returning does not reset the selected scenario');
  controls[0].dataset.receiptCase = 'invalid';
  controls[0].click();
}
delete globalThis.window;

const home = readFileSync(new URL('../../web/app.js',import.meta.url),'utf8');
const equipment = readFileSync(new URL('../../web/equipment/index.html',import.meta.url),'utf8');
const html = readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
assert.match(home,/<a class="button home-review-primary" href="\/equipment\/#synthetic-receipt">/);
assert.match(home,/<a class="text-link home-review-secondary" href="\/smt\/">/);
assert.match(home,/<a class="text-link" href="\/equipment\/#csv-screening">/);
assert.match(html,/href="\/home-review.css"/);
assert.match(equipment,/<section id="synthetic-receipt" tabindex="-1" aria-labelledby="synthetic-receipt-title">/);
assert.match(equipment,/id="csv-screening" tabindex="-1"/);
assert.match(equipment,/id="receipt-scenario-status" role="status" aria-atomic="true"/);
const equipmentIds = [...equipment.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(equipmentIds.length,new Set(equipmentIds).size);
