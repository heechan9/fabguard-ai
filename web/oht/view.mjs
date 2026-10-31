import * as THREE from '../smt/vendor/three.module.js';
import {PORT_A,PORT_B} from './model.mjs';
export function mountOht(scene,{label}={}){
 const root=new THREE.Group();root.name='synthetic-oht-fab';scene.add(root);
 function box(parent,name,w,h,d,x,y,z,color){const material=new THREE.MeshStandardMaterial({color,roughness:.68,metalness:.15});const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 const floor=box(root,'context-floor',15,.12,8,0,-.08,0,0x8d9dab);
 const rail=box(root,'ceiling-rail',14,.18,.32,0,5.4,0,0x526979);
 for(const x of [-6,0,6])box(root,'ceiling-hanger',.1,1,.1,x,5.95,0,0x8194a5);
 const ports=[];
 for(const [id,x]of[['a',PORT_A],['b',PORT_B]]){
  const port=new THREE.Group();port.name=`loadport-${id}`;root.add(port);ports.push(port);
  box(port,`generic-equipment-${id}`,2.2,2.6,1.5,x,1.3,-1.8,0xb9c8d1);
  box(port,`equipment-panel-${id}`,1.5,.65,.05,x,1.75,-1.02,0x405e70);
  box(port,`port-support-${id}`,1.3,1.13,.85,x,.565,0,0x627c8b);
  box(port,`loadport-deck-${id}`,1.6,.16,1.2,x,1.21,0,0x4e7180);
  label?.(port,`PORT ${id.toUpperCase()}`,x,3.05,-1.8);
 }
 const vehicle=new THREE.Group();vehicle.name='oht-vehicle';root.add(vehicle);
 box(vehicle,'rail-bogie',1,.18,.55,0,5.3,0,0x344e5c);
 box(vehicle,'vehicle-body',1.6,.5,1.25,0,5,0,0x438b9c);
 box(vehicle,'vehicle-stripe',1.62,.1,1.26,0,5.05,0,0xe8b662);
 const hoist=box(root,'hoist-gripper',1.1,.12,.9,0,4.7,0,0x344e5c);
 const belts=[-.38,.38].map(z=>box(root,'hoist-belt',.055,1,.055,0,4.8,z,0x344e5c));
 const carrier=new THREE.Group();carrier.name='synthetic-foup';root.add(carrier);
 box(carrier,'foup-shell',.95,.72,.85,0,0,0,0xe7bd67);
 box(carrier,'foup-door',.79,.57,.05,0,0,.45,0xa9762b);
 box(carrier,'foup-top-handle',.3,.08,.25,0,.4,0,0x6d552b);
 for(const x of [-.43,.43])box(carrier,'foup-rib',.05,.6,.91,x,0,0,0xc99743);
 const beacon=box(vehicle,'delay-beacon',.2,.2,.2,.55,5.12,.72,0x297c65);
 function update(p){vehicle.position.x=p.x;hoist.position.set(p.x,p.hoistY+.48,0);const top=4.8,bottom=p.hoistY+.54;for(const belt of belts){belt.position.x=p.x;belt.position.y=(top+bottom)/2;belt.scale.y=Math.max(.001,top-bottom);}carrier.position.set(p.carrierX,p.carrierY,0);carrier.userData.owner=p.owner;vehicle.userData.phase=p.phase;beacon.material.color.setHex(p.delayed?0xc63f29:0x297c65);}
 function theme(dark){floor.material.color.setHex(dark?0x20313d:0x8d9dab);rail.material.color.setHex(dark?0xa2b3c4:0x526979);}
 return{root,vehicle,carrier,hoist,belts,ports,update,theme,dispose(){root.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});scene.remove(root);}};
}
// Frame rail, transfer path and load ports, including mobile portrait.
export function cameraPose(camera,aspect,focus='overview'){
 const target=new THREE.Vector3(focus==='a'?PORT_A:focus==='b'?PORT_B:0,2.6,0),span=focus==='overview'?9:4;
 const distance=Math.max(13,span/(Math.tan(camera.fov*Math.PI/360)*Math.min(1,aspect)));
 camera.position.copy(target).add(new THREE.Vector3(.35,.55,1).normalize().multiplyScalar(distance));camera.lookAt(target);camera.updateMatrixWorld();return target;
}
