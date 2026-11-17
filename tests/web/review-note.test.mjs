import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {lessons} from '../../web/learn/content.mjs';
const source=fs.readFileSync(new URL('../../web/learn/app.mjs',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function reviewNote(l){'),source.indexOf('function explanation(l){'));
// Execute the production escape declaration, not a test-side reimplementation.
const escapeDeclaration=source.match(/^const escape=.*;$/m)?.[0];
assert.ok(escapeDeclaration,'Production escape declaration must be present');
function render(l,lang){return vm.runInNewContext(escapeDeclaration+'\n'+fn+';reviewNote(l)',{reviewNoteOpen:false,reviewReferenceOpen:false,l,t:(ko,en)=>lang==='ko'?ko:en,p:v=>v[lang]});}

for(const lang of ['ko','en'])for(const lesson of lessons)test(`Review note preserves exact evidence and limits: ${lang}/${lesson.id}`,()=>{
 const html=render(lesson,lang);
 for(const key of ['observation','limit','next'])assert.ok(html.includes(lesson[key][lang]));
 assert.equal((html.match(/<details[ >]/g)||[]).length,2);assert.equal((html.match(/<summary>/g)||[]).length,2);
 assert.doesNotMatch(html,/<(?:input|textarea|canvas|img)|contenteditable|autofocus|<details[^>]+open/);
});
test('Review notes escape evidence markup',()=>{
 const l={...lessons[0],observation:{ko:'<img src=x onerror=x>&"',en:'x'}};
 const html=render(l,'ko');assert.ok(html.includes('&lt;img'));assert.doesNotMatch(html,/<img/);
});
test('Review notes are optional, state-free, and integrated after explanation',()=>{
 assert.doesNotMatch(fn,/localStorage|fetch\(|records|\.checked|addEventListener/);
 assert.match(source,/\$\{reviewNote\(l\)\}/);
 assert.match(render(lessons[0],'en'),/Handwriting and colour are not required/);
 assert.match(render(lessons[0],'en'),/does not collect or save notes/);
});
test('Optional browser workflow watches review-note-only test changes on PR and main',()=>{
 const workflow=fs.readFileSync(new URL('../../.github/workflows/optional-learning-ui.yml',import.meta.url),'utf8');
 const pathLines=workflow.split('\n').filter(line=>line.trim().startsWith('paths:'));
 assert.equal(pathLines.length,2);
 for(const line of pathLines)assert.ok(line.includes("'tests/web/review-note.test.mjs'"));
});
test('Browser harness reset/reopen action sequence respects retained lesson state',()=>{
 const script=fs.readFileSync(new URL('../../verification/check_learning_mode.cjs',import.meta.url),'utf8');
 const start=script.indexOf("await page.locator('#confirm-reset').click();");
 const end=script.indexOf('await page.goBack()',start);
 assert.ok(start>=0&&end>start);
 // Narrow source-contract model: single-quoted literal click selectors only.
 // This is not a JS parser or browser test. Fail closed if the expected sequence
 // changes quoting/count; template/dynamic selectors and focus are not modeled.
 const clicks=[...script.slice(start,end).matchAll(/page\.locator\('([^']+)'\)\.click\(\)/g)];
 assert.equal(clicks.length,5,'Update the explicit state model if harness quoting/sequence changes');
 let screen='probe';
 for(const [,selector] of clicks){
  if(selector==='[data-action="skip-probe"]'){assert.equal(screen,'probe','probe button absent after lesson-preserving reopen');screen='map';}
  if(selector==='[data-action="lesson-0"]'){assert.equal(screen,'map');screen='lesson';}
  if(selector==='[data-action="reveal"]')assert.equal(screen,'lesson');
  // Escape/reopen preserves the screen; it does not recreate probe state.
 }
 assert.equal(screen,'lesson');
});
