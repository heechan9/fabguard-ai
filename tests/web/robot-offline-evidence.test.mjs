import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {REPORT_SHA256, summarizeOfflineReport} from '../../web/robot/offline-evidence.mjs';
import {REPORT_TEXT} from '../../web/robot/offline-report-data.mjs';
const bytes=readFileSync(new URL('../../web/robot/offline-report.json',import.meta.url));
const original=readFileSync(new URL('../../docs/review/pr173-validation-20261024/robot_spc_results/report.json',import.meta.url));
const report=()=>JSON.parse(bytes);
test('served actual report is byte-identical to historical Python evidence, without rerunning analysis',()=>{
 assert.deepEqual(bytes,original);
 assert.equal(REPORT_TEXT,bytes.toString('utf8'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),REPORT_SHA256);
 const result=summarizeOfflineReport(report());
 assert.equal(result.complete,1043);assert.equal(result.evaluable,1043);assert.equal(result.groups,2);
 assert.deepEqual(result.alarms,[9,0,3]);assert.equal(result.rows.length,7);
 assert.ok(Object.values(result.performance).every(v=>v===null));
});
test('missing results, malformed counts and claimed performance fail closed rather than showing zero alarms',()=>{
 for(const mutate of [r=>delete r.evaluation_files[0].methods.ewma,
  r=>r.evaluation_files[0].methods.ewma.raw_alarms=null,
  r=>r.evaluation_files[0].methods.ewma.raw_alarms=-1,
  r=>r.evaluation_files[0].methods.ewma.status='unavailable_calibration_failed',
  r=>r.evaluation_files[0].windows_evaluable=150,
  r=>r.evaluation_files.push(r.evaluation_files[0]),
  r=>r.performance.false_alarm_rate=0,
  r=>r.flags=[],r=>r.run_status='reference_invalid']){
   const r=report();mutate(r);assert.throws(()=>summarizeOfflineReport(r));
 }
});
test('input-quality exclusion remains separate from zero recorded alarms',()=>{
 const r=report();r.evaluation_files[0].windows_evaluable=148;
 r.evaluation_files[0].windows_excluded={timestamp_gap:1};r.evaluation_files[0].n_gaps=1;
 const row=summarizeOfflineReport(r).rows[0];
 assert.equal(row.excluded,1);assert.deepEqual(row.reasons,[['timestamp_gap',1]]);
 assert.deepEqual(row.alarms,[0,0,0]);
});
