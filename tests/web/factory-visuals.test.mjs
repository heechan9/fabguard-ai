import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {detailMachine,dressFloor,shouldAutoRevealInterior} from '../../web/smt/factory-visuals.mjs';

// Construct real Three.js geometry without requiring a GPU or WebGL canvas.
const box=(parent,w,h,d,x,y,z,color)=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));
 mesh.position.set(x,y,z);parent.add(mesh);return mesh;
};
const cylinder=(parent,r,h,x,y,z,color)=>{
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),new THREE.MeshStandardMaterial({color}));
 mesh.position.set(x,y,z);parent.add(mesh);return mesh;
};
const widths=[1.7,2.25,2.25,2.25,2.25,1.45,4.4,1.45,2.25,1.45,1.7];
function machine(i){const group=new THREE.Group(),cover=new THREE.Group();group.add(cover);detailMachine(i,group,cover,widths[i],box,cylinder);group.updateMatrixWorld(true);return {group,cover};}
function dispose(root){root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}

test('all added station and floor geometry has finite transformed vertices and valid bounds',()=>{
 const scene=new THREE.Scene();let offset=0;
 const positions=widths.map(w=>{const x=offset+w/2;offset+=w+.65;return x;}).map(x=>x-18);
 widths.forEach((_,i)=>{const {group}=machine(i);group.position.x=positions[i];scene.add(group);});
 dressFloor(scene,positions,widths,box);scene.updateMatrixWorld(true);
 let count=0;
 try{scene.traverse(o=>{if(!o.isMesh)return;count++;const vertices=o.geometry.getAttribute('position');
  for(let i=0;i<vertices.count;i++){const v=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(o.matrixWorld);assert.ok(v.toArray().every(Number.isFinite));}
  const bounds=new THREE.Box3().setFromObject(o);assert.ok(!bounds.isEmpty());assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));
 });assert.ok(count>0);}finally{dispose(scene);}
});

test('inspection and heating assemblies clear the populated PCB from entrance to exit',()=>{
 assert.equal(shouldAutoRevealInterior(6),true);
 assert.equal(shouldAutoRevealInterior(5),false);
 const corridor=new THREE.Box3(new THREE.Vector3(-3,1.075,-.395),new THREE.Vector3(3,1.208,.395));
 for(const stage of [2,6]){
  const {group,cover}=machine(stage);
  let triangles=0;
  const ray=new THREE.Raycaster(), m=new THREE.Matrix4(), t=new THREE.Triangle();
  const instance=new THREE.Matrix4();
  try{
   group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const g=mesh.geometry,positions=g.getAttribute('position');
    for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++){
     m.copy(mesh.matrixWorld);
     if(mesh.isInstancedMesh){mesh.getMatrixAt(n,instance);m.multiply(instance);}
     for(let i=0;i<(g.index?.count??positions.count);i+=3){
      [t.a,t.b,t.c].forEach((v,j)=>v.fromBufferAttribute(positions,g.index?g.index.getX(i+j):i+j).applyMatrix4(m));
      assert.ok(!corridor.intersectsTriangle(t),'part in board corridor');
      triangles++;
     }
    }
   });
   assert.ok(triangles>0);
   if(stage===6){
    // At transport height the folded sidewalls remain outboard of the board edges.
    // On both sides at mid-height, the inner wall lies more than .38 from the board.
    for (const sign of [-1,1]){
     ray.set(new THREE.Vector3(0,1.34,0),new THREE.Vector3(0,0,sign));
     const hit=ray.intersectObjects(cover.children,true)[0];
     assert.ok(hit && Math.abs(hit.point.z)-.395>.38);
    }
   }else assert.ok(group.userData.scan);
  }finally{dispose(group);}
 }
});
