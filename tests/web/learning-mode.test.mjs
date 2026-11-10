// Ported safeguards from the earlier standalone draft to the single modal core.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessons} from '../../web/learn/content.mjs';
import {blankRecord,validateRecords,mergeRecords,saveRecords,loadRecords,clearRecords,STORAGE_KEY} from '../../web/learn/core.mjs';
test('three probes, bounded hints and distinct new cases retain the original learning scope',()=>{
 assert.equal(lessons.length,3);assert.equal(new Set(lessons.map(c=>c.id)).size,3);
 for(const c of lessons){assert.equal(c.hints.length,2);assert.notEqual(c.scene.ko,c.transfer.ko);assert.ok(c.probeOptions[c.correct]);assert.ok(c.options[c.correct]);assert.ok(c.reasons[c.correct]);}
});
test('records remain five fields and self-confirmation is not inferred from a correct answer',()=>{
 for(const c of lessons){const row=blankRecord(c);assert.equal(row.checked,false);assert.deepEqual(Object.keys(row).sort(),['checked','concept','evidence','misconception','source']);}
 const app=readFileSync(new URL('../../web/learn/app.mjs',import.meta.url),'utf8');assert.match(app,/action==='confirm'/);assert.doesNotMatch(app,/checked\s*=\s*exercise\./);
});
test('strict record validation rejects private/free fields and foreign evidence or sources',()=>{
 const row=blankRecord(lessons[0]);for(const bad of [[{...row,personal:'secret'}],[{...row,checked:'expert'}],[{...row,source:'https://private.example'}],[row,row],[{...row,evidence:'<script>'}],{}])assert.throws(()=>validateRecords(bad));
});
test('explicit snapshots never autosave and reset touches only the selected feature key',()=>{
 const data=new Map([['unrelated','keep']]),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const rows=[blankRecord(lessons[0])];assert.deepEqual(loadRecords(store),[]);assert.equal(data.has(STORAGE_KEY),false);saveRecords(store,rows);rows[0].checked=true;assert.equal(loadRecords(store)[0].checked,false);
 clearRecords(store);assert.equal(data.get('unrelated'),'keep');data.set(STORAGE_KEY,'x'.repeat(2501));assert.throws(()=>loadRecords(store));assert.throws(()=>saveRecords({setItem(){throw Error('blocked')}},rows));
});
test('stale restores preserve newer checks and newly viewed concepts without mutating either input',()=>{
 const current=[{...blankRecord(lessons[0]),checked:true},blankRecord(lessons[1])],old=[blankRecord(lessons[0]),blankRecord(lessons[2])];
 const before=JSON.stringify([current,old]);const merged=mergeRecords(current,old);assert.equal(merged.length,3);assert.equal(merged.find(r=>r.concept===lessons[0].id).checked,true);assert.equal(JSON.stringify([current,old]),before);assert.throws(()=>mergeRecords(current,[{private:'text'}]));
});
