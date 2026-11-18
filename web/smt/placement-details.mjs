// Original explanatory geometry, not vendor CAD or a physical/digital-twin model.
import * as THREE from './vendor/three.module.js';
export const PARTS=Object.freeze({nozzle:'노즐',rail:'가이드 레일',feeder:'부품 공급기',pcb:'기판'});
export function mountPlacementDetails(machine,head,width,feederCount=6){
 const root=new THREE.Group();root.name='schematic-placement-details';machine.add(root);
 const parts={nozzle:[],rail:[],feeder:[],pcb:[]};
 const materials={steel:new THREE.MeshStandardMaterial({color:0xadbcc6,metalness:.75,roughness:.27}),
  black:new THREE.MeshStandardMaterial({color:0x24313d,metalness:.25,roughness:.65}),
  gold:new THREE.MeshStandardMaterial({color:0xd4b978,metalness:.7,roughness:.33}),
  teal:new THREE.MeshStandardMaterial({color:0x397d89,metalness:.35,roughness:.38})};
 // Per-category materials allow highlighting without modifying any status colour.
 const shared=new Map();
 function add(parent,geometry,xyz,material,part){
  const key=part+material;if(!shared.has(key))shared.set(key,materials[material].clone());
  const mesh=new THREE.Mesh(geometry,shared.get(key));mesh.position.set(...xyz);mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.userData.explanatoryPart=part;parent.add(mesh);parts[part].push(mesh);return mesh;
 }
 const box=(parent,w,h,d,xyz,mat,part)=>add(parent,new THREE.BoxGeometry(w,h,d),xyz,mat,part);
 const cylinder=(parent,r,h,xyz,mat,part)=>add(parent,new THREE.CylinderGeometry(r,r,h,20),xyz,mat,part);
 // Fixed X guides stay above the PCB corridor; they do not imply kinematic constraints.
 for(const z of [-.48,.48]){
  box(root,width-.3,.09,.085,[0,1.88,z],'steel','rail');
  for(const x of [-width*.35,width*.35])box(root,.13,.16,.16,[x,1.87,z],'black','rail');
 }
 const carriage=box(head,.34,.13,.58,[0,.18,0],'teal','nozzle');
 cylinder(head,.14,.06,[0,-.02,0],'steel','nozzle');
 // The existing head is the visible nozzle body. Keep its geometry/pose intact.
 // Own its highlight material; never tint other meshes sharing the source material.
 const headMaterial=head.material.clone();head.material=headMaterial;
 head.userData.explanatoryPart='nozzle';parts.nozzle.push(head);
 // Dress the existing feeder bank rather than overlaying duplicate bases/reels.
 for(let k=0;k<feederCount;k++){
  const x=-width*.31+k*width*.62/(feederCount-1);
  box(root,.075,.012,.40,[x,1.097,1.05],'gold','feeder');
  const hub=cylinder(root,.047,.02,[x,.78,1.215],'steel','feeder');hub.rotation.x=Math.PI/2;
 }
 // Unlit border means selected part, not a measured heat/stress field.
 const pcbOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.73,.10,.85)),new THREE.LineBasicMaterial({color:0x7fe8ff}));
 // Decorative selection outline is never a hit target, including while hidden.
 pcbOutline.raycast=()=>{};
 pcbOutline.visible=false;machine.add(pcbOutline);
 let selected=null;
 function select(part){
  selected=Object.hasOwn(PARTS,part)?part:null;
  for(const meshes of Object.values(parts))for(const mesh of meshes){mesh.material.emissive.setHex(mesh.userData.explanatoryPart===selected?0x247a87:0);mesh.material.emissiveIntensity=.48;}
  pcbOutline.visible=false;
 }
 function update(board,localX){pcbOutline.visible=selected==='pcb'&&Boolean(board);if(board)pcbOutline.position.set(localX,1.11,0);}
 // Dispose the unused material templates; live per-category clones remain owned by scene.
 for(const material of Object.values(materials))material.dispose();
 return {root,parts,carriage,pcbOutline,select,update,get selected(){return selected;}};
}
export function detailPCB(group){
 // Decorative pads live on the PCB surface and never carry status or measured values.
 const material=new THREE.MeshStandardMaterial({color:0xc5aa65,metalness:.65,roughness:.4});
 const geometry=new THREE.BoxGeometry(.035,.006,.045);
 for(let i=0;i<8;i++){const pad=new THREE.Mesh(geometry,material);pad.position.set(-.27+i*.077,.04,-.34);group.add(pad);}
}
