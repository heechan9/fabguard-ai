import * as THREE from './vendor/three.module.js';
import {AGV_NAME,AGV_ROUTE,AGV_SIZE} from './floor-agv-model.mjs';
// Concept primitives, not physical dimensions, collision avoidance or certified safety.
export function mountFloorAgv(scene,{box,cylinder,label}){
 const route=new THREE.Group();route.name='synthetic-floor-agv-route';scene.add(route);
 for(let i=1;i<AGV_ROUTE.length;i++){
  const a=AGV_ROUTE[i-1],b=AGV_ROUTE[i];
  box(route,Math.abs(a.x-b.x)||.07,.025,Math.abs(a.z-b.z)||.07,(a.x+b.x)/2,-.105,(a.z+b.z)/2,0xe8aa4e);
 }
 for(const x of [-5,0,5])for(const sign of [-1,1]){
  const arrow=box(route,.36,.03,.065,x,-.08,4+sign*.12,0xffcf70);arrow.rotation.y=sign*Math.PI/4;
 }
 box(route,2,.025,1.6,8,-.1,7,0x527988);
 label(route,'고정 경로 · 합성 자재',0,.28,5.5);
 const obstacle=new THREE.Group();obstacle.name='synthetic-route-obstacle';route.add(obstacle);obstacle.position.set(-5.5,0,7);
 box(obstacle,.18,.7,1.5,0,.22,0,0xd75948);
 for(const z of [-.56,.56])box(obstacle,.5,.12,.25,0,-.06,z,0xe8aa4e);
 label(obstacle,'가상 경로 막힘',0,1.1,0);obstacle.visible=false;
 const root=new THREE.Group();root.name='synthetic-floor-agv-a01';root.userData.floorAgv=true;scene.add(root);
 box(root,AGV_SIZE.length,.34,AGV_SIZE.width,0,.31,0,0xe8aa4e);
 box(root,AGV_SIZE.length,.13,AGV_SIZE.width,0,.17,0,0x344e5c);
 const wheels=[];
 for(const x of [-.48,.48])for(const z of [-.55,.55]){
  const wheel=cylinder(root,AGV_SIZE.wheelRadius,.15,x,.06,z,0x182630);wheel.rotation.x=Math.PI/2;wheel.name='agv-wheel';wheels.push(wheel);
 }
 const tray=box(root,1.2,.12,.86,0,.54,0,0xc4d6df);tray.name='synthetic-material-tray';
 for(const z of [-.4,.4])box(root,1.2,.2,.06,0,.66,z,0x527988);
 for(const x of [-.57,.57])box(root,.06,.2,.86,x,.66,0,0x527988);
 for(const x of [-.3,.3])box(root,.37,.2,.46,x,.7,0,0x7aa2ac);
 const beacon=cylinder(root,.09,.13,-.6,.6,0,0x43b998);
 label(root,AGV_NAME,0,1.28,0);
 return {root,route,obstacle,update(pose){
  root.position.set(pose.x,0,pose.z);root.rotation.y=pose.heading;
  for(const wheel of wheels)wheel.rotation.y=pose.distance/AGV_SIZE.wheelRadius;
  root.userData.phase=pose.phase;root.userData.distance=pose.distance;
  obstacle.visible=pose.phase==='blocked';
  beacon.material.color.setHex(pose.phase==='blocked'?0xd75948:pose.phase==='wait'?0xe8aa4e:0x43b998);
 }};
}
