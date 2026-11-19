import * as THREE from './vendor/three.module.js';
import {buildProcessHousing} from './process-housings.mjs';
import {buildSupplyCassette,buildRecoveryBed} from './line-transport.mjs';
// Original schematic geometry for explaining station roles; not vendor CAD.
export const shouldAutoRevealInterior=stationIndex=>stationIndex===6;

// Formed sheet or optical bezel. Hidden covers must not intercept station picking.
function fittedMesh(parent,geometry,color,at) {
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.36}));
  mesh.position.set(...at);mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.raycast=function(ray,hits){
    for(let part=this;part;part=part.parent)if(!part.visible)return;
    THREE.Mesh.prototype.raycast.call(this,ray,hits);
  };
  parent.add(mesh);return mesh;
}

function stencilPrinter(group,cover,w,box) {
  // Keep the front two thirds of the stencil exposed, including the blade contact edge.
  const hoodProfile=new THREE.Shape([
    new THREE.Vector2(.85,1.27),new THREE.Vector2(.85,2.03),new THREE.Vector2(.58,2.12),
    new THREE.Vector2(.20,2.12),new THREE.Vector2(-.02,1.98),new THREE.Vector2(-.02,1.89),
    new THREE.Vector2(.23,2.02),new THREE.Vector2(.59,2.02),new THREE.Vector2(.76,1.95),
    new THREE.Vector2(.76,1.27)
  ]);
  const hood=new THREE.ExtrudeGeometry(hoodProfile,{depth:w-.08,bevelEnabled:false});
  hood.rotateY(Math.PI/2);hood.translate(-(w-.08)/2,0,0);
  fittedMesh(cover,hood,0xa9bdc1,[0,0,0]);
  for(const side of [-1,1]){
    const x=side*w*.415;
    box(cover,.12,.77,.18,x,1.30,-.75,0x607482);
    box(cover,.10,.10,1.34,x,1.65,.04,0x728b93);
    box(group,.080,.22,.12,x,1.246,.56,0x566b72);
    box(group,.085,.09,1.24,x,1.385,.04,0x347979);
  }
  for(const z of [-.54,.63])box(group,w*.79,.075,.07,0,1.385,z,0x347979);

  const stencil=new THREE.Shape();
  const sx=w*.382,sz=.54;
  stencil.moveTo(-sx,-sz);stencil.lineTo(sx,-sz);stencil.lineTo(sx,sz);stencil.lineTo(-sx,sz);stencil.closePath();
  for(const x of [-.47,-.16,.16,.47])for(const y of [-.30,-.12]){
    const opening=new THREE.Path();
    opening.moveTo(x-.079,y-.044);opening.lineTo(x-.079,y+.044);
    opening.lineTo(x+.079,y+.044);opening.lineTo(x+.079,y-.044);opening.closePath();
    stencil.holes.push(opening);
  }
  const foil=new THREE.ShapeGeometry(stencil);
  foil.rotateX(-Math.PI/2);
  fittedMesh(group,foil,0xb9c7c8,[0,1.390,.03]).castShadow=false;
  // A separate clamp and angled blade leave a visible dark wiping edge on the foil.
  for(const x of [-w*.36,w*.36]){
    box(group,.12,.26,.20,x,1.53,-.04,0x465e68);
    box(group,.15,.085,.36,x,1.66,-.07,0xc0cbcb);
  }
  box(group,w*.78,.14,.13,0,1.61,-.05,0x537d83);
  const blade=box(group,w*.65,.22,.045,0,1.494,.035,0xc6d0ce);blade.rotation.x=-.27;
  box(group,w*.65,.029,.045,0,1.397,.065,0x36464a);
}

function opticalInspection(group,cover,w,box,cylinder) {
  // The octagonal annular hood leaves the sloping cameras and light ring on view.
  function annulus(parent,profile,sides,y,z,color) {
    const points=profile.map(([radius,height])=>new THREE.Vector2(radius,height));
    return fittedMesh(parent,new THREE.LatheGeometry(points,sides),color,[0,y,z]);
  }
  for(const x of [-w*.38,w*.38]){
    box(group,.13,1.19,.15,x,1.52,-.66,0x708690);
    box(group,.18,.12,.72,x,2.09,-.38,0x455e6e);
  }
  box(group,w*.83,.14,.15,0,2.10,-.34,0x5e7684);
  box(cover,w*.85,.19,.30,0,2.23,-.57,0x486079);
  annulus(cover,[[.52,-.10],[.66,-.10],[.76,-.035],[.65,.14],[.46,.16],
    [.42,.10],[.49,-.07],[.52,-.10]],8,2.12,.05,0x416383);
  annulus(cover,[[.72,-.018],[.757,-.018],[.757,.015],[.72,.016],[.72,-.018]],
    8,2.106,.05,0xa7bdc7);
  // The optical head hangs from a rear cantilever. Its three camera pods point inward.
  box(group,.17,.12,.47,0,2.33,-.265,0x7f919c);
  box(group,.16,.24,.14,0,2.25,-.41,0x7f919c);
  box(group,.27,.26,.27,0,2.28,.029,0x263b4a);
  cylinder(group,.106,.23,0,2.04,.029,0x667c88);
  cylinder(group,.086,.064,0,1.904,.029,0x273a46);
  const target=new THREE.Vector3(0,1.30,.04);
  for(const a of [Math.PI/2,-Math.PI/2,Math.PI]){
    const center=new THREE.Vector3(.37*Math.sin(a),1.951,.04+.37*Math.cos(a));
    const axis=center.clone().sub(target).normalize();
    const mount=box(group,.16,.28,.17,...center.toArray(),0x344752);
    mount.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    const lensAt=center.clone().addScaledVector(axis,-.175);
    const lens=cylinder(group,.068,.13,...lensAt.toArray(),0xa0b2ba);
    lens.quaternion.copy(mount.quaternion);
    const front=lensAt.addScaledVector(axis,-.068);
    const face=cylinder(group,.055,.015,...front.toArray(),0x173c50);
    face.quaternion.copy(mount.quaternion);
  }
  for(const x of [-.36,.36])box(group,.04,.20,.05,x,1.79,.04,0x536977);
  annulus(group,[[.30,-.041],[.418,-.041],[.44,-.016],[.435,.034],[.30,.042],
    [.30,-.041]],32,1.70,.04,0x374e5b);
  annulus(group,[[.31,-.012],[.43,-.012],[.436,.012],[.31,.014],[.31,-.012]],
    32,1.666,.04,0xe4dcc4);
  const scan=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.RingGeometry(.168,.19,24),
    new THREE.MeshBasicMaterial({color:0x82bdde,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.set(0,.024,.04);ring.raycast=()=>{};
  scan.add(ring);scan.position.y=1.3;group.add(scan);group.userData.scan=scan;
}

export function detailMachine(i,group,cover,w,box,cylinder){
 if(i===2||i===6)return buildProcessHousing(i,group,cover,w);
 if(i===0)buildSupplyCassette(group,cover,w,box);
 if(i===10)buildRecoveryBed(group,w,box,cylinder);
 const steel=0x728996,panel=0xc4d1d6,dark=0x213b48;
 // Low cabinet seams and ventilation, shared across the line.
 for(const x of [-w*.25,w*.25])box(group,.018,.42,.02,x,.43,.895,dark);
 for(let k=0;k<4;k++)box(group,.3,.018,.025,-w*.27,.29+k*.06,-.88,steel);
 if([3,4].includes(i)){
  // Solid side shoulders frame a front viewing window.
  for(const x of [-w/2+.16,w/2-.16])box(cover,.25,1.13,1.72,x,1.56,0,panel);
  box(cover,w,.16,1.86,0,2.27,0,dark);
  box(cover,.12,.25,.04,w*.31,1.52,.89,steel);
 }
 if(i===1)stencilPrinter(group,cover,w,box);
 if(i===8)opticalInspection(group,cover,w,box,cylinder);
 if(i===3||i===4){ // Front feeder bank, clear of the PCB transport path.
  for(let k=0;k<(i===3?6:4);k++){
   const x=-w*.31+k*w*.62/(i===3?5:3);
   box(group,.13,.14,.48,x,1.02,1.05,steel);
   const reel=cylinder(group,.15,.07,x,.78,1.17,dark);reel.rotation.x=Math.PI/2;
  }
 }
 if([5,7,9].includes(i)){
  for(let k=0;k<7;k++){const roller=cylinder(group,.055,1.04,-w*.4+k*w*.8/6,1.0,0,steel);roller.rotation.x=Math.PI/2;}
 }
}
export function dressFloor(scene,positions,widths,box){
 const zones=[{a:0,b:2,color:0x16383e},{a:3,b:5,color:0x1d303e},{a:6,b:7,color:0x39342c},{a:8,b:10,color:0x153b36}];
 for(const {a,b,color} of zones){const left=positions[a]-widths[a]/2-.25,right=positions[b]+widths[b]/2+.25;box(scene,right-left,.012,3.45,(left+right)/2,-.038,0,color);}
 // Subtle aisle boundary and directional chevrons: no animated fake throughput.
 for(const z of [-2.1,2.1])box(scene,36,.009,.035,0,-.12,z,0x507d7b);
 for(let k=0;k<9;k++)for(const sign of [-1,1]){const stroke=box(scene,.35,.014,.045,-14+k*3.5,-.11,2.65+sign*.11,0x78aaa5);stroke.rotation.y=sign*Math.PI/4;}
}
