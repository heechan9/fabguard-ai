// Authored explanatory machine architecture. Not vendor CAD, dimensions or physics.
// No textures, network assets, simulation state or per-frame allocations.
import * as THREE from './vendor/three.module.js';
export function buildPlacementHousing(machine,cover,width,feederCount){
 const mats={paint:new THREE.MeshStandardMaterial({color:0xd8e2e4,roughness:.38,metalness:.28}),
  graphite:new THREE.MeshStandardMaterial({color:0x17272e,roughness:.57,metalness:.25}),
  alloy:new THREE.MeshStandardMaterial({color:0x99acb3,roughness:.24,metalness:.78}),
  teal:new THREE.MeshStandardMaterial({color:0x176b72,roughness:.36,metalness:.42}),
  rubber:new THREE.MeshStandardMaterial({color:0x10191e,roughness:.9,metalness:0}),
  glass:new THREE.MeshStandardMaterial({color:0x75b3c4,roughness:.12,metalness:.1,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),
  display:new THREE.MeshStandardMaterial({color:0x113841,roughness:.3,emissive:0x175762,emissiveIntensity:.45}),
  white:new THREE.MeshStandardMaterial({color:0xb8f2ea,roughness:.45,emissive:0x5fbfb0,emissiveIntensity:.45})};
 let category=null;const highlights=new Map();
 // THREE traverses invisible ancestors during raycasting: do not select hidden covers.
 function visibleRaycast(raycaster,hits){for(let o=this;o;o=o.parent)if(!o.visible)return;THREE.Mesh.prototype.raycast.call(this,raycaster,hits);}
 const root=new THREE.Group();root.name='placement-engineering-body';machine.add(root);
 function add(parent,geometry,xyz,mat,{pick=false,shadow=false}={}){let material=mats[mat];if(category){const key=category+':'+mat;if(!highlights.has(key))highlights.set(key,material.clone());material=highlights.get(key);}
 const m=new THREE.Mesh(geometry,material);m.userData.explanatoryPart=category;m.position.set(...xyz);m.castShadow=shadow;m.receiveShadow=true;m.userData.housingPickable=pick;m.raycast=pick?visibleRaycast:()=>{};parent.add(m);return m;}
 const box=(p,w,h,d,x,y,z,mat,options)=>add(p,new THREE.BoxGeometry(w,h,d),[x,y,z],mat,options);
 const cyl=(p,r,h,x,y,z,mat)=>add(p,new THREE.CylinderGeometry(r,r,h,24),[x,y,z],mat);
 // Small bevels catch light at real silhouette edges, instead of relying on flat colours.
 function panel(p,w,h,d,x,y,z,mat){const s=new THREE.Shape(),r=.045;
  s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,steps:1,curveSegments:3});g.translate(0,0,-d/2);return add(p,g,[x,y,z],mat,{pick:true,shadow:true});}
 // Heavy plinth, separated service doors, and recessed seals are visible from overview.
 panel(root,width,.61,1.63,0,.45,0,'graphite');
 for(const sign of [-1,1]){
  panel(root,width*.46,.52,.045,sign*width*.24,.46,.855,'paint');
  box(root,.022,.12,.03,sign*width*.10,.49,.89,'graphite');
  for(let j=0;j<5;j++)box(root,width*.24,.013,.012,sign*width*.25,.29+j*.028,.888,'graphite');
  box(root,width*.47,.025,.02,sign*width*.24,.68,.89,'teal');
 }
 for(const x of [-width*.36,width*.36])for(const z of [-.61,.61]){
  cyl(root,.075,.21,x,.105,z,'alloy');cyl(root,.11,.04,x,.02,z,'rubber');
 }
 box(root,width+.1,.09,1.84,0,.82,0,'alloy',{pick:true});
 // Open centre corridor is retained at y=1.075..1.145, z=±.395.
 for(const z of [-.62,.62]){box(root,width+.5,.11,.085,0,1.015,z,'alloy');box(root,width+.5,.018,.11,0,1.078,z,'rubber');}
 // Distinct cabinet silhouette: rear spine, slim pillars, sloping upper visor.
 panel(cover,width,.80,.15,0,1.69,-.79,'paint');
 for(const sign of [-1,1]){
  // Split side walls into corner posts: keep the existing moving head path open.
  for(const z of [-.70,.70])panel(cover,.16,.96,.14,sign*(width/2-.08),1.70,z,'paint');
  box(cover,.035,.94,.024,sign*(width/2-.19),1.61,.81,'graphite');
  panel(cover,.12,.48,.055,sign*(width/2-.08),1.51,.825,'teal');
 }
 const visor=panel(cover,width,.30,1.67,0,2.35,-.02,'paint');visor.rotation.x=-.07;
 box(cover,width-.16,.09,.075,0,2.06,.85,'graphite');
 box(cover,width-.38,.024,.02,0,2.055,.892,'teal');
 box(cover,width-.37,.73,.022,0,1.65,.807,'glass');
 box(cover,width-.38,.04,.055,0,1.28,.827,'graphite');
 category='rail';
 // Fixed bridge and paired longitudinal guide shafts. None touch the PCB path.
 for(const x of [-width*.39,width*.39]){
  box(root,.14,1.06,.17,x,1.39,-.70,'alloy');
  const shaft=cyl(root,.034,1.24,x,1.88,-.02,'alloy');shaft.rotation.x=Math.PI/2;
  box(root,.10,.30,.25,x,2.00,0,'graphite');
 }
 box(root,width-.25,.18,.23,0,2.18,0,'alloy');
 box(root,width-.28,.035,.024,0,2.13,.127,'rubber');
 for(let j=0;j<9;j++)box(root,.024,.09,.024,-width*.35+j*width*.7/8,2.20,.131,'graphite');
 panel(root,.25,.28,.30,-width*.36,1.97,-.2,'teal');
 category='feeder';
 // Feeder cassettes and double-flange reels; large enough to read as an assembly.
 for(let k=0;k<feederCount;k++){
  const x=-width*.31+k*width*.62/(feederCount-1);
  box(root,.15,.13,.49,x,1.01,1.05,'alloy');
  box(root,.105,.045,.42,x,1.091,1.05,'graphite');
  box(root,.075,.008,.39,x,1.118,1.05,'teal');
  for(const z of [1.135,1.215]){const flange=cyl(root,feederCount===6?.135:.17,.018,x,.76,z,'graphite');flange.rotation.x=Math.PI/2;flange.userData.housingPickable=true;flange.raycast=visibleRaycast;}
  const core=cyl(root,.105,.075,x,.76,1.175,'alloy');core.rotation.x=Math.PI/2;
  const hub=cyl(root,.045,.10,x,.76,1.18,'teal');hub.rotation.x=Math.PI/2;
 }
 box(root,width*.82,.065,.08,0,.51,1.13,'alloy');
 for(const x of [-width*.38,width*.38])box(root,.055,.35,.055,x,.65,1.13,'graphite');
 category=null;
 // Integrated operator panel, not a fake live measurement display.
 const consoleGroup=new THREE.Group();consoleGroup.position.set(width*.27,2.63,.40);consoleGroup.rotation.x=-.15;cover.add(consoleGroup);
 panel(consoleGroup,.42,.29,.075,0,0,0,'graphite');box(consoleGroup,.32,.19,.012,0,.012,.045,'display');
 for(let j=0;j<3;j++)box(consoleGroup,.21-j*.035,.012,.005,-.025,.057-j*.042,.053,'white');
 // One instanced draw for recessed fasteners, not individual shadow-casting screws.
 const points=[];for(const x of [-width*.43,width*.43])for(const y of [.25,.65])points.push([x,y,.89]);
 const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.018,.012,6),mats.alloy,points.length);bolts.raycast=()=>{};
 const transform=new THREE.Object3D();points.forEach((p,i)=>{transform.position.set(...p);transform.rotation.x=Math.PI/2;transform.updateMatrix();bolts.setMatrixAt(i,transform.matrix);});root.add(bolts);
 function select(part){for(const [key,material] of highlights){material.emissive.setHex(key.startsWith(part+':')?0x247a87:0);material.emissiveIntensity=.48;}}
 return {root,materials:mats,select};
}
