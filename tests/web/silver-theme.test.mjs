import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('silver theme is loaded after page styles in all three entry pages',()=>{
 for(const p of ['index.html','secom/index.html','smt/index.html']) {
  const head=read('web/'+p).split('</head>')[0];
  assert.match(head,/href="\/silver.css"/);
  assert.ok(head.lastIndexOf('/silver.css')>head.lastIndexOf('/readability.css'));
 }
});
test('silver tokens retain contrasting text and distinct semantic states',()=>{
 const css=read('web/silver.css');
 for(const token of ['--bg:#b8c2ce','--panel:#d1d9e2','--outer:#a7b3c1','--text:#17202e','--cyan:#004b9e'])assert.ok(css.includes(token),token);
 const rgb=h=>h.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const lum=h=>rgb(h).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 for(const [fg,bg] of [['17202e','b8c2ce'],['405161','b8c2ce'],['004b9e','d1d9e2'],['004b9e','b8c2ce'],['004b9e','c5cfda'],['805000','fff0d2'],['a32727','f6dddd'],['116143','d1d9e2']]) assert.ok((Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05)>=4.5,fg+' on '+bg);
 assert.match(css,/\.robot-review\[data-state="waiting"\]/);
 assert.match(css,/\.robot-review\[data-state="hold"\]/);
 assert.match(css,/#viewport/);
});
test('silver component overrides outrank legacy dark component selectors',()=>{
 const css=read('web/silver.css');
 // Scope with body + page + component: (0,2,1) > legacy (0,2,0).
 for(const selector of ['body.smt-page :is(.panel,.workspace)','body.analysis-page .panel','body.smt-page .scenario-buttons button','body.smt-page .station-strip button'])assert.ok(css.includes(selector),selector);
});
