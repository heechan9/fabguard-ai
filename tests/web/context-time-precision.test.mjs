import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePackage,reviewDecision,exportDecisions,epochMicros} from '../../web/equipment/context-review-model.mjs';
const raw=fs.readFileSync(new URL('../../web/equipment/data/maintenance-synthetic.json',import.meta.url),'utf8');
const reviewPage=fs.readFileSync(new URL('../../web/equipment/context-review.html',import.meta.url),'utf8');
const outcomeMarkup=reviewPage.match(/<select id="review-outcome">([^]*?)<\/select>/)?.[1]??'';
const outcomeValues=[...outcomeMarkup.matchAll(/<option value="([^"]+)">[^<]*<\/option>/g)].map(match=>match[1]);
const copy=()=>JSON.parse(raw);
const f=p=>({review_id:p.observations[0].review_id,reviewer_role:'reviewer',decided_at:'2026-09-01T00:20:00Z',outcome:'false_alarm',action:'no_action',rationale:'test'});
test('timeline one microsecond after cutoff is rejected',()=>{const p=copy();p.timeline[0].available_at='2026-09-01T00:20:00.000001Z';assert.throws(()=>parsePackage(JSON.stringify(p)));});
test('observation one microsecond after cutoff is rejected',()=>{const p=copy();p.observations[2].event_time=p.queue.items[2].event_time='2026-09-01T00:20:00.000001Z';assert.throws(()=>parsePackage(JSON.stringify(p)));});
test('strictly increasing submillisecond rows remain valid',()=>{const p=copy();p.observations.forEach((r,i)=>{r.event_time=p.queue.items[i].event_time=`2026-09-01T00:11:00.00000${i+1}Z`;});assert.doesNotThrow(()=>parsePackage(JSON.stringify(p)));});
test('decision cannot precede cutoff or exceed now by one microsecond',()=>{const p=copy();p.as_of='2026-09-01T00:20:00.000001Z';assert.throws(()=>reviewDecision(p,f(p),Date.parse('2026-09-01T00:21:00Z')));const q=copy();assert.throws(()=>reviewDecision(q,{...f(q),decided_at:'2026-09-01T00:21:00.000001Z'},Date.parse('2026-09-01T00:21:00Z')));});
test('decision and repeated export preserve fractional time with UTC normalization',()=>{const p=copy(),now=Date.parse('2026-09-01T00:21:00Z');p.as_of='2026-09-01T00:20:00.000001Z';const d=reviewDecision(p,{...f(p),decided_at:'2026-09-01T09:20:00.000002+09:00'},now);assert.equal(d.decided_at,'2026-09-01T00:20:00.000002Z');assert.equal(exportDecisions(p,'a'.repeat(64),[d],now).decisions[0].decided_at,d.decided_at);});

test('context, decision and export reject a seventh fractional digit', () => {
 const p=copy(), extra='2026-09-01T00:20:00.0000019Z';
 assert.throws(()=>parsePackage(JSON.stringify({...p,as_of:extra})),/6자리/);
 assert.throws(()=>reviewDecision(p,{...f(p),decided_at:extra}),/6자리/);
 assert.throws(()=>exportDecisions(p,'a'.repeat(64),[{...f(p),decided_at:extra}]),/6자리/);
});

test('chart time differences preserve one microsecond and offset equivalence', () => {
 const origin=epochMicros('2026-09-01T00:20:00.000001Z');
 assert.equal(epochMicros('2026-09-01T09:20:00.000001+09:00'),origin);
 assert.equal(epochMicros('2026-09-01T00:20:00.000002Z')-origin,1n);
 assert.equal(epochMicros('1969-12-31T23:59:59.999999Z'),-1n);
});

function reviewDocument(t, source){
 function element(tag='') {
  return {
   tag,value:'',children:[],listeners:{},attributes:{},
   get options(){return this.children;},
   append(child){this.children.push(child);},
   replaceChildren(){this.children=[];this.selected=undefined;},
   addEventListener(type,handler){this.listeners[type]=handler;},
   setAttribute(key,value){this.attributes[key]=value;},
   focus(){},click(){},
  };
 }
 const nodes=new Map();
 const document={
  getElementById(id){
   if(!nodes.has(id)){
    const node=element();
    if(id==='review-outcome')node.children=outcomeValues.map(value=>({...element('option'),value}));
    if(id==='review-target')Object.defineProperty(node,'value',{
     get(){return this.selected?.value??this.children[0]?.value??'';},set(value){this.selected=this.children.find(option=>option.value===value);},
    });
    nodes.set(id,node);
   }
   return nodes.get(id);
  },
  createElement:element,
  createElementNS(_namespace,tag){return element(tag);},
 };
 Object.defineProperty(globalThis,'document',{value:document,configurable:true});
 t.after(()=>{delete globalThis.document;});
 t.mock.method(globalThis,'fetch',async()=>new Response(source));
 return nodes;
}

test('review rendering preserves chart spacing, sample support and held rows', async t => {
 const p=copy();
 const eventTimes=['2026-09-01T00:11:30.000001Z','2026-09-01T00:11:30.000002Z','2026-09-01T00:11:30.000003Z'];
 p.timeline[0].effective_at=eventTimes[1];
 p.observations.forEach((row,index)=>{row.event_time=p.queue.items[index].event_time=eventTimes[index];});
 const nodes=reviewDocument(t,JSON.stringify(p));
 await import('../../web/equipment/context-review.mjs');
 await nodes.get('context-example').listeners.click();

 const marks=nodes.get('context-chart').children;
 assert.deepEqual(marks.filter(mark=>mark.tag==='circle').map(mark=>mark.attributes.cx),['75','450']);
 assert.ok(marks.some(mark=>mark.tag==='line'&&mark.attributes.x1==='450'));
 assert.equal(nodes.get('context-support').textContent,'이후 측정 기록 3건 · 값 있음 2건 · 결측 1건 · 기록된 LOT ID 1개');
 assert.match(nodes.get('context-observations').children[1].children[2].textContent,/판단 보류/);
});

test('review decision export waits for explicit save and handles failed save, target change and clearing',async t=>{
 const nodes=reviewDocument(t,raw);
 const downloads=[];
 t.mock.method(URL,'createObjectURL',blob=>{downloads.push(blob);return 'blob:synthetic';});
 await import('../../web/equipment/context-review.mjs?unsaved');
 const get=id=>nodes.get(id),click=id=>get(id).listeners.click();
 const edit=(id,value,event='input')=>{get(id).value=value;get(id).listeners[event]();};
 const select=id=>edit('review-target',id,'change');
 await click('context-example');
 const [first,second]=copy().observations;
 edit('review-role','synthetic reviewer');
 edit('review-time','2026-09-01T00:20:00Z');
 edit('review-reason','Original saved reason');
 click('review-add');
 assert.equal(get('review-export').disabled,false);
 for(const [id,value,event] of [['review-role','Other role'],['review-time','2026-09-01T00:20:01Z'],['review-reason','Edited reason'],['review-outcome','confirmed_issue','change'],['review-action','equipment_check','change']]){
  const original=get(id).value;
  edit(id,value,event);
  assert.equal(get('review-export').disabled,true,id);
  assert.match(get('review-unsaved').textContent,/저장하지 않은 변경/);
  click('review-export');
  assert.equal(downloads.length,0,id);
  edit(id,original,event);
  assert.equal(get('review-export').disabled,false,id);
 }
 edit('review-reason','');click('review-add');
 assert.equal(get('review-export').disabled,true);
 assert.match(get('context-error').textContent,/이유/);
 edit('review-reason','Saved after edit');click('review-add');click('review-export');
 assert.equal(JSON.parse(await downloads[0].text()).decisions[0].rationale,'Saved after edit');
 edit('review-role','Unsaved role');select(second.review_id);
 assert.match(get('review-unsaved').textContent,/버렸습니다/);
 assert.equal(get('review-role').value,'');
 select(first.review_id);
 assert.equal(get('review-reason').value,'Saved after edit');
 edit('review-reason','Discard with saved draft');click('review-remove');
 assert.equal(get('review-export').disabled,true);
 assert.match(get('review-unsaved').textContent,/지웠습니다/);
 edit('review-reason','Discard with package');click('context-clear');
 assert.equal(get('review-export').disabled,true);
 assert.equal(get('review-unsaved').textContent,'');
});

test('rendered outcome options allow confirmed_issue on clear rows only',async t=>{
 assert.deepEqual(outcomeValues,['insufficient_evidence','confirmed_issue','false_alarm']);
 assert.match(outcomeMarkup,/<option value="confirmed_issue">확인한 문제 있음 \(사용자 기록\)<\/option>/);
 const nodes=reviewDocument(t,raw);
 const downloads=[];
 t.mock.method(URL,'createObjectURL',blob=>{downloads.push(blob);return 'blob:synthetic';});
 await import('../../web/equipment/context-review.mjs?confirmed-issue');
 const get=id=>nodes.get(id),click=id=>get(id).listeners.click();
 await click('context-example');
 const rows=copy().observations;
 const clear=rows.find(row=>row.context_state==='context_clear');
 const held=rows.find(row=>row.context_state==='withheld');
 const select=row=>{get('review-target').value=row.review_id;get('review-target').listeners.change();};
 const fill=()=>{
  get('review-role').value='synthetic reviewer';
  get('review-time').value='2026-09-01T00:20:00Z';
  get('review-reason').value='Synthetic issue';
  get('review-outcome').value='confirmed_issue';
  get('review-outcome').listeners.change();
 };
 select(clear);
 assert.ok(get('review-outcome').options.every(option=>!option.disabled));
 fill();click('review-add');
 assert.equal(get('review-export').disabled,false);
 click('review-export');
 const [saved]=JSON.parse(await downloads[0].text()).decisions;
 assert.equal(saved.review_id,clear.review_id);
 assert.equal(saved.outcome,'confirmed_issue');

 select(held);
 assert.deepEqual(get('review-outcome').options.filter(option=>!option.disabled).map(option=>option.value),['insufficient_evidence']);
 fill();click('review-add');
 assert.match(get('context-error').textContent,/보류/);
 assert.equal(get('review-export').disabled,true);
 click('review-export');
 assert.equal(downloads.length,1);
 assert.match(get('review-count').textContent,/초안 1건.*pending 2건/);
});
