// Fixed line furniture. All moving boards, pick targets and lamps keep their original owners.
import * as THREE from './vendor/three.module.js';

// The station builder makes a separate opaque standard material and box per panel.
// Combine its fixed boxes and cylindrical feet or rollers by finish, keeping the station/cover as the pick and visibility boundary.
export function batchFixedSolids(group) {
  const batches = new Map();
  for (const mesh of group.children) {
    const mat = mesh.material;
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh===group.userData.lamp ||
        !mat?.isMeshStandardMaterial || mat.transparent || mat.map || mat.emissive.getHex() !== 0) continue;
    const geometry=mesh.geometry, p=geometry.parameters;
    const box=geometry.type==='BoxGeometry';
    const cylinder=geometry.type==='CylinderGeometry' && p.radiusTop===p.radiusBottom &&
      !p.openEnded && p.heightSegments===1 && p.thetaStart===0 && p.thetaLength===2*Math.PI;
    if(!box && !cylinder) continue;
    const key = [geometry.type,cylinder?p.radialSegments:0,mat.roughness,mat.metalness,mesh.castShadow,mesh.receiveShadow].join('/');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  }
  for (const solids of batches.values()) {
    if (solids.length < 2) continue;
    const first = solids[0], finish = first.material.clone();
    finish.color.setHex(0xffffff);
    const isBox=first.geometry.type==='BoxGeometry';
    const shape=isBox?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,first.geometry.parameters.radialSegments);
    const instances = new THREE.InstancedMesh(shape, finish, solids.length);
    const pick = instances.raycast;
    instances.raycast = function(ray,hits) {
      for(let owner=this;owner;owner=owner.parent) if(!owner.visible) return;
      pick.call(this,ray,hits);
    };
    instances.castShadow = first.castShadow;
    instances.receiveShadow = first.receiveShadow;
    const matrix = new THREE.Matrix4(), dimensions = new THREE.Vector3();
    solids.forEach((mesh,index) => {
      const p=mesh.geometry.parameters;
      dimensions.set(isBox?p.width:p.radiusTop,p.height,isBox?p.depth:p.radiusBottom).multiply(mesh.scale);
      matrix.compose(mesh.position,mesh.quaternion,dimensions);
      instances.setMatrixAt(index,matrix);
      instances.setColorAt(index,mesh.material.color);
      group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    group.add(instances);
  }
}

export function buildTransfers(scene, positions, widths, box) {
  const beds = new THREE.Group();
  scene.add(beds);
  for (let i=0;i<positions.length-1;i++) {
    const start = positions[i]+widths[i]/2, end = positions[i+1]-widths[i+1]/2;
    const middle = (start+end)/2, span = end-start;
    box(beds,span,.085,1.18,middle,.94,0,0x334d58);
    // The moving PCB is .79 wide with its lower face at y=1.075.
    for (const side of [-1,1]) {
      box(beds,span,.07,.085,middle,1.032,side*.392,0x9aadb1);
      box(beds,span,.038,.045,middle,1.053,side*.435,0x31434a);
    }
    // The arrows are on the fixed outer flange, clear of the board.
    for (const side of [-1,1]) {
      const arrow=box(beds,.22,.018,.035,middle,.994,.524+side*.042,0xe1bf74);
      arrow.rotation.y=side*.43;
    }
  }
  batchFixedSolids(beds);
}

// The supply cassette rises above the line. Its guides retain the open throat along X.
export function buildSupplyCassette(group,cover,w,box) {
  const tower=w*.80, front=-.475, rear=-1.04;
  for(const x of [-tower/2,tower/2]){
    box(cover,.12,1.95,.10,x,1.88,rear,0x31515d);
    box(cover,.075,1.95,.085,x,1.88,front,0xb5c3c5);
    box(cover,.12,.13,.66,x,2.83,-.755,0xa8bcbe);
  }
  box(cover,tower+.18,.13,.69,0,2.93,-.755,0x1d6974);
  box(cover,.38,.14,.09,0,3.04,-.78,0x334a52);
  box(group,.14,1.90,.10,-tower*.30,1.87,rear,0x485e68);
  for(let k=0;k<9;k++){
    const y=1.30+k*.165;
    box(group,tower-.10,.040,.49,0,y,-.765,0x43836c);
    box(group,tower-.035,.034,.048,0,y-.022,-.490,0xb8c5c3);
  }
  box(group,tower+.02,.12,.61,0,1.19,-.76,0x526771);
}

// Robots approach both recovery positions from +Z. All roller crowns and rim caps
// remain below the base board's underside; there is no crossbar over the opening.
export function buildRecoveryBed(group,w,box,cylinder) {
  const apron=w+.05;
  box(group,apron,.085,2.04,0,.945,.43,0x3a5862);
  for(const x of [-apron*.47,apron*.47]){
    box(group,.085,.105,2.05,x,1.00,.43,0x78959c);
    box(group,.098,.025,1.97,x,1.058,.43,0xb9c9c9);
    box(group,.089,.031,.32,x,1.055,1.28,0xd8ac58);
    const brace=box(group,.080,.080,.92,x*.88,.75,1.008,0x68838c);
    brace.rotation.x=-.39;
  }
  // Two independent receiving lanes, centered at x = ±0.38 in model coordinates.
  // The low gap between them makes both landing positions readable from above.
  for(const cx of [-.38,.38]){
    box(group,.70,.038,1.89,cx,1.006,.41,0x263e47);
    for(let n=0;n<9;n++){
      const roller=cylinder(group,.034,.68,cx,1.038,-.43+n*.215,0xb2c0c1);
      roller.rotation.z=Math.PI/2;
    }
  }
}

export function buildOpenWorkstation(i,group,cover,w,box) {
  if (i===5) {
    for (const x of [-w*.39,w*.39]) box(cover,.055,1.13,.075,x,1.47,-.72,0x8299a3);
    const light=box(cover,w*.89,.12,.30,0,2.04,-.63,0xb6cbd1);
    light.rotation.x=-.18;
    box(cover,w*.78,.035,.19,0,1.99,-.56,0xe1e4cf);
  } else if(i===7) {
    for (const z of [-.61,.61]) box(cover,w*.96,.28,.085,0,1.54,z,0x5e7988);
    for(let k=0;k<7;k++) {
      const slat=box(cover,.11,.05,1.26,-w*.39+k*w*.13,1.71,0,0xabbdc1);
      slat.rotation.z=.27;
    }
  } else if(i===9) {
    box(cover,w*.95,.24,.09,0,1.26,-.68,0x436775);
    for(const x of [-.47,0,.47]) box(cover,.065,.47,.11,x,1.44,-.67,0x8b9ea7);
  }
}
