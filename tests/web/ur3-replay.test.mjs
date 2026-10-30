import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateDataset,computeAudit,rowState,tracePoints,nextRecord,SENSOR_INDICES} from '../../web/robot/ur3/core.mjs';
import {DATA_SHA256} from '../../web/robot/ur3/data-hash.mjs';
const raw=readFileSync(new URL('../../web/robot/ur3/data.json',import.meta.url)),data=JSON.parse(raw);
test('official derived records retain hashes, row order, missingness and recorded outcomes',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),DATA_SHA256);
 validateDataset(data);assert.equal(data.rows.length,7409);assert.equal(data.columns.length,24);
 assert.equal(data.audit.median_interval_s,1.005);assert.equal(data.audit.sensor_missing_rows,54);
 assert.deepEqual(computeAudit(data.rows).gaps,[{row:1095,seconds:9.039},{row:1167,seconds:31.15},{row:2870,seconds:18814.125}]);
 assert.deepEqual(computeAudit(data.rows).cycle_decreases,[6034]);
 assert.equal(data.rows.filter(r=>r[22]===true).length,278);assert.equal(data.rows.filter(r=>r[23]===true).length,243);
 assert.ok(Object.values(data.performance).every(v=>v===null));
});
test('null is not zero or False; missing cells and gaps do not produce a connected trace',()=>{
 const missing=nextRecord(data.rows,0,'missing'),state=rowState(data.rows,missing,3);
 assert.equal(state.value,null);assert.equal(state.missing,true);assert.equal(state.protectiveStop,null);
 const points=tracePoints(data.rows,1094,2);assert.equal(points.at(-1).breakBefore,true);
 assert.equal(rowState(data.rows,1094,2).gap,9.039);
 assert.equal(nextRecord(data.rows,7408,'stop'),null);
 const rows=[[1,'2022-01-01T00:00:00.000Z',0,...Array(21).fill(null)]];
 assert.equal(rowState(rows,0,2).value,0);assert.equal(rowState(rows,0,2).missing,false);
});
test('recorded stop/grip/cycle are excluded from sensor selectors, never predictions',()=>{
 assert.deepEqual(SENSOR_INDICES,Array.from({length:19},(_,i)=>i+2));
 for(const i of [0,1,21,22,23])assert.throws(()=>rowState(data.rows,0,i));
 const stop=nextRecord(data.rows,0,'stop');assert.equal(rowState(data.rows,stop,2).protectiveStop,true);
});
test('malformed schema, chronology, sensor values, labels and performance claims fail closed',()=>{
 for(const mutate of [d=>d.rows[1][1]=d.rows[0][1],d=>d.rows[0][2]='NaN',d=>d.rows[0][22]=0,
  d=>d.performance.anomaly_recall=0.99,d=>d.columns[21]='session',d=>d.rows.pop(),d=>d.audit.gaps=[]]){
   const d=structuredClone(data);mutate(d);assert.throws(()=>validateDataset(d));
 }
});

test('UR3 is a separate linked real-record route and preserves CSP and theme controls',()=>{
 const html=readFileSync(new URL('../../web/robot/ur3/index.html',import.meta.url),'utf8');
 assert.match(html,/script src="\/theme.js"/);assert.match(html,/id="theme-toggle"/);
 assert.match(html,/default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'/);
 assert.doesNotMatch(html,/unsafe-inline|unsafe-eval/);
 const app=readFileSync(new URL('../../web/robot/ur3/app.mjs',import.meta.url),'utf8');
 assert.match(app,/left=92/);assert.match(app,/points.slice\(1\).filter\(p=>p.breakBefore\)/);
 assert.match(app,/if\(\$\('current-quality'\).textContent!==quality\)/);
 assert.match(app,/querySelectorAll\('main button,main select,main input'\)/);
 for(const route of ['index.html','robot/index.html','smt/index.html']){
  const entry=readFileSync(new URL('../../web/'+route,import.meta.url),'utf8');
  assert.match(entry,/href="\/robot\/ur3\/index.html"/);assert.match(entry,/합성 R-01·R-02/);
 }
});
