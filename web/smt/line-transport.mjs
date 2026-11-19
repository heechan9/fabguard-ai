// Fixed line furniture. All moving boards, pick targets and lamps keep their original owners.
import * as THREE from './vendor/three.module.js';

// The station builder makes a separate opaque standard material and box per panel.
// Combine its fixed boxes by finish, keeping the station/cover as the pick and visibility boundary.
export function batchFixedBoxes(group) {
  const batches = new Map();
  for (const mesh of group.children) {
    const mat = mesh.material;
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.geometry.type !== 'BoxGeometry' ||
        !mat?.isMeshStandardMaterial || mat.transparent || mat.map || mat.emissive.getHex() !== 0) continue;
    const key = [mat.roughness,mat.metalness,mesh.castShadow,mesh.receiveShadow].join('/');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  }
  for (const boxes of batches.values()) {
    if (boxes.length < 2) continue;
    const first = boxes[0], finish = first.material.clone();
    finish.color.setHex(0xffffff);
    const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), finish, boxes.length);
    const pick = instances.raycast;
    instances.raycast = function(ray,hits) {
      for(let owner=this;owner;owner=owner.parent) if(!owner.visible) return;
      pick.call(this,ray,hits);
    };
    instances.castShadow = first.castShadow;
    instances.receiveShadow = first.receiveShadow;
    const matrix = new THREE.Matrix4(), dimensions = new THREE.Vector3();
    boxes.forEach((mesh,index) => {
      const {width,height,depth} = mesh.geometry.parameters;
      dimensions.set(width,height,depth).multiply(mesh.scale);
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
  batchFixedBoxes(beds);
}

// The loader shows a tall slotted supply magazine. The exit has a lower retrieval shelf.
export function buildMagazine(i,group,cover,w,box) {
  const inbound = i===0, tall = inbound ? 2.55 : 1.94;
  for (const x of [-w*.36,w*.36]) {
    box(cover,.095,tall-.86,.095,x,(tall+.86)/2,-.99,0x456470);
    box(cover,.095,tall-.86,.095,x,(tall+.86)/2,-.50,0x9fadb2);
    box(cover,.12,.10,.62,x,tall,-.745,0xabc3c6);
  }
  box(cover,w*.79,.12,.62,0,tall+.06,-.745,inbound?0x246671:0x536876);
  for (let k=0;k<(inbound?8:4);k++) {
    const y=1.20+k*.15;
    box(group,w*.66,.034,.49,0,y,-.76,0x568a79);
    box(group,w*.70,.035,.035,0,y-.026,-.493,0xb4bfc0);
  }
  if (!inbound) {
    box(group,w*.8,.085,.52,0,.965,.86,0x708996);
    box(group,w*.8,.11,.04,0,1.014,1.12,0xa4b6be);
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
