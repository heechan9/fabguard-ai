import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Evaluate the shipped router, as in skip-link.test.mjs; no copied implementation.
const source=readFileSync(new URL('../../web/app.js',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace(/\nload\(\);\s*$/,'\n');
function fixture(hash='result',tabindex=null){
 const events=[],timers=[],attributes=new Map(tabindex===null?[]:[['tabindex',tabindex]]);
 let active=null;
 const target={isConnected:true,hasAttribute:name=>attributes.has(name),setAttribute:(name,value)=>attributes.set(name,value),
  focus:options=>{assert.equal(options.preventScroll,true);active='target';events.push('focus');},
  scrollIntoView:options=>{assert.equal(options.behavior,'auto');assert.equal(options.block,'start');events.push('scroll');}};
 const location={search:'',hash:'#'+hash};
 const finish=runInNewContext(source+'\nfinishRoute;',{
  URLSearchParams,location,openDetailsForHash:value=>events.push('reveal:'+value),
  document:{documentElement:{},querySelectorAll:()=>[],querySelector:selector=>selector==='#app'?{}:['.story-section','#answer-overview','.global-section','#process'].includes(selector)?target:null},
  window:{addEventListener:()=>{},setTimeout:(callback,delay)=>{assert.equal(delay,50);events.push('schedule');timers.push(callback);},scrollTo:()=>events.push('scroll-top')}
 });
 return {finish,events,location,target,attributes,get active(){return active;},focusNavigation(){active='navigation';events.push('navigation-focus');},flush(){timers.splice(0).forEach(fn=>fn());}};
}

test('route reveals and focuses synchronously before scheduling scroll; pending scroll cannot steal keyboard focus',()=>{
 for(const hash of ['result','process','answer-overview','global']){
  const f=fixture(hash);f.finish(hash);
  assert.deepEqual(f.events,['reveal:#'+hash,'focus','schedule']);
  assert.equal(f.attributes.get('tabindex'),'-1');assert.equal(f.active,'target');
  f.focusNavigation();f.flush();
  assert.deepEqual(f.events,['reveal:#'+hash,'focus','schedule','navigation-focus','scroll']);
  assert.equal(f.active,'navigation','delayed work leaves the next keyboard action alone');
 }
});
test('newer hash invalidates old delayed target scroll and does not refocus the old target',()=>{
 const f=fixture();f.finish('result');f.location.hash='#risks';f.focusNavigation();f.flush();
 assert.deepEqual(f.events,['reveal:#result','focus','schedule','navigation-focus']);
 assert.equal(f.active,'navigation');
});
test('disconnected target cannot scroll or regain focus even if the route hash is unchanged',()=>{
 const f=fixture();f.finish('result');f.target.isConnected=false;f.focusNavigation();f.flush();
 assert.deepEqual(f.events,['reveal:#result','focus','schedule','navigation-focus']);
 assert.equal(f.active,'navigation');
});
test('existing target tabindex is preserved and stale non-anchor scroll-to-top is cancelled',()=>{
 const existing=fixture('process','0');existing.finish('process');assert.equal(existing.attributes.get('tabindex'),'0');
 const f=fixture('summary');f.finish('summary');f.location.hash='#process';f.focusNavigation();f.flush();
 assert.deepEqual(f.events,['reveal:#summary','schedule','navigation-focus']);
 const home=fixture('summary');home.location.hash='';home.finish('summary');home.flush();
 assert.deepEqual(home.events,['reveal:#summary','schedule','scroll-top']);
});
