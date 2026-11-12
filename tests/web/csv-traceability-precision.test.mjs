import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV, validateCSV, CSV_LIMITS} from '../../web/equipment/contract.mjs';
import {screenEquipmentCSV} from '../../web/equipment/screening.mjs';
import {tableToSeries} from '../../web/robot/window-core.mjs';

const mapping={board_id:0,pad_id:1,value:2,timestamp:3,lot_id:4,recipe_id:5};
const context={equipment:'SPI',role:'synthetic',metric:'paste_height_um'};
const header='board_id,pad_id,value,timestamp,lot_id,recipe_id';
const baseline=Array.from({length:10},(_,i)=>[
  'B'+i,'P',i%2 ? 101:99,`2026-09-01T00:00:0${i}Z`,'L','R'].join(','));
function dataWithTimes(times) {
  return parseCSV([header,...baseline,...times.map((t,i)=>`M${i},P,110,${t},L,R`)].join('\n'));
}
test('empty structured records are retained and quarantined with source positions',()=>{
  for(const empty of [',,,,,','"","","","","",""']) {
    const text=[header,...baseline.slice(0,5),'',empty,...baseline.slice(5),
      'M,P,110,2026-09-01T00:00:10Z,L,R'].join('\r\n');
    const data=parseCSV(text), checked=validateCSV(data,mapping,context);
    assert.equal(data.rows.length,12);
    assert.equal(checked.accepted.length,11);
    assert.equal(checked.rejected.length,1);
    assert.equal(checked.rejected[0].record,6);
    assert.equal(checked.rejected[0].source_line,8);
    assert.equal(data.sourceLines.at(-1),14);
    assert.throws(()=>screenEquipmentCSV(data,mapping,context,10),/격리된 행 1개/);
  }
});
test('quoted empty single field is not a physically empty line',()=>{
  const data=parseCSV('a\n\n""\n');
  assert.deepEqual(data.rows,[['']]);
  assert.deepEqual(data.sourceLines,[3]);
});
test('source lines track quoted CRLF/newlines, blank lines and EOF without newline',()=>{
  const data=parseCSV('\uFEFF\na,b\r\n"x\r\ny",1\r\n\r\n,');
  assert.deepEqual(data.sourceLines,[3,6]);
});
test('empty structured records count toward row bounds',()=>{
  assert.equal(parseCSV('a,b\n'+',\n'.repeat(CSV_LIMITS.rows)).rows.length,CSV_LIMITS.rows);
  assert.throws(()=>parseCSV('a,b\n'+',\n'.repeat(CSV_LIMITS.rows+1)),/20,000/);
});
test('equipment queue source position includes ignored blank lines',()=>{
  const data=dataWithTimes(['2026-09-01T00:00:10Z']);
  const csv=[header,'',...data.rows.map(row=>row.join(','))].join('\n');
  const report=screenEquipmentCSV(parseCSV(csv),mapping,context,10);
  assert.equal(report.queue[0].record,11);
  assert.equal(report.queue[0].source_line,13);
});
test('robot shared parser fails closed on empty records with original source line',()=>{
  // Robot contract uses numeric seconds, not the equipment ISO time contract.
  const data=parseCSV('Time,A_x [g],A_y [g],A_z [g]\n0,1,2,3\n\n,,,\n1,2,3,4');
  const report=tableToSeries(data);
  assert.deepEqual(report.reasons,['time_nonfinite_or_nonnumeric:4']);
  assert.equal(report.times,null);
});
test('increasing submillisecond instants are accepted without truncation',()=>{
  for(const times of [
    ['2026-09-01T00:00:10.123456Z','2026-09-01T00:00:10.123789Z'],
    ['2026-09-01T00:00:10.0000000000000000001Z','2026-09-01T00:00:10.0000000000000000002Z'],
    ['2026-09-01T00:00:10.999999Z','2026-09-01T00:00:11Z'],
    ['2026-09-01T09:00:10.123456+09:00','2026-08-31T20:00:10.123789-04:00'],
  ]) assert.equal(screenEquipmentCSV(dataWithTimes(times),mapping,context,10).sample_count,12);
});
test('equal and reversed precise instants fail closed including differing offsets',()=>{
  for(const times of [
    ['2026-09-01T00:00:10.123789Z','2026-09-01T00:00:10.123456Z'],
    ['2026-09-01T00:00:10.1234Z','2026-09-01T00:00:10.1234000Z'],
    ['2026-09-01T09:00:10.123456+09:00','2026-09-01T00:00:10.123456Z'],
    ['2026-09-01T00:00:10Z','2026-09-01T00:00:10.000Z'],
    ['2026-09-01T00:00:11Z','2026-09-01T09:00:10.999999+09:00'],
  ]) assert.throws(()=>screenEquipmentCSV(dataWithTimes(times),mapping,context,10),/시각이 중복되거나 역순/);
});
