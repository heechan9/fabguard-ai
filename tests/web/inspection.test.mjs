import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,inspect,InspectionSession} from '../../web/smt/inspection-model.mjs';
import {Simulation} from '../../web/smt/simulation.mjs';

test('all five authored cases have explicit assumptions and deterministic results',()=>{
  assert.equal(Object.keys(CASES).length,5);
  for(const [id,sample] of Object.entries(CASES)){
    assert.ok(sample.assumption);
    for(const method of ['xray','electrical'])assert.deepEqual(inspect(id,method),inspect(id,method));
  }
});
test('internal void does not imply an electrical failure or product rejection',()=>{
  assert.equal(inspect('void','xray').status,'review');
  assert.equal(inspect('void','electrical').status,'clear');
});
test('open and short do not invent X-ray observations',()=>{
  for(const id of ['open','short']){
    assert.equal(inspect(id,'xray').status,'unknown');
    assert.equal(inspect(id,'electrical').visual,id);
  }
});
test('missing inspections never become normal results',()=>{
  for(const method of ['xray','electrical'])assert.equal(inspect('missing',method).status,'unknown');
});
test('case changes, board changes and resets invalidate earlier results',()=>{
  const session=new InspectionSession();
  assert.throws(()=>session.run('xray'));
  session.selectBoard('PCB-001');session.selectCase('void');session.run('xray');
  session.selectBoard('PCB-001');assert.ok(session.results.xray);
  session.selectCase('clear');assert.deepEqual(session.results,{});
  session.run('electrical');session.selectBoard('PCB-002');
  assert.equal(session.caseId,null);assert.deepEqual(session.results,{});
  session.selectCase('short');session.run('electrical');session.reset();
  assert.equal(session.boardId,null);assert.deepEqual(session.results,{});
});
test('invalid cases and methods fail explicitly',()=>{
  assert.throws(()=>inspect('made-up','xray'));assert.throws(()=>inspect('clear','AI'));
  assert.throws(()=>new InspectionSession().selectCase('toString'));
});
test('inspection experience cannot mutate production simulation or its export',()=>{
  const sim=new Simulation();sim.advance(10);const before=JSON.stringify(sim.snapshot());
  const session=new InspectionSession();session.selectBoard(sim.boards[0].id);
  for(const id of Object.keys(CASES)){session.selectCase(id);session.run('xray');session.run('electrical');}
  assert.equal(JSON.stringify(sim.snapshot()),before);
});
