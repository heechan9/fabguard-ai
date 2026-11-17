import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {lessons} from '../../web/learn/content.mjs';
const source=fs.readFileSync(new URL('../../web/learn/app.mjs',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function reviewNote(l){'),source.indexOf('function explanation(l){'));
function render(l,lang){return vm.runInNewContext(fn+';reviewNote(l)',{reviewNoteOpen:false,reviewReferenceOpen:false,l,t:(ko,en)=>lang==='ko'?ko:en,p:v=>v[lang],escape:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});}
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
