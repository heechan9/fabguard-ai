import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/smt/vendor/three.module.js';
import {buildPlacementHousing} from '../../web/smt/placement-housing.mjs';
import {mountPlacementDetails} from '../../web/smt/placement-details.mjs';
import {buildTeachingModel, FIELDS, STEPS} from '../../web/smt/placement-teaching.mjs';

function liveStation(count) {
  const station = new THREE.Group(), cover = new THREE.Group();
  station.position.x = -8;
  station.add(cover);
  station.userData.cover = cover;
  buildPlacementHousing(station,cover,2.25,count);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.48,12),new THREE.MeshStandardMaterial());
  head.position.set(-1.15,1.54,-.2);
  station.add(head);
  mountPlacementDetails(station,head,2.25,count).select('nozzle');
  cover.visible = false;
  return {station,head,cover};
}

test('teaching fields use distinct categorical colors on the actual 04/05 assemblies',()=>{
  for (const count of [4,6]) {
    const {station, head, cover} = liveStation(count);
    const initialEmissive = head.material.emissive.getHex();
    const sourceMaterial = head.children[0].material;
    const initialChildColor = sourceMaterial.color.getHex(),initialChildEmission=sourceMaterial.emissive.getHex();
    const guide = buildTeachingModel(station,count);
    for (const [mode, field] of Object.entries(FIELDS)) {
      guide.style(mode,0); guide.pose(mode,0);
      assert.equal(guide.groups.cover.visible,false);
      for(const [part, level] of Object.entries(field.levels)){
        assert.ok(guide.groups[part].children.length > 0);
        for(const mesh of guide.groups[part].children) assert.equal(mesh.material.color.getHex(),field.colors[level]);
      }
    }
    const copiedHead = guide.groups.nozzle.children.find(m=>m.geometry===head.children[0].geometry);
    assert.ok(copiedHead); assert.notEqual(copiedHead.material,sourceMaterial);
    assert.equal(sourceMaterial.color.getHex(),initialChildColor);
    assert.equal(sourceMaterial.emissive.getHex(),initialChildEmission);
    const bolts=station.getObjectByName('service-door-fasteners');
    assert.ok(bolts?.isInstancedMesh);
    guide.model.traverse(m=>assert.notEqual(m.geometry,bolts.geometry));
    const rims=guide.groups.feeder.children.find(m=>m.geometry.name==='open-reel-rim');
    assert.equal(rims.count,2*count);
    const byPlane=new Map(),matrix=new THREE.Matrix4();
    for(let i=0;i<rims.count;i++){
      rims.getMatrixAt(i,matrix);
      const bounds=new THREE.Box3().setFromBufferAttribute(rims.geometry.attributes.position).applyMatrix4(matrix);
      const z=new THREE.Vector3().setFromMatrixPosition(matrix).z;
      if(!byPlane.has(z))byPlane.set(z,[]);
      byPlane.get(z).push(bounds);
    }
    assert.equal(byPlane.size,2);
    for(const plane of byPlane.values()){
      plane.sort((a,b)=>a.min.x-b.min.x);
      assert.equal(plane.length,count);
      for(let i=1;i<plane.length;i++)
        assert.ok(plane[i].min.x>plane[i-1].max.x,'Adjacent rendered reel flanges must have a visible gap');
    }
    assert.ok(copiedHead.position.distanceTo(head.children[0].position.clone().add(new THREE.Vector3(0,1.8,0)))<1e-10);
    assert.deepEqual(head.position.toArray(),[-1.15,1.54,-.2]);
    assert.equal(head.material.emissive.getHex(),initialEmissive);
    assert.equal(cover.visible,false);
    guide.dispose();
  }
});

test('each assembly step adds the named subgroup and reverse traversal restores it',()=>{
  const guide = buildTeachingModel(liveStation(6).station,6);
  for (const step of [0,1,2,3,4,3,2,1,0]) {
    guide.style('assembly',step);guide.pose('assembly',step);
    STEPS.forEach(([id],i)=>{
      const group=guide.groups[id];
      assert.ok(group.children.length>0);
      assert.equal(group.visible,i<=step);
      if(group.visible) assert.equal(group.position.length(),0);
    });
  }
  guide.pose('assembly',3.5);
  assert.equal(guide.groups.cover.visible,true);
  assert.ok(guide.groups.cover.position.y>0);
  guide.dispose();
});

test('cutaway nut and spindle bearing share their shaft axes and retain open inspection sections',()=>{
  for(const n of [4,6]){
    const {station}=liveStation(n);
    const guide=buildTeachingModel(station,n);
    const find=(group,name)=>guide.groups[group].children.find(mesh=>mesh.geometry.name===name);
    const nut=find('nozzle','cross-slide-nut'),screw=find('rail','lead-screw-thread');
    const spindle=find('nozzle','stepped-spindle'),race=find('nozzle','sectioned-bearing-race');
    const apron=find('nozzle','machined-carriage-apron');
    for(const mesh of [nut,screw,spindle,race,apron])assert.ok(mesh);
    guide.model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(screw);
    const center=bounds.getCenter(new THREE.Vector3());
    const axis=new THREE.Vector3(0,1,0).applyQuaternion(nut.quaternion);
    assert.ok(Math.abs(axis.x)>.999);
    assert.ok(Math.abs(nut.position.y-center.y)<.002 && Math.abs(nut.position.z-center.z)<.002);
    assert.ok(Math.min(...nut.geometry.parameters.points.map(pt=>pt.x)) > (bounds.max.y-bounds.min.y)/2);
    assert.equal(spindle.position.x,race.position.x);assert.equal(spindle.position.z,race.position.z);
    assert.ok(race.geometry.parameters.phiLength<Math.PI*2);
    assert.ok(apron.geometry.parameters.shapes.holes.length>=2);
    const apronBox=new THREE.Box3().setFromObject(apron),nutBox=new THREE.Box3().setFromObject(nut);
    assert.ok(apronBox.min.z>bounds.max.z,'The carriage apron clears the screw thread');
    assert.ok(apronBox.intersectsBox(nutBox),'The apron meets the outside of the drive nut');
    guide.pose('assembly',2);assert.equal(guide.groups.nozzle.visible,false);
    guide.pose('assembly',3);assert.equal(guide.groups.nozzle.visible,true);
    guide.dispose();
  }
});
