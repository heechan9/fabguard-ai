import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {loadSource,newDocument,serializeDocument} from '../../web/review/model.mjs';
import {emptyChecklist,buildPacket} from '../../web/review/handoff-model.mjs';
import {mountHandoff} from '../../web/review/handoff-ui.mjs';

globalThis.crypto??=webcrypto;
const source=await loadSource(readFileSync(new URL('../../web/review/source.json',import.meta.url)));
const sampleId='secom_1397';
const now='2026-11-02T00:00:00.000Z';
const encoded=text=>new TextEncoder().encode(text).buffer;
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

// A narrow DOM adapter exercises the actual mounted event handlers, not layout,
// focus, native file choosers or browser timing. Those still require browser QA.
function harness(t){
 const priorDocument=globalThis.document,priorOption=globalThis.Option;
 const previousCreate=URL.createObjectURL,previousRevoke=URL.revokeObjectURL;
 const downloads=[];URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:review-test';};URL.revokeObjectURL=()=>{};
 const ids=new Map();
 class Element{
  constructor(tag){this.tagName=tag;this.listeners=new Map();this.children=[];this.options=[];this.value='';this.textContent='';this.files=[];}
  set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
  setAttribute(){}
  append(...children){this.children.push(...children);}
  add(option){this.options.push(option);if(this.options.length===1)this.value=option.value;}
  addEventListener(type,listener){this.listeners.set(type,listener);}
  click(){} remove(){}
  async fire(type){return this.listeners.get(type)?.({target:this});}
 }
 const host=new Element('section');host.id='handoff-host';
 globalThis.document={body:new Element('body'),querySelector:selector=>ids.get(selector.slice(1)),createElement:tag=>new Element(tag),addEventListener(){}};
 globalThis.Option=class{constructor(text,value){this.textContent=text;this.value=value;}};
 t.after(()=>{globalThis.document=priorDocument;globalThis.Option=priorOption;URL.createObjectURL=previousCreate;URL.revokeObjectURL=previousRevoke;});
 const state={source,current:newDocument(source,sampleId),sampleId,language:'en',draftDirty:false};
 const accepted=[],dirty=[];
 mountHandoff({getState:()=>state,acceptReview:review=>{accepted.push(review);state.current=review;},markDirty:value=>dirty.push(value)});
 const file=ids.get('import-handoff'),status=ids.get('handoff-status');
 const select=input=>{file.files=input?[input]:[];return file.fire('change');};
 const packet=(note='new packet')=>{const rows=emptyChecklist();rows[0].note=note;return buildPacket(state.current,rows,source,sampleId,now);};
 return {ids,state,accepted,dirty,status,select,packet,downloads};
}
const fileFrom=packet=>{const bytes=encoded(serializeDocument(packet));return {size:bytes.byteLength,arrayBuffer:async()=>bytes};};

test('superseded rejected read cannot overwrite a newer successful handoff status',async t=>{
 const h=harness(t),slow=deferred();
 const pending=h.select({size:5,arrayBuffer:()=>slow.promise});
 await h.select(fileFrom(h.packet()));
 const status=h.status.textContent,current=serializeDocument(h.state.current);
 assert.match(status,/loaded/);
 slow.reject(new Error('old disk read failed'));await pending;
 assert.equal(h.status.textContent,status);
 assert.equal(serializeDocument(h.state.current),current);
 assert.equal(h.ids.get('handoff-note-physical_mapping').value,'new packet');
 assert.equal(h.accepted.length,1);
});

test('superseded malformed UTF-8 cannot replace the current successful status',async t=>{
 const h=harness(t),slow=deferred();
 const pending=h.select({size:1,arrayBuffer:()=>slow.promise});
 await h.select(fileFrom(h.packet()));const status=h.status.textContent;
 slow.resolve(new Uint8Array([255]).buffer);await pending;
 assert.equal(h.status.textContent,status);assert.equal(h.accepted.length,1);
});

test('a newer checklist edit invalidates a pending read failure without erasing inputs',async t=>{
 const h=harness(t),slow=deferred();
 const pending=h.select({size:5,arrayBuffer:()=>slow.promise});
 const note=h.ids.get('handoff-note-physical_mapping');note.value='new unsaved checklist';await note.fire('input');
 const status=h.status.textContent;
 slow.reject(new Error('obsolete read failure'));await pending;
 assert.equal(h.status.textContent,status);assert.equal(note.value,'new unsaved checklist');
 assert.equal(h.dirty.at(-1),true);assert.equal(h.accepted.length,0);
});

test('a newer empty-file change invalidates an older pending read failure',async t=>{
 const h=harness(t),slow=deferred();
 const pending=h.select({size:5,arrayBuffer:()=>slow.promise});
 await h.select(null);const status=h.status.textContent;
 slow.reject(new Error('obsolete read failure'));await pending;
 assert.equal(h.status.textContent,status);assert.equal(h.accepted.length,0);
});

test('latest failed read still reports the error and preserves current contents',async t=>{
 const h=harness(t);await h.select(fileFrom(h.packet('preserved checklist')));
 const before=serializeDocument(h.state.current);
 await h.select({size:5,arrayBuffer:async()=>{throw Error('current disk read failed');}});
 assert.match(h.status.textContent,/Handoff withheld: current disk read failed/);
 assert.equal(h.ids.get('handoff-note-physical_mapping').value,'preserved checklist');
 assert.equal(serializeDocument(h.state.current),before);assert.equal(h.accepted.length,1);
});

test('a slow older successful read cannot replace a newer imported checklist',async t=>{
 const h=harness(t),slow=deferred(),old=h.packet('old packet');
 const pending=h.select({size:1,arrayBuffer:()=>slow.promise});
 await h.select(fileFrom(h.packet('latest packet')));const status=h.status.textContent;
 slow.resolve(encoded(serializeDocument(old)));await pending;
 assert.equal(h.ids.get('handoff-note-physical_mapping').value,'latest packet');
 assert.equal(h.status.textContent,status);assert.equal(h.accepted.length,1);
});

test('current dirty and review-draft guards still reject an import',async t=>{
 const h=harness(t),input=fileFrom(h.packet());h.state.draftDirty=true;
 await h.select(input);assert.match(h.status.textContent,/Append existing/);assert.equal(h.accepted.length,0);
 h.state.draftDirty=false;
 const note=h.ids.get('handoff-note-physical_mapping');note.value='unexported input';await note.fire('input');
 await h.select(input);assert.match(h.status.textContent,/Export the current checklist/);
 assert.equal(note.value,'unexported input');assert.equal(h.accepted.length,0);
});

test('TXT export uses current checklist but does not clear the full-JSON dirty warning',async t=>{
 const h=harness(t),note=h.ids.get('handoff-note-physical_mapping');
 note.value='latest location';await note.fire('input');
 await h.ids.get('export-handoff-summary').fire('click');
 assert.equal(h.downloads.length,1);const text=await h.downloads[0].text();
 assert.ok(text.includes('latest location'));assert.match(text,/Save the JSON handoff/);
 assert.equal(h.dirty.at(-1),true);assert.match(h.status.textContent,/Also save JSON/);
 await h.select(fileFrom(h.packet()));assert.match(h.status.textContent,/Export the current checklist/);
});

test('unrecorded review input blocks TXT and JSON exports alike',async t=>{
 const h=harness(t);h.state.draftDirty=true;
 await h.ids.get('export-handoff-summary').fire('click');
 assert.equal(h.downloads.length,0);assert.match(h.status.textContent,/Append existing/);
 await h.ids.get('export-handoff').fire('click');assert.equal(h.downloads.length,0);
});

test('a later TXT request invalidates a stale file-read error without importing it',async t=>{
 const h=harness(t),slow=deferred();
 const pending=h.select({size:5,arrayBuffer:()=>slow.promise});
 await h.ids.get('export-handoff-summary').fire('click');const status=h.status.textContent;
 slow.reject(Error('old error'));await pending;
 assert.equal(h.status.textContent,status);assert.equal(h.accepted.length,0);assert.equal(h.downloads.length,1);
});
