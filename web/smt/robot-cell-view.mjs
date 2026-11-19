import * as THREE from './vendor/three.module.js';
import {batchFixedSolids} from './line-transport.mjs';
import {DESTINATIONS,ROBOT_NAME,robotPose,robotRoute,RECOVERY_LANE_Z} from './robot-cell-model.mjs';
// Concept mechanism with two articulated links, not manufacturer CAD or robot kinematics.
export function mountRobotCell(scene,x,{box,cylinder,label},unloaderOffset){
 const root=new THREE.Group();root.position.x=x;root.userData.robotCell=true;scene.add(root);
 cylinder(root,.3,.55,.85,.35,1.15,0x527988);
 const shoulder=new THREE.Vector3(.85,.75,1.15);
 const joint=cylinder(root,.14,.25,shoulder.x,shoulder.y,shoulder.z,0xe8aa4e);
 const links=[0,1].map(()=>cylinder(root,.095,1,0,1,0,0xe4ecef));
 const gripper=box(root,.36,.18,.38,0,1.9,0,0xe8aa4e);
 for(const side of [-1,1])box(gripper,.055,.22,.34,side*.19,-.12,0,0x344e5c);
 const palettes={ok:0x43b998,ng:0xd75948,review:0xe8aa4e},trays={},routes={};
 for(const [key,d] of Object.entries(DESTINATIONS)){
  trays[key]=box(root,1.05,.12,1.2,d.x,.94,d.z,palettes[key]);
  // A static schematic cue connects the selected board's disclosed route to its tray.
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.16,0),new THREE.Vector3(d.x,.16,d.z)]);
  routes[key]=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:palettes[key]}));
  routes[key].visible=false;root.add(routes[key]);
  label(root,d.label,d.x,.45,d.z);
 }
 // The recovery shuttle takes only normal boards. Its guide passes in front of the
 // robot pedestal and behind the side-by-side OK/review trays before entering 11.
 const track=new THREE.Group();
 root.add(track);
 const lane=RECOVERY_LANE_Z,entry=DESTINATIONS.ok.z;
 const steel=0x63808b,guide=0x77a899;
 box(track,.71,.08,entry-lane,0,1.00,(entry+lane)/2,steel);
 box(track,unloaderOffset+.76,.10,.86,unloaderOffset/2,.975,lane,steel);
 for(const side of [-1,1]){
  box(track,unloaderOffset+.76,.03,.035,unloaderOffset/2,1.039,lane+side*.39,guide);
  const slot=unloaderOffset+side*.38;
  box(track,.70,.085,lane-.90,slot,.995,(lane+.90)/2,steel);
  for(const edge of [-1,1])box(track,.027,.03,lane-.90,slot+edge*.32,1.045,(lane+.90)/2,guide);
 }
 for(const dx of [.20,unloaderOffset-.18]){
  box(track,.09,1.0,.09,dx,.46,lane+.30,steel);
 }
 batchFixedSolids(track);
 const shuttle=new THREE.Group();
 for(const side of [-1,1])box(shuttle,.055,.055,.78,side*.265,-.063,0,0xe4c886);
 box(shuttle,.58,.045,.075,0,-.068,.33,0x94a6ab);
 batchFixedSolids(shuttle);root.add(shuttle);shuttle.visible=false;
 label(root,ROBOT_NAME,.85,3.1,1.15);
 function segment(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());}
 return {root,showShuttle(position){
  shuttle.visible=Boolean(position);
  if(position)shuttle.position.set(position.x,position.y,position.z);
 },update(boards,selectedId){
  const selected=boards.find(b=>b.id===selectedId),route=selected?robotPose(selected).route:null;
  for(const key of Object.keys(DESTINATIONS)){routes[key].visible=route===key;trays[key].material.emissive.setHex(route===key?palettes[key]:0x000000);trays[key].material.emissiveIntensity=route===key?.35:0;}
  const active=boards.find(b=>b.stage===9);
  const rank=active?boards.filter(b=>b.stage>9 && robotRoute(b)===robotRoute(active)).length:0;
  const pose=active&&robotPose(active,rank);
  const p=pose?.position||{x:0,y:1.8,z:0};
  const end=new THREE.Vector3(p.x,p.y+.26,p.z),elbow=new THREE.Vector3((shoulder.x+end.x)/2,2.5,(shoulder.z+end.z)/2);
  segment(links[0],shoulder,elbow);segment(links[1],elbow,end);joint.rotation.y=Math.atan2(end.x-shoulder.x,end.z-shoulder.z);gripper.position.copy(end);
 }};
}
