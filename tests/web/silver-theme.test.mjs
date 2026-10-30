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
 for(const token of ['--bg:#aab6c5','--panel:#c2cdda','--outer:#99a7b8','--text:#17202e','--cyan:#00438e'])assert.ok(css.includes(token),token);
 const rgb=h=>h.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const lum=h=>rgb(h).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 for(const [fg,bg] of [['17202e','aab6c5'],['354656','aab6c5'],['00438e','c2cdda'],['00438e','aab6c5'],['00438e','b8c4d2'],['613c00','fff0d2'],['613c00','aab6c5'],['802020','f6dddd'],['802020','aab6c5'],['0b5036','c2cdda']]) assert.ok((Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05)>=4.5,fg+' on '+bg);
 assert.match(css,/\.robot-review\[data-state="waiting"\]/);
 assert.match(css,/\.robot-review\[data-state="hold"\]/);
 assert.match(css,/#viewport/);
});
test('silver component overrides outrank legacy dark component selectors',()=>{
 const css=read('web/silver.css');
 // Scope with body + page + component: (0,2,1) > legacy (0,2,0).
 for(const selector of ['body.smt-page :is(.panel,.workspace)','body.analysis-page .panel','body.smt-page .scenario-buttons button','body.smt-page .station-strip button'])assert.ok(css.includes(selector),selector);
});

test('rendered contrast scanner recognizes opaque rgb and rgba backgrounds',()=>{
 const scanner=read('verification/check_silver_ui.cjs');
 const definition=scanner.match(/const rgba=(.*?),lum=c=>/)[1];
 const rgba=Function('return ('+definition+')')();
 assert.deepEqual(rgba('rgb(0, 75, 158)'),[0,75,158,1]);
 assert.deepEqual(rgba('rgba(0, 75, 158, 0.5)'),[0,75,158,.5]);
 assert.deepEqual(rgba('rgba(0, 75, 158, 0)'),[0,75,158,0]);
 assert.deepEqual(rgba('rgba(0, 75, 158, 1)'),[0,75,158,1]);
});
test('long selected-PCB context sits below the workspace, not inside its narrow inspector',()=>{
 const html=read('web/smt/index.html');
 assert.doesNotMatch(html.match(/<aside id="board-inspector">[\s\S]*?<\/aside>/)[0],/id="context-review"/);
 assert.match(html,/<\/aside><\/section>\s*<details class="measurement-details context-review-details"/);
 assert.match(read('web/silver.css'),/\.context-hypotheses\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
