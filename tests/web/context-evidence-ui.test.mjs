import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEvidencePanel} from '../../web/equipment/context-evidence-ui.mjs';
const raw=fs.readFileSync(new URL('../../web/equipment/data/maintenance-synthetic.json',import.meta.url),'utf8');
const parsed=JSON.parse(raw);
function fixture(){
 const nodes=new Map();
 function element(){return {value:'',textContent:'',hidden:true,disabled:false,children:[],listeners:{},addEventListener(k,f){this.listeners[k]=f},replaceChildren(){this.children=[]},append(x){this.children.push(x)},click(){this.clicked=true}};}
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},createElement:element};
 let source={raw,reviewId:parsed.observations[0].review_id};
 const panel=createEvidencePanel(()=>source,doc);panel.reset(true);
 return {panel,source,doc,$:id=>doc.getElementById('evidence-'+id),changeSource:v=>source=v};
}
test('empty UI output stays unverified and original decision untouched',async()=>{
 const f=fixture();await f.$('build').listeners.click();assert.equal(f.$('export').disabled,false);
 assert.match(f.$('status').textContent,/검증 안 함.*판단 안 함/);assert.equal(f.$('gaps').children.length>=3,true);
 assert.equal(f.source.raw,raw);
});
test('any edit disables stale export and removes old output',async()=>{
 for(const field of ['signal','measured','available','sites','claim','hypotheses','verification_plan','side_effect_check','verification_evidence_ref']){
 const f=fixture();await f.$('build').listeners.click();f.$(field).listeners.input();
 assert.equal(f.$('export').disabled,true);assert.equal(f.$('gaps').children.length,0);
 }
});
test('export preserves declared follow-up fields and resets them on target changes',async()=>{
 const f=fixture();
 const fields={verification_plan:'같은 조건 비교',side_effect_check:'누락 수 확인',verification_evidence_ref:'SYNTH-01'};
 for(const [field,value] of Object.entries(fields)) f.$(field).value=value;
 await f.$('build').listeners.click();
 const original=URL.createObjectURL;
 let output;
 try {
  URL.createObjectURL=blob=>{output=blob; return 'blob:synthetic';};
  f.$('export').listeners.click();
  const json=JSON.parse(await output.text());
  for(const [field,value] of Object.entries(fields)) assert.equal(json.declared_annotation[field],value);
  assert.equal(json.operational_decision,'NOT_MADE');
 } finally {URL.createObjectURL=original;}
 f.panel.reset(true);
 for(const field of Object.keys(fields)) assert.equal(f.$(field).value,'');
});
test('target/file reset clears annotation and invalidates pending hash result',async()=>{
 const f=fixture();f.$('hypotheses').value='candidate';const pending=f.$('build').listeners.click();
 f.panel.reset(false);await pending;assert.equal(f.$('export').disabled,true);assert.equal(f.$('panel').hidden,true);assert.equal(f.$('hypotheses').value,'');
});
test('malformed time does not leave downloadable previous output',async()=>{
 const f=fixture();await f.$('build').listeners.click();f.$('measured').value='bad';await f.$('build').listeners.click();assert.equal(f.$('export').disabled,true);assert.match(f.$('status').textContent,/정리 보류/);
});
test('late availability and causal claim keep all warnings',async()=>{
 const f=fixture();f.$('available').value='2099-01-01T00:00:00Z';f.$('claim').value='causal_effect';await f.$('build').listeners.click();
 assert.match(f.$('gaps').children.map(n=>n.textContent).join(' '),/당시 근거로.*입증되지 않음/);
});
test('late declared measurement warns in Korean even with blank availability',async()=>{
 const f=fixture();f.$('measured').value='2026-09-01T00:20:00.000001Z';
 await f.$('build').listeners.click();
 const warnings=f.$('gaps').children.map(n=>n.textContent);
 assert.ok(warnings.some(w=>/계측 시각이 판단 정보 시점보다 늦어/.test(w)));
 assert.ok(warnings.some(w=>/조회 가능 시각 미확인/.test(w)));
});
test('site count rejects badInput and nondecimal syntax while blank remains null',async t=>{
 const f=fixture();const input=f.$('sites');
 let output;
 t.mock.method(URL,'createObjectURL',blob=>{output=blob;return 'blob:synthetic';});
 await f.$('build').listeners.click();
 f.$('export').listeners.click();
 assert.equal(JSON.parse(await output.text()).declared_annotation.measurement_sites,null);

 for(const [value,badInput] of [['',true],['1e1',false],['2.5',false],['-2',false],['0',false],[' ',false],['9007199254740993',false]]){
  input.value=value;input.validity={badInput};
  await f.$('build').listeners.click();
  assert.equal(f.$('export').disabled,true,value);
  assert.match(f.$('status').textContent,/1 이상의 정수/);
 }
 input.value='10';input.validity={badInput:false};
 await f.$('build').listeners.click();
 f.$('export').listeners.click();
 assert.equal(JSON.parse(await output.text()).declared_annotation.measurement_sites,10);
});
test('HTML-like hypothesis is data and not an executable DOM insertion',async()=>{
 const f=fixture();f.$('hypotheses').value='<img src=x onerror=alert(1)>';await f.$('build').listeners.click();assert.equal(f.$('export').disabled,false);assert.equal(f.$('gaps').children.some(n=>'innerHTML' in n),false);
});
