import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {AGV_ROUTE,AGV_SIZE,FloorAgv,agvPose,routePosition} from '../../web/smt/floor-agv-model.mjs';
import {mountFloorAgv} from '../../web/smt/floor-agv-view.mjs';
import {Simulation} from '../../web/smt/simulation.mjs';
import {overviewDistance,stationZoom} from '../../web/smt/camera-model.mjs';
function mount(){
 const scene=new THREE.Scene();
 const box=(p,w,h,d,x,y,z,c)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c}));m.position.set(x,y,z);p.add(m);return m;};
 const cylinder=(p,r,h,x,y,z,c)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h),new THREE.MeshStandardMaterial({color:c}));m.position.set(x,y,z);p.add(m);return m;};
 const label=(p,text)=>{const g=new THREE.Group();g.name=text;p.add(g);return g;};
 return {scene,view:mountFloorAgv(scene,{box,cylinder,label})};
}
test('fixed loop, deterministic transport, explicit waiting and latched blocked cause',()=>{
 assert.deepEqual(AGV_ROUTE[0],AGV_ROUTE.at(-1));assert.deepEqual(routePosition(38),routePosition(0));
 assert.equal(agvPose(0).phase,'transport');assert.equal(agvPose(12).phase,'wait');assert.equal(agvPose(16).phase,'transport');assert.equal(agvPose(24).phase,'blocked');
 assert.deepEqual(agvPose(24),agvPose(100000));assert.match(agvPose(24).cause,/가상 장애물.*재설정/);
 assert.deepEqual(agvPose(12),agvPose(15.999));
 for(const boundary of [12,16,24]){const a=agvPose(boundary-1e-8),b=agvPose(boundary);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-6);}
 for(const invalid of [NaN,Infinity,-10])assert.deepEqual(agvPose(invalid),agvPose(0));
 for(let t=0;t<=40;t+=.01){const p=agvPose(t);assert.ok(p.z-AGV_SIZE.length/2>3.2,'outside line decks, gantry and R01 tray footprints');assert.ok(p.x>=-8&&p.x<=8);}
});
test('one actual chassis, four wheels and independent synthetic tray move along drawn floor path',()=>{
 const {scene,view}=mount();assert.equal(scene.children.filter(x=>x.name==='synthetic-floor-agv-a01').length,1);
 const wheels=[];view.root.traverse(o=>{if(o.name==='agv-wheel')wheels.push(o);});assert.equal(wheels.length,4);
 assert.ok(view.root.getObjectByName('synthetic-material-tray').isMesh);assert.ok(view.route.children.length>=10);
 view.update(agvPose(0));const first=view.root.position.clone();view.update(agvPose(5));assert.notDeepEqual(view.root.position,first);
 assert.equal(view.obstacle.visible,false);view.update(agvPose(24));assert.equal(view.obstacle.visible,true);assert.equal(view.root.userData.phase,'blocked');
 const bounds=new THREE.Box3().setFromObject(view.root,true);assert.ok(bounds.min.y>=-.161&&bounds.min.y<-.15,'wheels touch the existing floor top');
 assert.ok(bounds.max.x<-4+1&&bounds.min.x>-5.4,'chassis stops before obstacle');
 for(const t of [0,16*12/19-1e-7,16*12/19+1e-7,12,16,24]){
  view.update(agvPose(t));const actual=new THREE.Box3().setFromObject(view.root,true);
  assert.ok(actual.min.z>3.2,`rendered chassis/wheels/tray outside line footprint at ${t}`);
 }
 view.update(agvPose(0));assert.equal(view.obstacle.visible,false);
});
test('source clock pause, AGV pause, repeat reset and replay do not mutate existing 12-board seeded export',()=>{
 const sim=new Simulation(),agv=new FloorAgv(),baseline=new Simulation();const run=[];
 for(let i=0;i<50;i++){sim.advance(.1);baseline.advance(.1);run.push(agv.update(sim.time));}assert.deepEqual(sim.snapshot(),baseline.snapshot());
 const frozen=agv.pose;sim.running=false;sim.advance(10);agv.update(sim.time);assert.deepEqual(agv.pose,frozen);
 sim.running=true;agv.running=false;sim.advance(3);agv.update(sim.time);assert.deepEqual(agv.pose,frozen);
 agv.running=true;sim.advance(1);agv.update(sim.time);assert.ok(Math.abs(agv.time-6)<1e-10);
 const before=sim.snapshot();agv.reset(sim.time);agv.reset(sim.time);assert.deepEqual(sim.snapshot(),before);assert.deepEqual(agv.pose,agvPose(0));
 sim.reset();agv.reset();const replay=[];for(let i=0;i<50;i++){sim.advance(.1);replay.push(agv.update(sim.time));}assert.deepEqual(replay,run);
 const exported=sim.snapshot();const {view}=mount();for(const t of [0,12,16,24,90])view.update(agvPose(t));assert.deepEqual(sim.snapshot(),exported);
 sim.advance(200);assert.equal(sim.boards.length,12);assert.ok(sim.boards.every(b=>b.done));
});
test('AGV focus and overhead camera frame whole route at wide and mobile aspect ratios',()=>{
 for(const aspect of [2.1,.9,.8])for(const elevation of [1.15,1.53]){
  const distance=overviewDistance(aspect)*stationZoom(18,aspect),camera=new THREE.PerspectiveCamera(42,aspect,.1,180);
  camera.position.set(0,.6+Math.sin(elevation)*distance,5.5+Math.cos(elevation)*distance);camera.lookAt(0,.6,5.5);camera.updateMatrixWorld();
  for(const {x,z} of AGV_ROUTE){const p=new THREE.Vector3(x,0,z).project(camera);assert.ok(Math.abs(p.x)<.95&&Math.abs(p.y)<.95,`route ${x},${z} aspect ${aspect}`);}
 }
});
test('app advances AGV only with live simulation clock, preserves intro/camera and exports',async()=>{
 const app=await readFile(new URL('../../web/smt/app.mjs',import.meta.url),'utf8'),html=await readFile(new URL('../../web/smt/index.html',import.meta.url),'utf8');
 assert.match(app,/if\(introBusy\)\{requestAnimationFrame\(frame\);return;\}/);
 assert.match(app,/if\(\$\('floor-agv-status'\).textContent!==agvStatus\)/);
 assert.doesNotMatch(html,/id="floor-agv-toggle" aria-pressed/);
 assert.match(app,/stationButtons.forEach\(button=>\{button.classList.remove\('active'\)/);
 assert.match(app,/\$\('equipment-reference'\).hidden=true/);
 assert.match(app,/floorAgv.update\(sim.time\)/);assert.match(app,/floorAgvView\?\.update\(floorAgv.pose\)/);
 assert.match(app,/floorAgv.reset\(sim.time\);updateUI\(\);draw\(\)/);
 assert.match(html,/AMR의 자율주행·SLAM·경로 최적화/);assert.match(html,/별도 합성 자재 트레이/);assert.match(html,/OHT는 이번 범위에 없습니다/);
});
test('close-up raycasting supplies active camera for real Sprite labels and preserves mesh hits',async()=>{
 const root=new THREE.Group(),sprite=new THREE.Sprite(new THREE.SpriteMaterial());
 const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.15),new THREE.MeshBasicMaterial());
 sprite.position.set(0,2,0);root.add(sprite,wheel);root.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(42,1,.1,180);camera.position.set(0,0,4);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(camera.position,new THREE.Vector3(0,0,-1));ray.camera=camera;
 assert.doesNotThrow(()=>ray.intersectObject(root,true));assert.ok(ray.intersectObject(root,true).some(hit=>hit.object===wheel));
 const verifier=await readFile(new URL('../../verification/check_floor_agv.cjs',import.meta.url),'utf8');
 assert.match(verifier,/ray.camera=camera;[\s\S]*ray.intersectObject\(root,true\)/);
});
