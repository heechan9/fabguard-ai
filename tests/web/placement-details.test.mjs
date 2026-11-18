import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {mountPlacementDetails,detailPCB} from '../../web/smt/placement-details.mjs';
const build=()=>{const machine=new THREE.Group(),head=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.48,12),new THREE.MeshStandardMaterial({color:0x3d7485}));machine.add(head);return {machine,head,d:mountPlacementDetails(machine,head,2.25)};};
test('bounded finite geometry with no generated physical status',()=>{const {machine,d}=build();machine.updateMatrixWorld(true);let n=0;machine.traverse(o=>{if(o.isMesh){n++;const b=new THREE.Box3().setFromObject(o);assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));}});assert.ok(n<40);assert.equal(d.selected,null);});
test('highlight categories restore and never alter base colour',()=>{const {d}=build();const mesh=d.parts.rail[0],base=mesh.material.color.getHex();d.select('rail');assert.notEqual(mesh.material.emissive.getHex(),0);d.select('nozzle');assert.equal(mesh.material.emissive.getHex(),0);assert.equal(mesh.material.color.getHex(),base);d.select('bogus');assert.equal(d.selected,null);});
test('PCB border only follows a present board and selected category',()=>{const {d}=build();d.select('pcb');d.update(null,0);assert.equal(d.pcbOutline.visible,false);d.update({},.3);assert.equal(d.pcbOutline.visible,true);assert.equal(d.pcbOutline.position.x,.3);d.select('rail');d.update({},.2);assert.equal(d.pcbOutline.visible,false);});
test('moving head retains parent transform and repeated update creates no geometry',()=>{const {machine,head,d}=build();const count=()=>{let n=0;machine.traverse(()=>n++);return n;};const n=count();for(let i=0;i<100;i++){head.position.set(i/100,1.5,0);d.update({},i/100);}assert.equal(count(),n);assert.equal(d.carriage.parent,head);});
test('PCB pads are bounded decorative children',()=>{const g=new THREE.Group();detailPCB(g);assert.equal(g.children.length,8);assert.ok(g.children.every(x=>x.position.y===.04));});
test('station highlights never leak into another station',()=>{const a=build(),b=build();a.d.select('rail');assert.equal(b.d.parts.rail[0].material.emissive.getHex(),0);a.d.select(null);assert.equal(a.d.parts.rail[0].material.emissive.getHex(),0);});
test('fixed rails and feeders leave the PCB transport volume clear',()=>{const {machine,d}=build();machine.updateMatrixWorld(true);const path=new THREE.Box3(new THREE.Vector3(-2,1.075,-.395),new THREE.Vector3(2,1.145,.395));for(const mesh of [...d.parts.rail,...d.parts.feeder])assert.equal(new THREE.Box3().setFromObject(mesh).intersectsBox(path),false);});
test('decorative PCB outline is never ray-pickable, hidden or visible',()=>{
 const {machine,d}=build();const ray=new THREE.Raycaster(new THREE.Vector3(.9,5,0),new THREE.Vector3(0,-1,0));
 for(const visible of [false,true]){d.pcbOutline.visible=visible;machine.updateMatrixWorld(true);assert.equal(ray.intersectObject(d.pcbOutline,true).length,0);assert.ok(ray.intersectObject(machine,true).every(hit=>hit.object!==d.pcbOutline));}
});
test('nozzle stack clears PCB and chip tops throughout both placement stages',async()=>{
 const {placementPose}=await import('../../web/smt/interactive-model.mjs');
 const {machine,head,d}=build();const chipTop=1.11+.065+.065/2;
 for(const stage of [3,4])for(let i=0;i<=1000;i++){
  const pose=placementPose({stage,progress:i/1000});head.position.set(pose.x,pose.y,pose.z);machine.updateMatrixWorld(true);
  // Existing head has legacy contact geometry: only new decorations must clear chips.
  for(const mesh of d.parts.nozzle.filter(mesh=>mesh!==head)){const bounds=new THREE.Box3().setFromObject(mesh);assert.ok(bounds.min.y>chipTop,`nozzle intersects chip at stage ${stage}, progress ${i/1000}`);}
 }
});

test('existing visible head highlights without changing its geometry or shared source material',()=>{
 const machine=new THREE.Group(),geometry=new THREE.CylinderGeometry(.11,.11,.48,12),material=new THREE.MeshStandardMaterial({color:0x3d7485});
 const head=new THREE.Mesh(geometry,material),other=new THREE.Mesh(geometry,material);machine.add(head,other);
 const before=Array.from(geometry.attributes.position.array);const d=mountPlacementDetails(machine,head,2.25);
 assert.equal(head.geometry,geometry);assert.deepEqual(Array.from(geometry.attributes.position.array),before);assert.ok(d.parts.nozzle.includes(head));
 d.select('nozzle');assert.notEqual(head.material.emissive.getHex(),0);assert.equal(other.material.emissive.getHex(),0);
 d.select(null);assert.equal(head.material.emissive.getHex(),0);assert.equal(head.material.color.getHex(),0x3d7485);
 const ray=new THREE.Raycaster(new THREE.Vector3(0,-2,0),new THREE.Vector3(0,1,0));machine.updateMatrixWorld(true);
 assert.equal(ray.intersectObject(head,true)[0].object,head,'the highlighted original nozzle body remains visible from below');
 assert.equal(d.parts.nozzle.length,3,'head, carriage and visible collar only');
});
