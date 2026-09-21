import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {individuals,scenario} from '../../web/equipment/spc-model.mjs';

test('browser SPC agrees with Python for all interactive scenarios and blocked baseline',()=>{
  const cases=['initial','high','low','missing'].map(scenario);
  cases.push([100,100,100,100,100,100,100,100,100,200,100,null]);
  cases.push([49.6,47.6,49.9,51.3,47.8,51.2,52.6,52.4,53.6,52.1,56,45,50,null]);
  const expected=JSON.parse(execFileSync('python',['-c','import json,sys; from fabguard.spc import individuals_report; print(json.dumps([individuals_report(v,10) for v in json.load(sys.stdin)]))'],{input:JSON.stringify(cases),env:{...process.env,PYTHONPATH:'src'},encoding:'utf8'}));
  cases.forEach((values,i)=>{const actual=individuals(values);for(const key of ['center','lcl','ucl'])assert.ok(Math.abs(actual[key]-expected[i][key])<1e-10);assert.deepEqual(actual.statuses,expected[i].observations.map(r=>r.status));});
});
test('scenario changes preserve baseline and reset',()=>{
  const initial=scenario('initial');for(const kind of ['high','low','missing'])assert.deepEqual(scenario(kind).slice(0,10),initial.slice(0,10));
  const altered=scenario('high');altered[0]=1;assert.deepEqual(scenario('initial'),initial);
  assert.equal(individuals(scenario('missing')).statuses[1],'unknown');
  assert.throws(()=>individuals(Array(14).fill(100)));
  assert.throws(()=>individuals([...scenario('initial'),Infinity]));
});
