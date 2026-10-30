import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {Simulation,STATIONS} from '../../web/smt/simulation.mjs';
import {robotPose,robotReview} from '../../web/smt/robot-cell-model.mjs';
import {transferPose,transferRobotPose,activeTransferBoard,TRANSFER_STAGE,TRANSFER_NAME} from '../../web/smt/transfer-robot-model.mjs';
import {mountTransferRobot} from '../../web/smt/transfer-robot-view.mjs';
function mount(){
 const scene=new THREE.Scene();
 const box=(parent,w,h,d,x,y,z,c)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const cylinder=(parent,r,h,x,y,z,c)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h),new THREE.MeshStandardMaterial({color:c}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const label=(parent,text)=>{const group=new THREE.Group();group.name=text;parent.add(group);};
 return {scene,robot:mountTransferRobot(scene,3,{box,cylinder,label})};
}
test('R02 is a separate visible gantry with supports, moving carriage and gripper, not just HUD text',()=>{
 const {scene,robot}=mount();assert.equal(scene.children[0],robot.root);assert.equal(robot.root.userData.transferRobot,true);
 const meshes=[];robot.root.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.ok(meshes.length>=14);assert.ok(meshes.every(m=>m.visible&&m.geometry));
 assert.ok(robot.root.children.some(o=>o.name===TRANSFER_NAME));
 robot.update([{id:'PCB-001',stage:7,progress:.1}]);const pick=meshes.map(o=>o.getWorldPosition(new THREE.Vector3()).toArray());
 robot.update([{id:'PCB-001',stage:7,progress:.5}]);const transfer=meshes.map(o=>o.getWorldPosition(new THREE.Vector3()).toArray());assert.notDeepEqual(pick,transfer);assert.equal(robot.root.userData.activeBoardId,'PCB-001');
 robot.update([]);assert.equal(robot.root.userData.activeBoardId,null);assert.equal(robot.root.userData.phase,'냉각 구간 대기');
});
test('existing Cooling stage is open and single occupancy; pick/lift/travel/place are continuous',()=>{
 assert.equal(STATIONS[TRANSFER_STAGE].name,'Cooling');assert.ok(STATIONS[TRANSFER_STAGE].duration<4);
 const pose=p=>transferPose({stage:7,progress:p});
 assert.equal(pose(.1).phase,'집기');assert.equal(pose(.5).phase,'이송');assert.equal(pose(.8).phase,'내려놓기');assert.equal(pose(1).carrying,false);
 assert.equal(pose(0).position.y,1.11);assert.equal(pose(1).position.y,1.11);
 assert.equal(pose(.2).position.x,pose(0).position.x);assert.equal(pose(.8).position.x,pose(1).position.x);
 for(const p of [.08,.25,.75,.94]){const a=pose(p-1e-8).position,b=pose(p).position;assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-6);}
 for(let p=.25;p<=.75;p+=.01)assert.equal(pose(p).position.y,1.75,'horizontal movement stays lifted');
 for(const p of [NaN,Infinity,-1])assert.deepEqual(pose(p),pose(0));assert.deepEqual(pose(2),pose(1));
 assert.equal(transferPose({stage:8}).position,null);assert.equal(transferPose({stage:6}).position,null);
 assert.equal(activeTransferBoard([{stage:7},{stage:7}]),null,'overlap guard');
});
test('12 boards share one robot; pause, reset mid-motion, repeated reset and seeded replay are deterministic',()=>{
 const sim=new Simulation(),seen=new Set(),first=[];const {robot}=mount();
 for(let i=0;i<900;i++){
  sim.advance(.1);const active=activeTransferBoard(sim.boards);assert.ok(sim.boards.filter(b=>b.stage===7).length<=1);
  if(active){seen.add(active.id);first.push([sim.time,active.id,transferPose(active)]);}
  robot.update(sim.boards);
 }
 assert.equal(seen.size,12);assert.equal(robot.root.userData.activeBoardId,null);assert.ok(sim.boards.every(b=>b.done));
 sim.reset();sim.advance(30.5);assert.equal(sim.boards[0].stage,7);const before=sim.snapshot(),pose=transferPose(sim.boards[0]);
 sim.running=false;sim.advance(100);assert.deepEqual(sim.snapshot(),before);assert.deepEqual(transferPose(sim.boards[0]),pose);
 sim.reset();sim.reset();robot.update(sim.boards);assert.equal(robot.root.userData.activeBoardId,null);assert.equal(transferPose(sim.boards[0]).position,null);
 const replay=[];for(let i=0;i<900;i++){sim.advance(.1);const active=activeTransferBoard(sim.boards);if(active)replay.push([sim.time,active.id,transferPose(active)]);}assert.deepEqual(replay,first);
});
test('presentation does not mutate simulations or R01 OK/NG/HOLD; interrupted intro samples cannot retain another PCB',()=>{
 for(const fault of ['paste','heat','missing','condition','review']){
  const sim=new Simulation();sim.arm(fault);sim.advance(30);const before=sim.snapshot();const {robot}=mount();
  for(const b of sim.boards)transferPose(b);robot.update(sim.boards);assert.deepEqual(sim.snapshot(),before);
  const sample=new Simulation();sample.advance(34);robot.update(sample.boards);assert.equal(robot.root.userData.activeBoardId,'PCB-002');
  robot.update(sim.boards);assert.equal(robot.root.userData.activeBoardId,'PCB-001');
  sim.advance(200);const board=sim.boards[1];assert.equal(robotPose(board).route,['paste','heat'].includes(fault)?'ng':'review');
  if(['missing','condition','review'].includes(fault))assert.equal(robotReview(board).state,'hold');
 }
});
test('live and intro draw use same geometry and active PCB, while accessible role/camera selection remains separate',async()=>{
 const app=await readFile(new URL('../../web/smt/app.mjs',import.meta.url),'utf8'),html=await readFile(new URL('../../web/smt/index.html',import.meta.url),'utf8');
 assert.match(app,/transferRobot=mountTransferRobot\(scene,positions\[TRANSFER_STAGE\]/);
 assert.match(app,/transferRobot\?\.update\(source.boards,source.time\)/);assert.match(app,/const transfer=b===transferBoard\?transferPose\(b\):null/);
 assert.match(app,/ray.intersectObject\(transferRobot.root,true\)/);assert.match(html,/id="transfer-robot-select" aria-pressed="false"/);
 assert.match(html,/실제 장비의 운동학·충돌 안전·디지털 트윈 검증이 아니/);
 assert.equal((html.match(/class="robot-cell-info"/g)||[]).length,1,'existing R01 selectors remain unique');
});

test('empty gripper returns continuously through the existing gap and meets the next pickup without a snap',()=>{
 const sim=new Simulation(),positions=[];
 for(const time of [31.999999,32,32.25,32.5,32.75,32.999999,33,33.000001]){
  sim.reset();sim.advance(time);positions.push(transferRobotPose(sim.boards,sim.time));
 }
 const distance=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y,a.position.z-b.position.z);
 assert.ok(distance(positions[0],positions[1])<1e-5);assert.ok(distance(positions[5],positions[6])<1e-5);assert.ok(distance(positions[6],positions[7])<1e-5);
 assert.equal(positions[2].position.y,1.75);assert.equal(positions[3].position.y,1.75);assert.equal(positions[4].position.y,1.75);
 assert.equal(positions[3].phase,'빈 그리퍼 복귀');assert.equal(positions[3].carrying,false);
 for(const boundary of [32.25,32.75]){
  sim.reset();sim.advance(boundary-1e-8);const before=transferRobotPose(sim.boards,sim.time);sim.advance(1e-8);assert.ok(distance(before,transferRobotPose(sim.boards,sim.time))<1e-6);
 }
});
test('empty return freezes, resets, repeats, and restores after an interrupted intro source',()=>{
 const sim=new Simulation(),{robot}=mount();sim.advance(32.5);const pose=transferRobotPose(sim.boards,sim.time);
 robot.update(sim.boards,sim.time);assert.equal(robot.root.userData.phase,'빈 그리퍼 복귀');
 sim.running=false;sim.advance(10);assert.deepEqual(transferRobotPose(sim.boards,sim.time),pose);
 const sample=new Simulation();sample.advance(36.8);robot.update(sample.boards,sample.time);assert.equal(robot.root.userData.phase,'다음 집기 준비');
 robot.update(sim.boards,sim.time);assert.equal(robot.root.userData.phase,'빈 그리퍼 복귀');
 sim.reset();robot.update(sim.boards,sim.time);assert.equal(robot.root.userData.phase,'냉각 구간 대기');assert.equal(transferRobotPose(sim.boards,sim.time).position.y,1.11);
 sim.advance(32.5);assert.deepEqual(transferRobotPose(sim.boards,sim.time),pose);
 sim.reset();sim.advance(76.5);assert.equal(transferRobotPose(sim.boards,sim.time).phase,'빈 그리퍼 복귀');sim.advance(.5);assert.equal(transferRobotPose(sim.boards,sim.time).phase,'냉각 구간 대기');
});
