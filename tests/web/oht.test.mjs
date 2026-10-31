import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {OhtSimulation,poseAt,PORT_Y,CARRY_Y} from '../../web/oht/model.mjs';
import {mountOht,cameraPose} from '../../web/oht/view.mjs';
test('deterministic lifecycle, continuous attachment and single carrier coordinates',()=>{
 const times=[0,3,5,7,8,10,16,18,20,21,23,27];
 assert.deepEqual(times.map(t=>poseAt(t).phase),['approach','stop-a','lower-pick','pick','raise-loaded','travel-loaded','stop-b','lower-place','place','raise-empty','return-empty','complete']);
 for(const t of times.slice(1))for(const key of ['x','hoistY','carrierX','carrierY'])assert.ok(Math.abs(poseAt(t)[key]-poseAt(t-1e-8)[key])<1e-6,`${key} at ${t}`);
 assert.equal(poseAt(6).owner,'port-a');assert.equal(poseAt(7).owner,'hoist');assert.equal(poseAt(19.99).owner,'hoist');assert.equal(poseAt(20).owner,'port-b');
 for(const bad of [-1,NaN,Infinity])assert.deepEqual(poseAt(bad),poseAt(0));
 for(let t=0;t<40;t+=.01){const p=poseAt(t);assert.ok(p.carrierY>=PORT_Y&&p.carrierY<=CARRY_Y);if(p.owner==='hoist'){assert.equal(p.x,p.carrierX);assert.equal(p.hoistY,p.carrierY);}}
});
test('pause, rapid toggles, replay, terminal idle, reset and case switching',()=>{
 const s=new OhtSimulation();s.advance(100);assert.equal(s.time,0);s.play();s.advance(6);s.pause();const frozen=s.pose;s.advance(100);assert.deepEqual(s.pose,frozen);
 for(let i=0;i<50;i++){s.play();s.pause();}assert.equal(s.time,6);s.play();s.advance(1);assert.equal(s.pose.owner,'hoist');s.replay();s.advance(7);assert.deepEqual(s.pose,poseAt(7));s.advance(100);assert.equal(s.time,27);assert.equal(s.running,false);s.play();assert.equal(s.running,false);
 s.reset('delay');s.play();s.advance(24);assert.equal(s.pose.phase,'delayed');s.reset('normal');assert.deepEqual(s.pose,poseAt(0));assert.equal(s.running,false);
 for(const bad of [NaN,Infinity,-1]){s.play();s.advance(bad);assert.equal(s.time,0);}
});
test('delay latch and acknowledgement cannot resume, clear or move cargo',()=>{
 const s=new OhtSimulation('delay');s.acknowledge();assert.equal(s.acknowledged,false);s.play();s.advance(16);assert.equal(s.pose.phase,'long-stop');s.advance(7.999);assert.equal(s.pose.delayed,false);s.advance(.001);assert.equal(s.pose.delayed,true);assert.equal(s.running,false);assert.equal(s.pose.owner,'hoist');
 const p=s.pose;s.acknowledge();s.acknowledge();s.play();s.advance(100);assert.deepEqual(s.pose,p);assert.equal(s.ackTime,24);s.reset();assert.equal(s.acknowledged,false);assert.equal(s.ackTime,null);assert.equal(s.scenario,'delay');
 for(const t of [16,24])for(const key of ['x','hoistY','carrierX','carrierY'])assert.ok(Math.abs(poseAt(t,'delay')[key]-poseAt(t-1e-8,'delay')[key])<1e-6);
});
test('actual primitive geometry has one persistent FOUP; beacon is outside rail; disposal',()=>{
 const scene=new THREE.Scene(),v=mountOht(scene),carrier=v.carrier;
 for(const scenario of ['normal','delay'])for(let t=0;t<=30;t+=.125){const p=poseAt(t,scenario);v.update(p);scene.updateMatrixWorld(true);let n=0;scene.traverse(o=>{if(o.name==='synthetic-foup')n++;});assert.equal(n,1);assert.equal(v.carrier,carrier);assert.deepEqual(carrier.getWorldPosition(new THREE.Vector3()).toArray(),[p.carrierX,p.carrierY,0]);assert.equal(carrier.userData.owner,p.owner);assert.ok(v.belts.every(b=>b.scale.y>0));}
 v.update(poseAt(0));assert.equal(v.ports.length,2);const beacon=new THREE.Box3().setFromObject(scene.getObjectByName('delay-beacon')),rail=new THREE.Box3().setFromObject(scene.getObjectByName('ceiling-rail'));assert.equal(beacon.intersectsBox(rail),false);v.dispose();assert.equal(scene.children.length,0);
});
test('camera frames transport bounds at mobile and desktop, without altering state',()=>{
 const s=new OhtSimulation();s.play();s.advance(12);const before=s.pose;
 for(const aspect of [850/470,358/410,328/410]){const camera=new THREE.PerspectiveCamera(42,aspect,.1,150);cameraPose(camera,aspect);for(const x of [-7,7])for(const y of [0,6.45])for(const z of [-2.6,1]){const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1);}cameraPose(camera,aspect,'a');cameraPose(camera,aspect,'b');}assert.deepEqual(s.pose,before);
});
test('source preserves standalone scope, text fallback, accessible clock and independent startup',async()=>{
 const app=await readFile(new URL('../../web/oht/app.mjs',import.meta.url),'utf8'),html=await readFile(new URL('../../web/oht/index.html',import.meta.url),'utf8');
 assert.match(html,/src="\/theme.js"/);assert.match(html,/id="view-error"/);assert.match(html,/aria-live="off"/);assert.match(app,/visibilitychange/);assert.match(app,/webglcontextlost/);assert.ok(app.indexOf('requestAnimationFrame(tick)')<app.indexOf('await Promise.all'));assert.doesNotMatch(app,/fetch\(|ur3\/|fledge\/|secom\/|smt\/simulation/);
});
