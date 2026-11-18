import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {buildPlacementHousing} from '../../web/smt/placement-housing.mjs';
function build(n=6){const machine=new THREE.Group(),cover=new THREE.Group();machine.add(cover);const result=buildPlacementHousing(machine,cover,2.25,n);machine.updateMatrixWorld(true);return {machine,cover,...result};}
test('engineering housing is finite, compact and has bounded render cost',()=>{
 for(const n of [4,6]){const {machine}=build(n);let meshes=0,triangles=0;machine.traverse(o=>{if(!o.isMesh)return;meshes++;const g=o.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
 const bounds=new THREE.Box3().setFromObject(machine);for(const v of [...bounds.min.toArray(),...bounds.max.toArray()])assert(Number.isFinite(v));assert(bounds.min.x>=-1.4&&bounds.max.x<=1.4);assert(bounds.max.z<=1.31);assert(bounds.max.y<2.6);assert(meshes<125,`mesh count ${meshes}`);assert(triangles<18000,`triangles ${triangles}`);
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
 let decorations=0;machine.traverse(o=>{if(!o.isMesh||o.raycast===THREE.Mesh.prototype.raycast)return;const hits=[];o.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);decorations++;});assert(decorations>40);
});
test('feeder and bridge highlight the visible assemblies, reset and remain isolated',()=>{
 const a=build(),b=build();a.select('feeder');let lit=0;
 a.machine.traverse(o=>{if(!o.isMesh)return;if(o.userData.explanatoryPart==='feeder'){assert.equal(o.material.emissive.getHex(),0x247a87);lit++;}else if(o.userData.explanatoryPart==='rail')assert.equal(o.material.emissive.getHex(),0);});assert(lit>30);
 b.machine.traverse(o=>{if(o.isMesh&&o.userData.explanatoryPart)assert.equal(o.material.emissive.getHex(),0);});
 a.select(null);a.machine.traverse(o=>{if(o.isMesh&&o.userData.explanatoryPart)assert.equal(o.material.emissive.getHex(),0);});
});
