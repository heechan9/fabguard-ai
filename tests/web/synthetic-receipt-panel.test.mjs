import assert from 'node:assert/strict';
class Element {
  constructor(name = '') { this.children = []; this.attrs = {}; this.name = name; }
  setAttribute(k,v) { this.attrs[k] = v; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(event, fn) { this[event] = fn; }
}
const scenarios = ['clean','late-but-complete','late-only','scoring-record-missing'];
const controls = scenarios.map(receiptCase => Object.assign(new Element('button'),{disabled:true,dataset:{receiptCase}}));
const ids = ['#receipt-scenario-output','#receipt-scenario-status','#receipt-scenario-meta',
             '#receipt-scenario-events','#receipt-count-rows','#receipt-count-total'];
const nodes = Object.fromEntries(ids.map(id => [id,new Element(id)]));
const panel = {querySelector:id => nodes[id], querySelectorAll:() => controls};
globalThis.document = {querySelector:() => panel,createElement:tag => new Element(tag)};
await import('../../web/equipment/synthetic-receipt-panel.mjs');
assert(controls.every(e => !e.disabled));
const outcome = ['MATCH','MATCH','BLOCKED','MISSING'];
for (let i = 0; i < controls.length; i++) {
  controls[i].click();
  assert.match(nodes[ids[1]].textContent,new RegExp(outcome[i]));
  assert.equal(controls[i].attrs['aria-pressed'],'true');
  assert.equal(controls.filter(e => e.attrs['aria-pressed']==='true').length,1);
  assert.equal(nodes[ids[0]].hidden,false);
  const totals = nodes[ids[5]].children[0].children;
  assert.equal(totals[0].scope,'row');
  assert.equal(totals.length,4);
  if (i===2) assert.equal(totals[3].textContent,'미실행');
  else assert.match(totals[3].textContent,/^\d+$/);
}
controls[0].dataset.receiptCase = 'undefined';
controls[0].click();
assert.equal(nodes[ids[0]].hidden,true);
console.log('4-state panel event and accessibility semantics smoke passed + invalid scenario hidden');
