import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCSV} from '../../web/equipment/contract.mjs';
import {screenEquipmentCSV} from '../../web/equipment/screening.mjs';

const mapping={board_id:0,pad_id:1,value:2,timestamp:3,lot_id:4,recipe_id:5};
const context={equipment:'SPI-01',role:'observed',metric:'paste_height_um'};
const baseline=[99,101,99,101,99,101,99,101,99,101];
function input(values,alter=()=>{}){
  const rows=values.map((value,i)=>[String(i+1),'P01',String(value),
    new Date(Date.parse('2026-09-01T00:00:00Z')+i*1000).toISOString(),'LOT-1','R-1']);
  alter(rows);
  return parseCSV('board_id,pad_id,value,timestamp,lot_id,recipe_id\n'+rows.map(row=>row.join(',')).join('\n'));
}

test('frozen baseline connects actual mapped rows to a pending review queue',()=>{
  const report=screenEquipmentCSV(input([...baseline,100,110,90]),mapping,context,10);
  assert.equal(report.sample_count,13);
  assert.equal(report.baseline_end,'2026-09-01T00:00:09.000Z');
  assert.deepEqual(report.queue.map(r=>[r.record,r.board_id,r.screening_status,r.review_status]),
    [[12,'12','above_limit','pending'],[13,'13','below_limit','pending']]);
  assert.equal(report.spc.statuses[0],'within_limits');
  assert.equal(report.spc.center,100);
});
test('downloadable example goes through the same CSV and screening path',()=>{
  const sample=readFileSync(new URL('../../web/equipment/data/spc-synthetic.csv',import.meta.url),'utf8');
  const report=screenEquipmentCSV(parseCSV(sample),mapping,{...context,role:'synthetic'},10);
  assert.deepEqual(report.queue.map(r=>r.screening_status),['above_limit','below_limit']);
});
test('rejected rows cannot be silently dropped from time-series analysis',()=>{
  assert.throws(()=>screenEquipmentCSV(input([...baseline,110],rows=>rows[3][2]=''),mapping,context,10),/격리된 행/);
});
test('mixed process context and invalid chronology fail closed',()=>{
  const cases=[
    rows=>rows[10][1]='P02',
    rows=>rows[10][5]='R-2',
    rows=>rows[10][3]=rows[9][3],
    rows=>rows[10][3]='2026-02-30T00:00:00Z',
    rows=>rows[10][3]='2026-09-01T00:00:10',
    rows=>rows[10][4]='',
  ];
  for(const alter of cases)assert.throws(()=>screenEquipmentCSV(input([...baseline,110],alter),mapping,context,10));
});
test('baseline selection and mapping must be explicit and valid',()=>{
  const data=input([...baseline,110]);
  for(const count of [9,11,NaN,10.5])assert.throws(()=>screenEquipmentCSV(data,mapping,context,count));
  assert.throws(()=>screenEquipmentCSV(data,{...mapping,timestamp:0},context,10),/서로 다른 열/);
  assert.throws(()=>screenEquipmentCSV(data,mapping,{...context,role:''},10));
});
test('an unstable baseline blocks later interpretation',()=>{
  const report=screenEquipmentCSV(input([100,100,100,100,100,100,100,100,100,200,110]),mapping,context,10);
  assert.deepEqual(report.spc.baselineFlaggedRows,[10]);
  assert.equal(report.queue[0].screening_status,'baseline_review_required');
});
