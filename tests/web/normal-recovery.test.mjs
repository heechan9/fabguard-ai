import test from 'node:test';
import assert from 'node:assert/strict';
import {normalRecoveryPose,robotRoute,robotPose,DESTINATIONS} from '../../web/smt/robot-cell-model.mjs';
import {Simulation} from '../../web/smt/simulation.mjs';

const offset=2.225;
const near=(v,w)=>assert.ok(Math.abs(v-w)<1e-8);
test('OK recovery begins at the released robot position and fills independent unloader slots',()=>{
 const occupied=[];
 for(let slot=0;slot<12;slot++){
  const b={aoi:'OK',volume:99,stage:9,progress:1};
  assert.deepEqual(normalRecoveryPose(0,slot,offset),robotPose(b,slot).position);
  for(const join of [.25,.65,1]){
   const a=normalRecoveryPose(join-1e-7,slot,offset),c=normalRecoveryPose(join,slot,offset);
   assert(Math.hypot(a.x-c.x,a.y-c.y,a.z-c.z)<1e-6);
  }
  const end=normalRecoveryPose(1,slot,offset);
  near(end.x,offset+(slot%2?.38:-.38));near(end.z,0);
  for(const prev of occupied)assert(Math.abs(end.x-prev.x)>.67 || Math.abs(end.y-prev.y)>.134);
  occupied.push(end);
 }
});

test('NG and missing or held OK stay on their assigned trays without changing timed process completion',()=>{
 const sim=new Simulation();
 sim.arm('paste');sim.advance(4);sim.arm('missing');sim.advance(4);
 sim.arm('condition');sim.advance(100);
 const snapshot=JSON.stringify(sim.snapshot());
 for(const [i,route] of [[0,'ok'],[1,'ng'],[2,'review'],[3,'review']]){
  const board=sim.boards[i];
  assert.equal(board.done,true);assert.equal(board.stage,11);assert.equal(board.history.at(-1).text,'배출 완료');
  assert.equal(robotRoute(board),route);
  const rank=i===3?1:0;
  const p=robotPose(board,rank).position;
  assert.equal(p.x,DESTINATIONS[route].x);assert.equal(p.z,DESTINATIONS[route].z);
  if(route!=='ok'){
   near(p.y,1.1+rank*.15);
   assert.deepEqual(p,robotPose({...board,stage:9,progress:1},rank).position);
  }
 }
 assert.equal(JSON.stringify(sim.snapshot()),snapshot);
});
