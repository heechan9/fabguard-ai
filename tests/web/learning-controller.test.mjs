// Controller test double only, not actual DOM rendering, keyboard or screen-reader testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {lessons} from '../../web/learn/content.mjs';
import {pick,suggestedOrder,blankRecord,saveRecords,loadRecords,clearRecords,mergeRecords,STORAGE_KEY} from '../../web/learn/core.mjs';
test('unified modal preserves earlier controller safeguards across stale saves and reloads',()=>{
 const nodes=new Map(),data=new Map(),access=[];let focused='';
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',handlers:{},setAttribute(){},addEventListener(k,f){this.handlers[k]=f;},focus(){focused=id;},showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();}});return nodes.get(id);};
 const storage={getItem(k){access.push(['get',k]);return data.get(k)??null;},setItem(k,v){access.push(['set',k]);data.set(k,v);},removeItem(k){access.push(['remove',k]);data.delete(k);}};
 const ctx={root:{host:{},getElementById:node,querySelector:node},localStorage:storage,lessons,pick,suggestedOrder,blankRecord,saveRecords,loadRecords,clearRecords,mergeRecords};
 const code=readFileSync(new URL('../../web/learn/app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function mountLearning','function mountLearning');vm.runInNewContext(code+';mountLearning(root,"en");',ctx);
 const act=action=>node('stage').handlers.click({target:{closest:()=>({dataset:{action}})}}),click=id=>node(id).handlers.click();
 assert.deepEqual(access,[]);assert.match(node('stage').innerHTML,/Where shall we start/);act('skip-probe');act('lesson-0');act('reveal');click('save');
 const snapshot=data.get(STORAGE_KEY);act('transfer');act('confirm');assert.equal(data.get(STORAGE_KEY),snapshot,'new self-check is not auto-saved');click('load');click('save');assert.equal(JSON.parse(data.get(STORAGE_KEY)).records[0].checked,true,'stale unchecked snapshot cannot undo the current self-check');
 click('language');assert.equal(ctx.root.host.lang,'ko');assert.equal(focused,'language');
 act('back-map');act('lesson-1');act('reveal');click('load');click('save');assert.equal(JSON.parse(data.get(STORAGE_KEY)).records.length,2,'load preserves newer unsaved concept');
 data.set('other-project','preserve');click('reset');click('cancel-reset');assert.ok(data.get(STORAGE_KEY));click('reset');click('confirm-reset');assert.equal(data.has(STORAGE_KEY),false);assert.equal(data.get('other-project'),'preserve');assert.equal(focused,'reset');
});
