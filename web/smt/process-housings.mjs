import * as THREE from './vendor/three.module.js';

// Explanatory geometry in scene units. X follows the board, and +Z faces the aisle.
const boxShape = new THREE.BoxGeometry();
const drumShape = new THREE.CylinderGeometry(1, 1, 1, 24);
const finishes = {
  enamel: {color:0xd2dee0, roughness:.43, metalness:.22},
  graphite: {color:0x243740, roughness:.58, metalness:.30},
  steel: {color:0x93a7b0, roughness:.34, metalness:.65},
  optical: {color:0x145c65, roughness:.34, metalness:.44},
  glass: {color:0x77adba, roughness:.20, metalness:.10, transparent:true, opacity:.10, depthWrite:false},
  emitter: {color:0x99e8dc, emissive:0x2a756a, emissiveIntensity:.45, roughness:.33},
  bronze: {color:0xb47b44, roughness:.42, metalness:.50}
};
const materials = new Map();
function material(name) {
  if (!materials.has(name)) materials.set(name, new THREE.MeshStandardMaterial(finishes[name]));
  return materials.get(name);
}

// Collect only parts with the same parent, shape and finish into an instanced draw.
function collectParts() {
  const batches = new Map(), transform = new THREE.Object3D();
  function add(parent, shape, finish, position, size, rotation = [0,0,0]) {
    const key = [parent.id, shape.id, finish].join('/');
    if (!batches.has(key)) batches.set(key, {parent,shape,finish,poses:[]});
    transform.position.set(...position);
    transform.scale.set(...size);
    transform.rotation.set(...rotation);
    transform.updateMatrix();
    batches.get(key).poses.push(transform.matrix.clone());
  }
  function mount() {
    for (const {parent,shape,finish,poses} of batches.values()) {
      const surface = material(finish);
      const mesh = poses.length === 1 ? new THREE.Mesh(shape,surface) : new THREE.InstancedMesh(shape,surface,poses.length);
      if (mesh.isInstancedMesh) poses.forEach((pose,i) => mesh.setMatrixAt(i,pose));
      else poses[0].decompose(mesh.position,mesh.quaternion,mesh.scale);
      mesh.receiveShadow = !surface.transparent;
      mesh.castShadow = !surface.transparent;
      const pick = mesh.raycast;
      mesh.raycast = function(ray, hits) {
        for (let ancestor=this; ancestor; ancestor=ancestor.parent) if (!ancestor.visible) return;
        pick.call(this,ray,hits);
      };
      parent.add(mesh);
    }
  }
  return {add,mount};
}

// Extrude a folded sheet profile along the production line. Profile coordinates are [z,y].
function transverseSection(profile) {
  const path = new THREE.Shape(profile.map(([z,y]) => new THREE.Vector2(-z,y)));
  const shape = new THREE.ExtrudeGeometry(path, {depth:1,bevelEnabled:false});
  shape.rotateY(Math.PI/2);
  shape.translate(-.5,0,0);
  return shape;
}

function inspection(group, cover, width, add) {
  const box = (parent,finish,at,size,rot) => add(parent,boxShape,finish,at,size,rot);
  const drum = (finish,at,radius,height) => add(group,drumShape,finish,at,[radius,height,radius]);
  const wing = width/2-.11;
  // A shallow rear roof and pitched front glazing leave the optical silhouette visible.
  box(cover,'optical',[0,2.37,-.49],[width,.15,.79]);
  box(cover,'enamel',[0,2.455,-.50],[width-.07,.045,.72]);
  for (const x of [-wing,wing]) {
    box(cover,'enamel',[x,1.65,-.76],[.17,1.42,.20]);
    box(cover,'enamel',[x,2.35,.21],[.17,.11,1.36],[-.09,0,0]);
    box(cover,'optical',[x,1.70,.77],[.16,1.38,.16],[-.13,0,0]);
  }
  box(cover,'optical',[0,2.345,.69],[width,.125,.14],[-.13,0,0]);
  box(cover,'enamel',[0,1.305,.82],[width-.05,.10,.13],[-.13,0,0]);
  box(cover,'glass',[0,1.82,.755],[width-.32,.96,.015],[-.13,0,0]);

  // Linear guide, central camera carriage and opposed oblique illumination bars.
  for (const x of [-wing+.12,wing-.12]) {
    box(group,'steel',[x,1.53,-.54],[.12,1.19,.15]);
    box(group,'graphite',[x,2.08,-.30],[.19,.16,.58]);
    box(group,'graphite',[x,.965,-.54],[.26,.07,.29]);
  }
  box(group,'steel',[0,2.105,-.16],[width-.35,.16,.21]);
  box(group,'graphite',[0,2.10,-.037],[width-.39,.046,.035]);
  box(group,'optical',[0,2.13,.08],[.46,.36,.36]);
  box(group,'graphite',[0,2.04,.262],[.30,.09,.025]);
  for (let i=0;i<5;i++) box(group,'steel',[-.15+i*.075,2.23,.27],[.026,.10,.023]);
  drum('steel',[0,1.90,.08],.148,.16);
  drum('graphite',[0,1.765,.08],.115,.14);
  drum('steel',[0,1.713,.08],.129,.032);
  drum('emitter',[0,1.683,.08],.094,.028);
  for (const side of [-1,1]) {
    const tilted=[0,0,-side*.37];
    box(group,'steel',[side*.297,1.96,.07],[.25,.067,.12],tilted);
    box(group,'graphite',[side*.40,1.815,.07],[.11,.27,.35],tilted);
    box(group,'emitter',[side*.36,1.747,.07],[.088,.033,.31],tilted);
  }

  // Keep the stripe above populated boards even at the bottom of the shared scan animation.
  const stripe = new THREE.BoxGeometry(.24,.008,.65);
  stripe.translate(0,.032,0);
  const scan = new THREE.Mesh(stripe, new THREE.MeshBasicMaterial({
    color:0x57c5ba, transparent:true, opacity:.28, depthWrite:false
  }));
  scan.name='spi-scan-stripe';
  scan.position.set(0,1.30,.05);
  scan.raycast=()=>{};
  group.userData.scan=scan;
  group.add(scan);
}

function reflow(group, cover, width, add) {
  const box = (parent,finish,at,size,rot) => add(parent,boxShape,finish,at,size,rot);
  const drum = (parent,finish,at,radius,length,rot) => add(parent,drumShape,finish,at,[radius,length,radius],rot);
  const horizontal=[0,0,Math.PI/2];
  // An open inverted U at each mouth leaves a through passage for populated boards.
  const mouth=transverseSection([[-.73,.94],[-.73,1.38],[-.61,1.52],[.61,1.52],
    [.73,1.38],[.73,.94],[.58,.94],[.58,1.31],[.50,1.39],[-.50,1.39],[-.58,1.31],[-.58,.94]]);
  for (const side of [-1,1]) {
    add(group,mouth,'graphite',[side*(width/2-.018),0,0],[.20,1,1]);
    box(group,'bronze',[side*(width/2+.09),1.463,0],[.022,.044,1.08]);
  }
  for (const z of [-.74,.74]) box(group,'steel',[0,1.01,z],[width-.12,.10,.075]);

  // Individual access hoods share a tunnel, with pitched shoulders and open bottoms.
  const hood=transverseSection([[-.84,.98],[-.84,1.80],[-.58,2.10],[.46,2.10],
    [.84,1.78],[.84,.98],[.786,.98],[.786,1.75],[.43,2.033],[-.55,2.033],[-.786,1.77],[-.786,.98]]);
  const pitch=(width-.23)/5;
  for(let i=0;i<5;i++) {
    const x=(i-2)*pitch;
    add(cover,hood,'enamel',[x,0,0],[pitch-.025,1,1]);
    box(cover,'graphite',[x,1.66,.854],[pitch*.50,.052,.040]);
    box(cover,'bronze',[x,1.29,.847],[pitch*.94,.055,.018]);
    // Upper air knives and lower heater channels remain when the access hoods lift away.
    box(group,'steel',[x,1.765,-.01],[pitch*.86,.13,1.20]);
    for(const dx of [-.20,0,.20]) {
      box(group,'bronze',[x+dx*pitch,1.672,.00],[.085,.07,.97]);
      box(group,'graphite',[x+dx*pitch,1.753,.602],[.095,.040,.045]);
    }
    box(group,'graphite',[x,1.405,-.61],[.12,.77,.13]);
  }

  // A return-air manifold and two exhaust risers distinguish the oven roof at line scale.
  const risers=[-pitch*1.45,pitch*1.45];
  drum(cover,'steel',[0,2.265,-.45],.14,pitch*3.20,horizontal);
  for (const x of risers) {
    drum(cover,'graphite',[x,2.125,-.45],.185,.06);
    drum(cover,'steel',[x,2.275,-.45],.15,.30);
    drum(cover,'graphite',[x,2.426,-.45],.165,.035);
    drum(cover,'steel',[x,2.49,-.45],.139,.10);
    drum(cover,'graphite',[x,2.544,-.45],.112,.012);
  }
}

export function buildProcessHousing(i, group, cover, w) {
  if (i!==2 && i!==6) return;
  const {add,mount}=collectParts();
  if (i===2) inspection(group,cover,w,add);
  else reflow(group,cover,w,add);
  mount();
}
