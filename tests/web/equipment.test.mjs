import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EQUIPMENT,EQUIPMENT_SOURCE} from '../../web/smt/equipment.mjs';
import {STATIONS} from '../../web/smt/simulation.mjs';
test('school reference covers all existing stations without inventing dimensions',()=>{
  assert.equal(EQUIPMENT.length,STATIONS.length);
  assert.equal(new Set(EQUIPMENT.map(e=>e.id)).size,11);
  assert.equal(EQUIPMENT[2].model,'MS-11E');
  assert.equal(EQUIPMENT[8].model,'MV-6e OMNI');
  assert.equal(EQUIPMENT[6].pcbSize,'560');
  assert.equal(EQUIPMENT[3].maker,'YAHAMA');
  assert.equal(EQUIPMENT[4].model,'YSM-10');
  assert.match(EQUIPMENT_SOURCE.archiveSha256,/^[a-f0-9]{64}$/);
});
test('download examples keep missing measurements and unknown inspections explicit',()=>{
  const read=name=>readFileSync(new URL(`../../web/smt/data/${name}`,import.meta.url),'utf8').trim().split('\n');
  const template=read('inspection-template.csv');
  const [header,...rows]=read('inspection-synthetic-example.csv');
  assert.deepEqual(template,[header]);
  const keys=header.split(',');
  const records=rows.map(row=>{const values=row.split(',');assert.equal(values.length,keys.length);return Object.fromEntries(keys.map((k,i)=>[k,values[i]]));});
  assert.equal(new Set(records.map(r=>r.event_id)).size,records.length);
  for(const r of records){assert.equal(r.data_source,'synthetic');assert.ok(EQUIPMENT.some(e=>e.id===r.station_id));assert.ok(Number.isFinite(Date.parse(r.event_time)));}
  const missing=records.find(r=>r.missing_reason);
  assert.equal(missing.value,'');
  assert.equal(records.find(r=>r.board_id===missing.board_id&&r.record_type==='inspection').inspection_result,'unknown');
});
