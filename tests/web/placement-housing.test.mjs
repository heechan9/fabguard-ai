import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {placementPose} from '../../web/smt/interactive-model.mjs';
import {mountPlacementDetails} from '../../web/smt/placement-details.mjs';
import {buildPlacementHousing} from '../../web/smt/placement-housing.mjs';
function build(n=6){const machine=new THREE.Group(),cover=new THREE.Group();machine.add(cover);const result=buildPlacementHousing(machine,cover,2.25,n);machine.updateMatrixWorld(true);return {machine,cover,...result};}
test('engineering housing is finite, compact and has bounded render cost',()=>{
 for(const n of [4,6]){const {machine}=build(n);let meshes=0,triangles=0;machine.traverse(o=>{if(!o.isMesh)return;meshes++;const g=o.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
 const bounds=new THREE.Box3().setFromObject(machine);for(const v of [...bounds.min.toArray(),...bounds.max.toArray()])assert(Number.isFinite(v));assert(bounds.min.x>=-1.4&&bounds.max.x<=1.4);assert(bounds.max.z<=1.31);assert(bounds.max.y<2.8);assert(meshes<125,`mesh count ${meshes}`);assert(triangles<18000,`triangles ${triangles}`);
 }});
test('all opaque architecture stays out of the moving PCB envelope',()=>{
 const {machine}=build();const corridor=new THREE.Box3(new THREE.Vector3(-1.38,1.075,-.395),new THREE.Vector3(1.38,1.145,.395));
 machine.traverse(o=>{if(!o.isMesh)return;const box=new THREE.Box3().setFromObject(o);assert(!box.intersectsBox(corridor),`PCB intersection ${o.geometry.type}: ${box.min.toArray()} ${box.max.toArray()}`);});
});
test('removable cover retains all moving-path architecture and does not hide feeder bank',()=>{
 const {cover,root}=build();assert(cover.children.length>5);assert(root.children.length>20);cover.visible=false;assert(root.visible);assert(!cover.children.includes(root));
});
test('glass does not write depth; decorative meshes have no ray hits',()=>{
 const {machine,materials}=build();assert.equal(materials.glass.depthWrite,false);assert.equal(materials.glass.transparent,true);
 let decorations=0;machine.traverse(o=>{if(!o.isMesh||o.userData.housingPickable)return;const hits=[];o.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);decorations++;});assert(decorations>40);
});
test('feeder and bridge highlight the visible assemblies, reset and remain isolated',()=>{
 const a=build(),b=build();a.select('feeder');let lit=0;
 a.machine.traverse(o=>{if(!o.isMesh)return;if(o.userData.explanatoryPart==='feeder'){assert.equal(o.material.emissive.getHex(),0x247a87);lit++;}else if(o.userData.explanatoryPart==='rail')assert.equal(o.material.emissive.getHex(),0);});assert(lit>30);
 b.machine.traverse(o=>{if(o.isMesh&&o.userData.explanatoryPart)assert.equal(o.material.emissive.getHex(),0);});
 a.select(null);a.machine.traverse(o=>{if(o.isMesh&&o.userData.explanatoryPart)assert.equal(o.material.emissive.getHex(),0);});
});

test('visible outer feeder flange remains a station hit while surrounding air is not',()=>{
 const {machine}=build();
 const hits=new THREE.Raycaster(new THREE.Vector3(.6975,.89,3),new THREE.Vector3(0,0,-1)).intersectObject(machine,true);
 assert(hits.some(h=>h.object.userData.explanatoryPart==='feeder'));
 const air=new THREE.Raycaster(new THREE.Vector3(1.35,.89,3),new THREE.Vector3(0,0,-1)).intersectObject(machine,true);
 assert.equal(air.length,0);
});

test('new housing clears sampled head and carriage poses across the full progress range',()=>{
 for(const stage of [3,4]){
  const {machine,cover,root}=build(stage===3?6:4);
  const head=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.48,12),new THREE.MeshStandardMaterial());machine.add(head);mountPlacementDetails(machine,head,2.25,stage===3?6:4);
  const fixed=[];for(const group of [root,cover])group.traverse(o=>{if(o.isMesh)fixed.push({object:o,bounds:new THREE.Box3().setFromObject(o)});});
  for(let n=-1;n<=1000;n++){
   const progress=n/1000,pose=placementPose(n<0?null:{stage,progress});head.position.set(n<0?0:-2.25/2-.24+(2.25+.48)*progress+pose.x,pose.y,pose.z);machine.updateMatrixWorld(true);
   const moving=new THREE.Box3().setFromObject(head);
   for(const {object,bounds} of fixed)assert(!bounds.intersectsBox(moving),`stage ${stage}, progress ${progress}: ${object.geometry.type} at ${object.position.toArray()} intersects head/carriage`);
  }
 }
});

test('cover panels are pickable only with a visible ancestor chain',()=>{
 const {machine,cover}=build();const ray=new THREE.Raycaster(new THREE.Vector3(0,2.35,3),new THREE.Vector3(0,0,-1));
 assert(ray.intersectObject(cover,true).length>0);
 cover.visible=false;assert.equal(ray.intersectObject(cover,true).length,0);
 cover.visible=true;machine.visible=false;assert.equal(ray.intersectObject(cover,true).length,0);
 machine.visible=true;assert(ray.intersectObject(cover,true).length>0);
});
test('guide shafts contact rear supports on both machines',()=>{
 for(const n of [4,6]){const {root}=build(n);const shafts=root.children.filter(o=>o.geometry?.type==='CylinderGeometry'&&o.position.y===1.88);
 assert.equal(shafts.length,2);for(const shaft of shafts){const support=root.children.find(o=>o.geometry?.type==='BoxGeometry'&&o.position.x===shaft.position.x&&o.position.z===-.70);assert(support);assert(new THREE.Box3().setFromObject(shaft).intersectsBox(new THREE.Box3().setFromObject(support)));}}
});
test('adjacent same-depth reel flanges remain separate in both feeder banks',()=>{
 for(const n of [4,6]){const {root}=build(n);const flanges=root.children.filter(o=>o.geometry?.type==='CylinderGeometry'&&o.position.z===1.215);assert.equal(flanges.length,n);
 for(let i=1;i<flanges.length;i++){const a=flanges[i-1],b=flanges[i];assert(b.position.x-a.position.x>a.geometry.parameters.radiusTop+b.geometry.parameters.radiusTop);}}
});
