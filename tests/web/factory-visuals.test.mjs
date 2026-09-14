import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {detailMachine,dressFloor} from '../../web/smt/factory-visuals.mjs';

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

test('added reflow cover stays clear of the bare PCB swept volume in three dimensions',()=>{
 const {group,cover}=machine(6);
 // Current app: PCB .67 x .07 x .79, center y=1.11 and z=0.
 // Sweep through the entire station, including entry and exit.
 const path=new THREE.Box3(new THREE.Vector3(-3,1.075,-.395),new THREE.Vector3(3,1.145,.395));
 try{cover.traverse(o=>{if(o.isMesh)assert.equal(new THREE.Box3().setFromObject(o).intersectsBox(path),false,'cover intersects PCB transport corridor');});
  const sidePanels=cover.children.filter(o=>o.geometry.parameters.height===.85);
  assert.equal(sidePanels.length,2);
  for(const panel of sidePanels){const b=new THREE.Box3().setFromObject(panel);const gap=panel.position.z>0?b.min.z-path.max.z:path.min.z-b.max.z;assert.ok(gap>.38);}
 }finally{dispose(group);}
});
