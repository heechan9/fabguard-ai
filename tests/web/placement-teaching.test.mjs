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
    const {radius,tube}=rims.geometry.parameters;
    assert.ok((radius+tube)*2 < 2.25*.62/(count-1));
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
