import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseCSV,validateCSV,fields,decodeCSVBytes,CSV_LIMITS} from '../../web/equipment/contract.mjs';
const source=readFileSync(new URL('../../web/equipment/app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const csv=readFileSync(new URL('../../web/equipment/data/spc-synthetic.csv',import.meta.url));
function harness(){
 const element=()=>({value:'',textContent:'',hidden:true,files:[],listeners:{},children:[],addEventListener(name,callback){this.listeners[name]=callback;},replaceChildren(){this.children=[];},append(node){this.children.push(node);},add(){}});
 const elements={};
 const get=id=>elements[id]??(elements[id]=element());
 runInNewContext(source,{document:{getElementById:get,createElement:element},Option:function(){},TextEncoder,parseCSV,validateCSV,fields,decodeCSVBytes,CSV_LIMITS,renderEquipmentScreening(){}});
 function select(name='synthetic.csv'){
  let resolve;
  get('file').files=[{name,size:csv.length,arrayBuffer:()=>new Promise(done=>{resolve=done;})}];
  const done=get('file').listeners.change();
  return {done,finish:()=>resolve(Uint8Array.from(csv).buffer)};
 }
 return {get,select};
}
test('late form change invalidates reports without silently cancelling a selected CSV read',async()=>{
 const {get,select}=harness();const read=select();
 get('mapping-panel').listeners.change(); // A dirty focused input may commit as reset hides it.
 get('mapping-panel').listeners.input();
 read.finish();await read.done;
 assert.equal(get('mapping-panel').hidden,false);
 assert.match(get('file-status').textContent,/synthetic.csv · 13행 · 6열/);
});
test('clear during a pending CSV read keeps the cleared screen',async()=>{
 const {get,select}=harness();const read=select();
 get('clear').listeners.click();read.finish();await read.done;
 assert.equal(get('mapping-panel').hidden,true);assert.equal(get('file-status').textContent,'');
});
test('a newer selected file wins even if the previous read finishes last',async()=>{
 const {get,select}=harness();const old=select('old.csv');const current=select('new.csv');
 current.finish();await current.done;old.finish();await old.done;
 assert.equal(get('mapping-panel').hidden,false);
 assert.match(get('file-status').textContent,/^new.csv · 13행/);
});
