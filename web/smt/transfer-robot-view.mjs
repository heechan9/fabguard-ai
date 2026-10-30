import * as THREE from './vendor/three.module.js';
import {TRANSFER_NAME,transferRobotPose,activeTransferBoard} from './transfer-robot-model.mjs';
// A distinct Cartesian gantry concept made only from existing Three.js primitives.
// Supports stand outside the conveyor; raised travel never crosses a machine roof.
export function mountTransferRobot(scene,x,{box,cylinder,label}){
 const root=new THREE.Group();root.position.x=x;root.userData.transferRobot=true;root.name='synthetic-transfer-robot-r02';scene.add(root);
 const steel=0x527988,accent=0x43b998,dark=0x344e5c;
 for(const xx of [-1.28,1.28]){
  box(root,.52,.14,.56,xx,.04,1.35,dark);
  box(root,.18,2.85,.2,xx,1.49,1.35,steel);
  box(root,.28,.13,.32,xx,2.86,1.35,accent);
 }
 box(root,2.85,.2,.24,0,2.94,1.35,steel);
 box(root,2.65,.055,.06,0,3.06,1.2,accent);
 const carriage=new THREE.Group();root.add(carriage);
 box(carriage,.38,.3,.42,0,2.94,1.35,accent);
 box(carriage,.18,.16,1.5,0,2.88,.64,steel);
 const slide=cylinder(carriage,.055,1,0,2.2,0,dark);
 const gripper=box(carriage,.42,.13,.44,0,1.4,0,accent);
 for(const side of [-1,1])box(gripper,.055,.19,.3,side*.23,-.1,0,dark);
 // R-02 remains visibly separate from the R-01 sort cell even when idle.
 label(root,TRANSFER_NAME,0,3.58,1.35);
 return {root,update(boards,time){
  const active=activeTransferBoard(boards),pose=transferRobotPose(boards,time);
  const p=pose.position;
  carriage.position.x=p.x;
  gripper.position.y=p.y+.24;
  slide.position.y=(2.8+gripper.position.y)/2;
  slide.scale.y=2.8-gripper.position.y;
  root.userData.phase=pose.phase;root.userData.activeBoardId=active?.id||null;
 }};
}
