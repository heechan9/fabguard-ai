import * as THREE from './vendor/three.module.js';
import {DESTINATIONS,ROBOT_NAME,robotPose} from './robot-cell-model.mjs';
// Concept mechanism with two articulated links, not manufacturer CAD or robot kinematics.
export function mountRobotCell(scene,x,{box,cylinder,label}){
 const root=new THREE.Group();root.position.x=x;root.userData.robotCell=true;scene.add(root);
 cylinder(root,.3,.55,.85,.35,1.15,0x527988);
 const shoulder=new THREE.Vector3(.85,.75,1.15);
 const joint=cylinder(root,.14,.25,shoulder.x,shoulder.y,shoulder.z,0xe8aa4e);
 const links=[0,1].map(()=>cylinder(root,.095,1,0,1,0,0xe4ecef));
 const gripper=box(root,.36,.18,.38,0,1.9,0,0xe8aa4e);
 for(const side of [-1,1])box(gripper,.055,.22,.34,side*.19,-.12,0,0x344e5c);
 const palettes={ok:0x43b998,ng:0xd75948,review:0xe8aa4e};
 for(const [key,d] of Object.entries(DESTINATIONS)){
  box(root,1.05,.12,1.2,d.x,.94,d.z,palettes[key]);
  label(root,d.label,d.x,.45,d.z);
 }
 label(root,ROBOT_NAME,.85,3.1,1.15);
 function segment(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());}
 return {root,update(boards){
  const active=boards.find(b=>b.stage===9),pose=active&&robotPose(active);
  const p=pose?.position||{x:0,y:1.8,z:0};
  const end=new THREE.Vector3(p.x,p.y+.26,p.z),elbow=new THREE.Vector3((shoulder.x+end.x)/2,2.5,(shoulder.z+end.z)/2);
  segment(links[0],shoulder,elbow);segment(links[1],elbow,end);joint.rotation.y=Math.atan2(end.x-shoulder.x,end.z-shoulder.z);gripper.position.copy(end);
 }};
}
