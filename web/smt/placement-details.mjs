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
  // Decorations do not expand the original station pointer-picking area.
  mesh.raycast=()=>{};
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
 // One surface draw travels with the same board ID through every station. The gold
 // edge fingers and white orientation mark do not encode measurements or board status.
 const coords=[], colors=[];
 const copper=new THREE.Color(0xba9951),silk=new THREE.Color(0xe5eee2);
 function triangle(a,b,c,color){
  for(const [x,z] of [a,b,c]){coords.push(x,.041,z);colors.push(color.r,color.g,color.b);}
 }
 function strip(x,z,w,d,color=copper){
  const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
  triangle([x0,z0],[x0,z1],[x1,z1],color);
  triangle([x0,z0],[x1,z1],[x1,z0],color);
 }
 for(let i=0;i<8;i++)strip(-.27+i*.077,-.34,.035,.045);
 for(let i=0;i<7;i++)strip(.296,-.22+i*.063,.057,.037);
 for(let i=0;i<4;i++){
  const z=-.235+i*.127;
  strip(-.055,z,.38,.011);strip(.129,z+.020,.011,.046);
 }
 triangle([-.299,.235],[-.299,.296],[-.223,.265],silk);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 const markings=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.48}));
 markings.raycast=()=>{};
 group.add(markings);
}
