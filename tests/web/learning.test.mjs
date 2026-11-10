import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {lessons} from '../../web/learn/content.mjs';
import {pick,suggestedOrder,blankRecord,validateRecords,saveRecords,loadRecords,clearRecords,mergeRecords,STORAGE_KEY} from '../../web/learn/core.mjs';
const read=file=>fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');
function storage(){const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('Three synthetic cases and distinct transfer examples have complete bilingual content',()=>{
 assert.equal(lessons.length,3);assert.equal(new Set(lessons.map(x=>x.id)).size,3);
 for(const l of lessons){
  for(const k of ['title','prerequisite','probe','scene','question','observation','limit','next','misconception','transfer'])for(const lang of ['ko','en'])assert.ok(l[k][lang].length>5,`${l.id}.${k}.${lang}`);
  assert.equal(l.hints.length,2);assert.equal(l.probeOptions.length,2);assert.equal(l.options.length,2);assert.equal(l.reasons.length,2);assert.equal(l.transferOptions.length,2);
  assert.notEqual(l.scene.en,l.transfer.en);assert.match(l.scene.en,/Synthetic/);assert.match(l.transfer.en,/synthetic/);assert.ok(l.link.startsWith('/'));
 }
});
test('Probes suggest order only, unanswered first; no scores',()=>{
 assert.deepEqual(suggestedOrder(),['signal','quality','causality']);
 const answers={signal:0,quality:0,causality:1};const copy={...answers};
 assert.deepEqual(suggestedOrder(answers),['quality','signal','causality']);assert.deepEqual(answers,copy);
 assert.deepEqual(suggestedOrder({signal:0}),['quality','causality','signal']);
});
test('Language fallback is explicit',()=>{assert.equal(pick(lessons[0].title,'en'),lessons[0].title.en);assert.equal(pick(lessons[0].title,'x'),lessons[0].title.ko);});
test('Records contain only the five allowed fields and default to not checked',()=>{for(const l of lessons){const r=blankRecord(l);assert.deepEqual(Object.keys(r).sort(),['checked','concept','evidence','misconception','source']);assert.equal(r.checked,false);} });
test('Explicit save writes snapshot, later memory changes do not autosave',()=>{
 const s=storage(),rows=[blankRecord(lessons[0])];assert.equal(s.data.size,0);saveRecords(s,rows);rows[0].checked=true;assert.equal(loadRecords(s)[0].checked,false);saveRecords(s,rows);assert.equal(loadRecords(s)[0].checked,true);
});
test('Empty and valid saved records round-trip without other app changes',()=>{const s=storage();s.setItem('other','keep');assert.deepEqual(loadRecords(s),[]);saveRecords(s,lessons.map(blankRecord));assert.equal(loadRecords(s).length,3);clearRecords(s);assert.equal(s.getItem(STORAGE_KEY),null);assert.equal(s.getItem('other'),'keep');});
test('Unknown fields, raw reasoning, unknown source and duplicate records are rejected',()=>{
 for(const change of [r=>r.notes='private',r=>r.checked='true',r=>r.source='external',r=>r.concept='unknown',r=>r.evidence='real-data',r=>r.misconception='unknown']){const r=blankRecord(lessons[0]);change(r);assert.throws(()=>validateRecords([r]));}
 assert.throws(()=>validateRecords([blankRecord(lessons[0]),blankRecord(lessons[0])]));assert.throws(()=>validateRecords({}));
});
test('Invalid/oversized saves are rejected without replacing storage',()=>{const s=storage();saveRecords(s,[]);const before=s.getItem(STORAGE_KEY);assert.throws(()=>saveRecords(s,[{reasoning:'x'}]));assert.equal(s.getItem(STORAGE_KEY),before);for(const raw of ['bad','{}',JSON.stringify({version:2,records:[]}),'x'.repeat(2501)]){s.setItem(STORAGE_KEY,raw);assert.throws(()=>loadRecords(s));}});
test('Unavailable storage is not treated as a successful save, load or reset',()=>{const bad=new Proxy({},{get(){throw Error('blocked')}});assert.throws(()=>saveRecords(bad,[]));assert.throws(()=>loadRecords(bad));assert.throws(()=>clearRecords(bad));});
test('Optional entry preserves existing default app and no dependencies or network clients are introduced',()=>{
 const index=read('web/index.html');assert.match(index,/id="learning-entry"/);assert.match(index,/id="open-learning"/);assert.match(index,/<script type="module" src="\/app.js"><\/script>/);
 const html=read('web/learn/template.mjs');assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)=\?"https?:/);const entry=read('web/learn/entry.mjs');assert.match(entry,/attachShadow/);assert.match(entry,/dialog.close/);assert.match(entry,/hashchange/);
 const code=['app','core','content'].map(x=>read(`web/learn/${x}.mjs`)).join('\n');assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/);assert.doesNotMatch(code,/sessionStorage|indexedDB|\.cookie\b/);
});
// Controller contracts with a minimal DOM stub. These are NOT browser, layout,
// accessibility-tree, keyboard navigation or screen-reader tests.
function controller(){
 const nodes=new Map(),s=storage();let focused='';
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,textContent:'',innerHTML:'',listeners:{},dataset:{},setAttribute(){},focus(){focused=id},addEventListener(type,fn){this.listeners[type]=fn},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()}});return nodes.get(id)};
 const doc={host:{lang:'ko'},getElementById:node,querySelector:query=>node(query)};
 const ctx={root:doc,URLSearchParams,lessons,pick,suggestedOrder,blankRecord,saveRecords,loadRecords,clearRecords,mergeRecords,localStorage:s};
 vm.runInNewContext(read('web/learn/app.mjs').replace(/^import .*;\n/gm,'').replace('export function mountLearning','function mountLearning')+';mountLearning(root);',ctx);
 return {node,s,ctx,focus:()=>focused,click:id=>node(id).listeners.click(),act:action=>node('stage').listeners.click({target:{closest:()=>({dataset:{action}})}}),choose:(name,value)=>node('stage').listeners.change({target:{name,value:String(value)}})};
}
test('Initial controller is ephemeral and language toggle preserves answers and stays focused',()=>{
 const c=controller();assert.equal(c.s.data.size,0);c.choose('probe-signal',0);c.click('language');assert.match(c.node('stage').innerHTML,/Where shall we start/);assert.match(c.node('stage').innerHTML,/name="probe-signal" value="0" checked/);assert.equal(c.focus(),'language');assert.equal(c.s.data.size,0);
});
test('Controller opens map, requires item/reason or permits reveal, and bounds hints',()=>{
 const c=controller();c.act('skip-probe');assert.match(c.node('stage').innerHTML,/최소 선행개념 지도/);c.act('lesson-0');c.act('check');assert.match(c.node('exercise-status').textContent,/각각 선택/);assert.equal(c.focus(),'input[name="choice"]');for(let i=0;i<4;i++)c.act('hint');assert.match(c.node('exercise-status').textContent,/2개/);c.act('reveal');assert.equal(c.focus(),'explanation-title');assert.match(c.node('records').innerHTML,/직접 확인 전/);assert.equal(c.s.data.size,0);
});
test('Prediction, transfer and self-check keep no response history in explicit save',()=>{
 const c=controller();c.act('skip-probe');c.act('lesson-0');c.choose('choice',0);c.choose('reason',0);c.act('check');assert.match(c.node('stage').innerHTML,/근거에 맞습니다/);c.choose('transfer',1);c.act('transfer');c.act('confirm');c.click('save');const data=JSON.parse(c.s.getItem(STORAGE_KEY));assert.equal(data.records[0].checked,true);assert.deepEqual(Object.keys(data.records[0]).sort(),['checked','concept','evidence','misconception','source']);
});
test('Skip and back-map work repeatedly without generating learning records',()=>{const c=controller();c.act('skip-probe');c.act('lesson-0');c.act('skip-case');assert.match(c.node('stage').innerHTML,/데이터 품질부터/);c.act('skip-case');c.act('skip-case');assert.match(c.node('stage').innerHTML,/최소 선행개념 지도/);c.act('lesson-1');c.act('back-map');assert.match(c.node('records').innerHTML,/아직 기록이 없어요/);});
test('Reset cancel preserves records; confirmed reset clears only learning and restores requested focus',()=>{
 const c=controller();c.s.setItem('unrelated','preserve');c.act('skip-probe');c.act('lesson-0');c.act('reveal');c.click('save');c.click('reset');assert.equal(c.node('reset-dialog').open,true);c.click('cancel-reset');assert.ok(c.s.getItem(STORAGE_KEY));assert.equal(c.focus(),'reset');c.click('reset');c.click('confirm-reset');assert.equal(c.s.getItem(STORAGE_KEY),null);assert.equal(c.s.getItem('unrelated'),'preserve');assert.match(c.node('stage').innerHTML,/어디서 시작/);assert.equal(c.focus(),'reset');
});
test('Corrupt load preserves temporary records and unavailable storage reports failed reset honestly',()=>{
 const c=controller();c.act('skip-probe');c.act('lesson-0');c.act('reveal');c.s.setItem(STORAGE_KEY,'bad');c.click('load');assert.match(c.node('storage-status').textContent,/형식이 맞지/);assert.match(c.node('records').innerHTML,/정상·이상/);Object.defineProperty(c.ctx,'localStorage',{get(){throw Error('blocked')}});c.click('save');assert.match(c.node('storage-status').textContent,/저장하지 못/);c.click('reset');c.click('confirm-reset');assert.match(c.node('storage-status').textContent,/지우지 못/);
});
test('Lazy isolated entry prevents duplicate open, closes on navigation and restores requested focus',async()=>{
 const nodes=new Map();const hosts=[];let created=0,mounted=0,focused='',deferClose=false;const pendingClose=[];
 const element=id=>{if(!nodes.has(id))nodes.set(id,{id,listeners:{},disabled:false,open:false,focus(){focused=id},addEventListener(n,fn){this.listeners[n]=fn},showModal(){this.open=true},close(){this.open=false;if(deferClose)pendingClose.push(()=>this.listeners.close?.());else this.listeners.close?.()}});return nodes.get(id)};
 const root={innerHTML:'',getElementById:element,addEventListener(){}};
 const win={listeners:{},addEventListener(n,fn){this.listeners[n]=fn}};
 const ctx={document:{documentElement:{dataset:{theme:'dark'}},getElementById:element,body:{append(){}},createElement(){created++;const host={dataset:{},attachShadow(){return root},remove(){}};hosts.push(host);return host;}},window:win,location:{search:''},URLSearchParams,__template:'<dialog>',__mountLearning(){mounted++}};
 const code=read('web/learn/entry.mjs').replace("[import('./template.mjs'),import('./app.mjs')]","[Promise.resolve({template:__template}),Promise.resolve({mountLearning:__mountLearning})]");
 vm.runInNewContext(code,ctx);const start=element('open-learning');assert.equal(created,0);
 await Promise.all([start.listeners.click(),start.listeners.click()]);assert.equal(created,1);assert.equal(mounted,1);assert.equal(start.disabled,false);assert.equal(element('learning-dialog').open,true);
 element('skip-learning').listeners.click();assert.equal(focused,'main');deferClose=true;element('exit').listeners.click();assert.equal(focused,'open-learning','explicit close restores focus before the queued native close event');for(const callback of pendingClose.splice(0))callback();deferClose=false;
 ctx.document.documentElement.dataset.theme='silver';await start.listeners.click();assert.equal(created,1);assert.equal(hosts[0].dataset.theme,'silver');assert.equal(element('learning-dialog').open,true);element('reset-dialog').open=true;win.listeners.hashchange();assert.equal(element('learning-dialog').open,false);assert.equal(element('reset-dialog').open,false);assert.equal(focused,'open-learning');
});
test('Empty restore preserves open lesson and restored snapshots cannot discard a later self-check',()=>{
 const c=controller();c.act('skip-probe');c.act('lesson-0');c.act('reveal');c.act('transfer');c.click('load');assert.match(c.node('records').innerHTML,/정상·이상/);c.act('confirm');c.click('save');assert.equal(JSON.parse(c.s.getItem(STORAGE_KEY)).records[0].checked,true);
 saveRecords(c.s,[blankRecord(lessons[1])]);c.click('load');c.act('confirm');c.click('save');const restored=JSON.parse(c.s.getItem(STORAGE_KEY)).records;assert.equal(restored.length,2);assert.equal(restored.find(x=>x.concept==='signal').checked,true);
});
test('Incorrect prediction and transfer show comparison without grading or automatic confirmation',()=>{
 const c=controller();c.act('skip-probe');c.act('lesson-0');c.choose('choice',1);c.choose('reason',1);c.act('check');assert.match(c.node('stage').innerHTML,/다시 비교/);c.choose('transfer',0);c.act('transfer');assert.match(c.node('stage').innerHTML,/선택한 설명을 아래 근거와 비교/);c.click('save');assert.equal(JSON.parse(c.s.getItem(STORAGE_KEY)).records[0].checked,false);assert.doesNotMatch(c.s.getItem(STORAGE_KEY),/score|grade|ability|answer/);
});

test('Internal evidence links retain the selected learning language',()=>{
 const c=controller();c.act('skip-probe');c.act('lesson-0');c.act('reveal');assert.match(c.node('stage').innerHTML,/href="\/\?lang=ko#limitations"/);c.click('language');assert.match(c.node('stage').innerHTML,/href="\/\?lang=en#limitations"/);c.act('back-map');c.act('lesson-1');c.act('reveal');assert.match(c.node('stage').innerHTML,/href="\/equipment\/index.html\?lang=en"/);
});
