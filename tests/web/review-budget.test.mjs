import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {budgetView} from '../../web/review-budget-core.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('../../web/data/priority_top50.json',import.meta.url)));
test('Saved review budgets match fixed canonical top20/top40 without mutation',()=>{
 const before=JSON.stringify(rows);
 assert.deepEqual(budgetView(rows,20),{ids:rows.slice(0,20).map(r=>r.sample_id),reviewed:20,failures:4,normal:16,hidden:30});
 assert.equal(budgetView(rows,40).failures,5);assert.equal(budgetView(rows,40).normal,35);assert.equal(budgetView(rows,50).ids.length,50);
 assert.equal(JSON.stringify(rows),before);
});
test('Unverified or malformed ranking cannot yield budget counts',()=>{
 for(const budget of [0,21,79,NaN])assert.throws(()=>budgetView(rows,budget));
 assert.throws(()=>budgetView(rows.slice(0,40),40));
 for(const change of [r=>r[1].sample_id=r[0].sample_id,r=>r[1].label=null,r=>r[1].rank=99,r=>r[1].risk_score=2]){
  const bad=structuredClone(rows);change(bad);assert.throws(()=>budgetView(bad,40));
 }
});
