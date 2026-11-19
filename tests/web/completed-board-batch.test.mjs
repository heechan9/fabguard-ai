import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {detailPCB} from '../../web/smt/placement-details.mjs';
import {CompletedBoardBatch} from '../../web/smt/completed-board-batch.mjs';

function board(scene, id, height, color, stripe) {
  const group = new THREE.Group();
  group.userData.boardId = id;
  group.position.set(13.395, height, .25);
  const box = (size, at, tint) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({color:tint, metalness:.28, roughness:.52}));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.set(...at);
    group.add(mesh);
    return mesh;
  };
  group.userData.pcb = box([.67,.07,.79], [0,0,0], color);
  for (let i=0; i<4; i++) box([.13,.065,.16], [-.19+i%2*.34,.065,-.2+Math.floor(i/2)*.34], 0x273d46);
  box([.64,.015,.065], [0,.05,.34], stripe);
  detailPCB(group);
  scene.add(group);
  return group;
}

test('settled board instances match the original shapes and colors, preserve picking and restore for replay', () => {
  const scene = new THREE.Scene();
  const lower = board(scene,'PCB-001',1.11,0x287c63,0x9bcbe4);
  const upper = board(scene,'PCB-005',1.26,0xf0b944,0xe3c693);
  const active = board(scene,'PCB-006',1.11,0x287c63,0xe3c693);
  active.position.x = 5;
  scene.updateMatrixWorld(true);
  const solids = [...lower.children,...upper.children].filter(mesh=>!mesh.material.vertexColors);
  const expected = solids.map(mesh=>({
    box:new THREE.Box3().setFromObject(mesh), color:mesh.material.color.clone(),
    castShadow:mesh.castShadow, receiveShadow:mesh.receiveShadow
  }));
  const originals = [...upper.children], marks = originals.at(-1);
  const ray = new THREE.Raycaster(new THREE.Vector3(upper.position.x,4,upper.position.z), new THREE.Vector3(0,-1,0));
  const pick = () => ray.intersectObjects([lower,upper,active],true)[0];
  const firstHit = pick();
  const batch = new CompletedBoardBatch(scene, lower);
  batch.add(lower);batch.add(upper);batch.add(upper);
  scene.updateMatrixWorld(true);
  assert.equal(batch.solids.count,12);assert.equal(batch.markings.count,2);
  assert.equal(pick().object,firstHit.object);assert.equal(pick().distance,firstHit.distance);
  assert.equal(upper.visible,true);assert.equal(upper.parent,scene);
  let visibleSolids=0;
  lower.traverseVisible(mesh=>{if(mesh.isMesh) visibleSolids++;});
  upper.traverseVisible(mesh=>{if(mesh.isMesh) visibleSolids++;});
  assert.equal(visibleSolids,0);assert.equal(active.children.length,7);
  assert.equal(batch.solids.material.roughness,lower.userData.pcb.material.roughness);
  assert.equal(batch.solids.material.metalness,lower.userData.pcb.material.metalness);
  const matrix=new THREE.Matrix4(),color=new THREE.Color();
  batch.solids.geometry.computeBoundingBox();
  expected.forEach((source,i)=>{
    batch.solids.getMatrixAt(i,matrix);batch.solids.getColorAt(i,color);
    const result=batch.solids.geometry.boundingBox.clone().applyMatrix4(matrix);
    assert(result.min.distanceTo(source.box.min)<1e-5 && result.max.distanceTo(source.box.max)<1e-5);
    assert(color.toArray().every((value,j)=>Math.abs(value-source.color.toArray()[j])<1e-6));
    assert.equal(batch.solids.castShadow,source.castShadow);assert.equal(batch.solids.receiveShadow,source.receiveShadow);
  });
  assert.deepEqual(batch.markings.geometry.attributes.color.array,marks.geometry.attributes.color.array);
  assert.equal(batch.markings.material.vertexColors,true);assert.equal(batch.markings.castShadow,marks.castShadow);
  assert.equal(batch.markings.receiveShadow,marks.receiveShadow);
  const version=batch.solids.instanceMatrix.version;
  batch.add(lower);assert.equal(batch.solids.instanceMatrix.version,version);
  batch.dispose();scene.updateMatrixWorld(true);
  assert.deepEqual(upper.children,originals);assert.equal(pick().object,firstHit.object);
  assert.equal(scene.children.some(mesh=>mesh.isInstancedMesh),false);
  assert.equal(lower.userData.pcb.material.visible,true);
});
