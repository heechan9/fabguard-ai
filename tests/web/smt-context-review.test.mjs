import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,assess,manufacturingEvents} from '../../web/smt/simulation.mjs';
import {robotRoute,robotReview} from '../../web/smt/robot-cell-model.mjs';
import {contextReview,holdReasons} from '../../web/smt/context-review-model.mjs';

test('context scenarios disclose no future evidence and keep explicit HOLD after OK',()=>{
 for(const fault of ['condition','review']){
  const sim=new Simulation();sim.arm(fault);sim.advance(4);
  const b=sim.boards[1];assert.equal(b.fault,fault);
  assert.deepEqual(holdReasons(b),[]);assert.equal(contextReview(b).events.length,0);
  assert.equal(contextReview(b).hypotheses.length,0);assert.equal(robotRoute(b),null);
  sim.advance(8);assert.equal(holdReasons(b).length,1);assert.equal(assess(b).level,'warn');
  assert.equal(contextReview(b).events.length,1);assert.equal(contextReview(b).hypotheses.length,3);
  sim.advance(100);assert.equal(b.aoi,'OK');assert.equal(robotRoute(b),'review');
  assert.equal(robotReview(b).state,'hold');assert.match(robotReview(b).next,/자동 해제하지/);
  assert.equal(contextReview(b).boardId,b.id);assert.equal(contextReview(b).events[0].time,b.born+7);
  const run=sim.snapshot();assert.equal(run.boards[1].context_review.scope,'illustrative-not-operational');
  assert.equal(manufacturingEvents(run).readings.length,12);
  sim.reset();assert.equal(contextReview(sim.boards[0]).events.length,0);assert.equal(sim.pending,null);
 }
});
test('HOLD reasons coexist with NG but never silently route NG to normal',()=>{
 const b={id:'PCB-X',stage:9,volume:null,peak:270,aoi:'NG',fault:'condition',born:4};
 assert.equal(holdReasons(b).length,2);assert.equal(robotRoute(b),'ng');
 assert.equal(robotReview(b).state,'hold');assert.match(robotReview(b).decision,/NG/);
 assert.match(contextReview(b).hypotheses.map(x=>x.next).join(' '),/기록/);
});
test('normal and missing routes are unchanged; review is board-specific and read-only',()=>{
 const sim=new Simulation();sim.arm('missing');sim.advance(100);
 assert.equal(robotRoute(sim.boards[0]),'ok');assert.equal(robotRoute(sim.boards[1]),'review');
 const before=JSON.stringify(sim.snapshot());
 assert.equal(contextReview(sim.boards[0]).events.length,0);
 assert.equal(contextReview(sim.boards[1]).reasons[0].code,'missing_measurement');
 contextReview(sim.boards[1]);assert.equal(JSON.stringify(sim.snapshot()),before);
 assert.throws(()=>sim.arm('unapproved'));
});


test('context examples do not change seeded measurements or AOI rules',()=>{
 const baseline=new Simulation();baseline.advance(100);
 for(const fault of ['condition','review']){
  const sim=new Simulation();sim.arm(fault);sim.advance(100);
  assert.deepEqual(sim.boards.map(b=>[b.volume,b.peak,b.aoi]),baseline.boards.map(b=>[b.volume,b.peak,b.aoi]));
 }
});
