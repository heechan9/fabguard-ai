import {test} from 'node:test';
import assert from 'node:assert/strict';
import {robotPose,robotRoute,DESTINATIONS} from '../../web/smt/robot-cell-model.mjs';
import {Simulation} from '../../web/smt/simulation.mjs';
test('synthetic NG and missing measurements cannot be silently sent to normal',()=>{
 assert.equal(robotRoute({aoi:'NG',volume:null}),'ng');assert.equal(robotRoute({aoi:'OK',volume:null}),'review');assert.equal(robotRoute({aoi:'OK',volume:100}),'ok');assert.equal(robotRoute({aoi:null}),null);
});
test('pick, transport and placement use continuous endpoints and separate bins',()=>{
 for(const [aoi,volume,route] of [['OK',100,'ok'],['NG',60,'ng'],['OK',null,'review']]){
  const b={stage:9,aoi,volume};const poses=[0,.1,.25,.5,.75,.9,1].map(progress=>robotPose({...b,progress}));
  assert.equal(poses[0].phase,'집기');assert.equal(poses[3].phase,'이송');assert.equal(poses[4].phase,'내려놓기');assert.equal(poses[6].carrying,false);
  assert.equal(poses[6].position.z,DESTINATIONS[route].z);
  for(const boundary of [.25,.75,.9]){const l=robotPose({...b,progress:boundary-1e-8}).position,r=robotPose({...b,progress:boundary}).position;assert.ok(Math.hypot(l.x-r.x,l.y-r.y,l.z-r.z)<1e-6);}
 }
});
test('shared simulation pause freezes robot pose; reset clears it without changing export contract',()=>{
 const sim=new Simulation();sim.advance(37);const board=sim.boards[0];assert.equal(board.stage,9);const pose=robotPose(board);sim.running=false;sim.advance(10);assert.deepEqual(robotPose(board),pose);
 sim.reset();assert.equal(robotPose(sim.boards[0]).phase,'최종 검사 대기');assert.equal(sim.snapshot().schema_version,'fabguard-smt-synthetic/v1');sim.advance(200);assert.ok(sim.boards.every(b=>b.done));
});
