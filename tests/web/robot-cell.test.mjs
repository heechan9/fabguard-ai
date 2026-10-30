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

test('selected-board review discloses no future measurement or route before inspection',async()=>{
 const {robotReview}=await import('../../web/smt/robot-cell-model.mjs');
 const early={stage:1,volume:null,peak:null,aoi:null,rawVolume:60,rawPeak:270};
 assert.deepEqual(robotReview(early),robotReview({...early,rawVolume:100,rawPeak:240}));
 assert.equal(robotReview(early).state,'waiting');assert.equal(robotReview(early).route,null);
 assert.doesNotMatch(robotReview(early).evidence,/60|270/);
 const inspected={stage:8,volume:100,peak:242,aoi:'OK'};
 assert.equal(robotReview(inspected).route,null);
 assert.equal(robotReview({...inspected,stage:9}).route,'ok');
});
test('review keeps missing evidence on hold after synthetic OK and distinguishes NG',async()=>{
 const {robotReview}=await import('../../web/smt/robot-cell-model.mjs');
 const missing={stage:9,volume:null,peak:242,aoi:'OK'};
 assert.equal(robotReview(missing).state,'hold');assert.equal(robotReview(missing).route,'review');
 assert.match(robotReview(missing).decision,/정상 위치로 보내지 않음/);
 assert.match(robotReview(missing).next,/자동 해제하지 않/);
 const ng=robotReview({stage:9,volume:62,peak:242,aoi:'NG'});
 assert.equal(ng.state,'review');assert.equal(ng.route,'ng');assert.match(ng.next,/원인 확정.*아닙니다/);
 const ok=robotReview({stage:9,volume:100,peak:242,aoi:'OK'});
 assert.match(ok.next,/실제 품질.*아닙니다/);
});
test('selection review replays deterministically and reset removes completed route',async()=>{
 const {robotReview}=await import('../../web/smt/robot-cell-model.mjs');
 const sim=new Simulation();sim.arm('missing');sim.advance(200);
 const first=sim.boards.map(robotReview);assert.equal(first[1].state,'hold');
 sim.reset();assert.equal(robotReview(sim.boards[0]).route,null);assert.equal(robotReview(sim.boards[0]).state,'waiting');
 sim.arm('missing');sim.advance(200);assert.deepEqual(sim.boards.map(robotReview),first);
});
test('scene wiring keeps selected route separate from live gripper and real evidence',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../../web/smt/index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../../web/smt/app.mjs',import.meta.url),'utf8');
 const view=await readFile(new URL('../../web/smt/robot-cell-view.mjs',import.meta.url),'utf8');
 assert.match(html,/href="\/secom\/#distribution-evidence"/);assert.match(html,/분류·보류를 제어하지 않습니다/);
 assert.match(html,/id="robot-decision" role="status"/);assert.match(html,/id="robot-active"/);
 assert.match(app,/robotCell\?\.update\(source.boards,selected\)/);
 assert.match(view,/routes\[key\]\.visible=route===key/);assert.match(view,/boards.find\(b=>b.stage===9\)/);
});
