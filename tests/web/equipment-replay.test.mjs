import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV} from '../../web/equipment/contract.mjs';
import {screenEquipmentCSV} from '../../web/equipment/screening.mjs';
import {compareScreeningResults} from '../../web/equipment/replay.mjs';

const values=[99,101,99,101,99,101,99,101,99,101,110,90];
const rows=values.map((value,i)=>[String(i+1),'P01',String(value),new Date(Date.UTC(2026,8,1,0,0,i)).toISOString(),'LOT-1','R-1']);
const csv='board_id,pad_id,value,timestamp,lot_id,recipe_id\n'+rows.map(row=>row.join(',')).join('\n');
const mapping={board_id:0,pad_id:1,value:2,timestamp:3,lot_id:4,recipe_id:5};
const context={equipment:'SPI-01',role:'synthetic',metric:'paste_height_um'};
const digest='a'.repeat(64);
function snapshot(){
  return {schema_version:'fabguard-equipment-csv-screening/v1',source_sha256:digest,
    ...screenEquipmentCSV(parseCSV(csv),mapping,context,10)};
}
function copy(value){return structuredClone(value);}

test('replayed output matches when same CSV and settings produce the same result',()=>{
  assert.deepEqual(compareScreeningResults(snapshot(),snapshot()),
    {status:'MATCH',changed_measures:[],changed_record_count:0,changed_records_preview:[]});
});
test('source bytes and analysis settings must match before output is compared',()=>{
  const before=snapshot(),after=snapshot();
  after.source_sha256='b'.repeat(64);after.equipment_id='SPI-02';
  assert.deepEqual(compareScreeningResults(before,after),
    {status:'NOT_COMPARABLE',changed_inputs:['source_sha256','equipment_id']});
});
test('status and queue mutations from a rerun are reported without declaring improvement',()=>{
  const before=snapshot(),after=copy(before);
  after.spc.statuses[0]='within_limits';after.queue.shift();
  const comparison=compareScreeningResults(before,after);
  assert.equal(comparison.status,'OUTPUT_CHANGED');
  assert.deepEqual(comparison.changed_measures,['statuses']);
  assert.deepEqual(comparison.changed_records_preview,[11]);
  assert.equal(comparison.changed_record_count,1);
});
test('changed control limits are detected even when the queue is identical',()=>{
  const before=snapshot(),after=copy(before);after.spc.ucl+=0.1;
  assert.deepEqual(compareScreeningResults(before,after).changed_measures,['ucl']);
  after.spc.meanMovingRange+=0.1;
  assert.deepEqual(compareScreeningResults(before,after).changed_measures,['ucl','meanMovingRange']);
});
test('malformed previous exports and invented review decisions fail closed',()=>{
  const before=snapshot();
  for(const mutate of [
    x=>{x.schema_version='unknown';},x=>{x.source_sha256='wrong';},
    x=>{x.queue[0].review_status='approved';},x=>{x.queue.push(copy(x.queue[0]));},
    x=>{x.spc.statuses=[];},x=>{x.spc.center=NaN;},
    x=>{x.spc.statuses[0]='approved';},x=>{x.spc.baselineFlaggedRows=[10,10];}
  ]){const bad=copy(before);mutate(bad);assert.throws(()=>compareScreeningResults(bad,before));}
});
