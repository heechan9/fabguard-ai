import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function boot(saved,blocked=false){
 const callbacks={},events={},windowEvents={},attrs={},writes=[];
 const root={dataset:{},lang:'ko',style:{},setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k];}};
 const button={textContent:'',setAttribute(k,v){attrs[k]=String(v);},getAttribute(k){return attrs[k];},addEventListener(k,fn){events[k]=fn;}};
 const document={documentElement:root,readyState:'loading',querySelector:s=>s==='#theme-toggle'||s==='.theme-toggle'?button:null,getElementById:id=>id==='theme-toggle'?button:null,addEventListener(k,fn){callbacks[k]=fn;}};
 let observer;
 const context={document,localStorage:{getItem(k){if(blocked)throw Error('blocked');return k==='fabguard-theme'?saved:null;},setItem(k,v){if(blocked)throw Error('blocked');writes.push([k,v]);saved=v;}},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},window:{addEventListener(k,fn){windowEvents[k]=fn;}}};
 vm.runInNewContext(read('web/theme.js'),context);
 return {root,button,attrs,writes,restore:(value,persisted=true)=>{saved=value;windowEvents.pageshow?.({persisted});},ready:()=>callbacks.DOMContentLoaded?.(),click:()=>events.click(),language:lang=>{root.lang=lang;observer?.();}};
}
test('theme bootstraps before styles on all shared silver pages',()=>{
 for(const p of ['index.html','smt/index.html','secom/index.html']){
  const html=read('web/'+p),head=html.split('</head>')[0];
  assert.match(head,/<script src="\/theme.js"><\/script>/);
  assert.ok(head.indexOf('/theme.js')<head.indexOf('rel="stylesheet"'));
  assert.match(html,/id="theme-toggle"/);
 }
});
test('default, invalid and unavailable preferences choose silver before DOM ready',()=>{
 for(const [saved,blocked] of [[null,false],['invalid',false],['DARK',false],['dark',true]])assert.equal(boot(saved,blocked).root.dataset.theme,'silver');
 assert.equal(boot('dark').root.dataset.theme,'dark');
 assert.equal(boot('silver').root.dataset.theme,'silver');
});
test('theme toggle persists only theme, remains accessible, and works repeatedly',()=>{
 const app=boot(null);app.ready();assert.equal(app.attrs['aria-pressed'],'false');
 assert.match(app.button.textContent,/실버.*다크/);assert.ok(app.attrs['aria-label']);
 for(const mode of ['dark','silver','dark','silver']){app.click();assert.equal(app.root.dataset.theme,mode);assert.equal(app.attrs['aria-pressed'],String(mode==='dark'));assert.deepEqual(app.writes.at(-1),['fabguard-theme',mode]);}
});
test('blocked storage does not prevent toggling and language changes do not reset theme',()=>{
 const app=boot('dark',true);app.ready();app.click();assert.equal(app.root.dataset.theme,'dark');
 app.language('en');assert.match(app.button.textContent,/Silver.*Dark/);assert.equal(app.root.dataset.theme,'dark');
 app.language('ko');assert.match(app.button.textContent,/실버.*다크/);assert.equal(app.root.dataset.theme,'dark');
});

test('back-forward cache restore reconciles saved theme but blocked storage retains current choice',()=>{
 const app=boot('silver');app.ready();app.restore('dark');assert.equal(app.root.dataset.theme,'dark');assert.equal(app.attrs['aria-pressed'],'true');
 app.restore('invalid');assert.equal(app.root.dataset.theme,'silver');
 app.restore('dark',false);assert.equal(app.root.dataset.theme,'silver');
 const blocked=boot(null,true);blocked.ready();blocked.click();blocked.restore('silver');assert.equal(blocked.root.dataset.theme,'dark');
});
