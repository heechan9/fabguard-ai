import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {budgetView} from '../../web/review-budget-core.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('../../web/data/priority_top50.json',import.meta.url)));
test('Saved review budgets match fixed canonical top20/top40 without mutation',()=>{
 const before=JSON.stringify(rows);
 assert.deepEqual(budgetView(rows,20),{ids:rows.slice(0,20).map(r=>r.sample_id),reviewed:20,failures:4,normal:16,hidden:30});
 assert.equal(budgetView(rows,40).failures,5);assert.equal(budgetView(rows,40).normal,35);assert.equal(budgetView(rows,50).ids.length,50);
 assert.equal(JSON.stringify(rows),before);
});
test('Out-of-range scores are rejected even when saved rank order is preserved',()=>{
 for(const change of [r=>r[0].risk_score=2,r=>r[49].risk_score=-1]){
  const bad=structuredClone(rows);change(bad);
  const before=JSON.stringify(bad);
  for(const budget of [20,40,50])assert.throws(()=>budgetView(bad,budget),/Invalid ranked evidence/);
  assert.equal(JSON.stringify(bad),before);
 }
});
test('Inclusive score boundaries preserve displayed counts and evidence',()=>{
 const boundary=structuredClone(rows);boundary[0].risk_score=1;boundary[49].risk_score=0;
 const before=JSON.stringify(boundary);
 for(const budget of [20,40,50])assert.deepEqual(budgetView(boundary,budget),budgetView(rows,budget));
 assert.equal(JSON.stringify(boundary),before);
});
test('Unverified or malformed ranking cannot yield budget counts',()=>{
 for(const budget of [0,21,79,NaN])assert.throws(()=>budgetView(rows,budget));
 assert.throws(()=>budgetView(rows.slice(0,40),40));
 for(const change of [r=>r[1].sample_id=r[0].sample_id,r=>r[1].label=null,r=>r[1].rank=99,r=>r[1].risk_score=2]){
  const bad=structuredClone(rows);change(bad);assert.throws(()=>budgetView(bad,40));
 }
});
test('Queue heading and summary distinguish saved total from current display in both languages',async()=>{
 const app=fs.readFileSync(new URL('../../web/app.js',import.meta.url),'utf8');
 const controller=fs.readFileSync(new URL('../../web/review-budget.mjs',import.meta.url),'utf8');
 const {englishText}=await import('../../web/english-copy.mjs');
 assert.match(app,/<strong id="queue-visible-count">\$\{state.risks.length\}<\/strong>/);
 assert.match(app,/<small id="queue-total-count">저장 목록 전체 \$\{state.risks.length\}건<\/small>/);
 assert.match(controller,/visibleCount.textContent=String\(view.reviewed\)/);
 assert.doesNotMatch(app,/<span>생산 건 50개<\/span>/);
 assert.equal(englishText('저장된 생산 기록'),'Saved production records');
 assert.equal(englishText('현재 표시'),'Currently shown');
 assert.equal(englishText('저장 목록 전체 50건'),'50 records in the saved list');
});
