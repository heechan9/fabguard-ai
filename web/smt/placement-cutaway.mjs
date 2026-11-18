import * as THREE from './vendor/three.module.js';

const METALS = {
  steel: [0xd4dfe5,.87,.24], bright: [0xe6edf0,.91,.15], cast: [0x626f79,.65,.37],
  anodized: [0x18697a,.66,.30], dark: [0x29333b,.56,.38], brass: [0xc29859,.76,.27],
  polymer: [0x263037,.08,.58], tape: [0xb9935c,.37,.45], gasket: [0x161d21,.03,.8], soldermask:[0x277653,.18,.43]
};

// Turned and assembled surfaces for the educational cutaway. Dimensions are model units.
export function addMechanismDetails(groups, feederCount) {
  const materials = new Map(), geometries = new Set(), batches = new Map();
  const transform = new THREE.Object3D(), origin = [0,0,0];
  const rx = [Math.PI/2,0,0], rz = [0,0,Math.PI/2];
  const cube = new THREE.BoxGeometry(1,1,1);
  const cylinder = new THREE.CylinderGeometry(1,1,1,28);
  const bolt = new THREE.CylinderGeometry(1,1,1,6);
  function add(part, geometry, finish, at, rotation=origin, scale=[1,1,1]) {
    geometries.add(geometry);
    const key = part+' '+geometry.uuid+' '+finish;
    if (!batches.has(key)) batches.set(key,{part,geometry,finish,poses:[]});
    transform.position.set(...at);transform.rotation.set(...rotation);transform.scale.set(...scale);
    transform.updateMatrix();
    batches.get(key).poses.push(transform.matrix.clone());
  }
  const box=(part,finish,at,size,rot)=>add(part,cube,finish,at,rot,size);
  const shaft=(part,finish,at,radius,length,rot)=>add(part,cylinder,finish,at,rot,[radius,length,radius]);
  const screw=(part,at,rad=.024)=>add(part,bolt,'bright',at,rx,[rad,.016,rad]);
  const turned=(profile,sides=36)=>new THREE.LatheGeometry(profile.map(([radius,y])=>new THREE.Vector2(radius,y)),sides);
  const tube=(points,radius,segments=24)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,7,false);

  // Open service bay with folded base channels, an inner drive and a remaining door.
  box('base','dark',[0,.18,0],[2.22,.10,1.6]);
  box('base','cast',[0,.48,-.72],[2.15,.54,.095]);
  box('base','anodized',[.60,.45,.79],[.94,.48,.07]);
  for (const x of [-1.04,-.02,1.04]) {
    box('base','steel',[x,.47,.67],[.074,.54,.10]);
    box('base','dark',[x,.50,-.65],[.085,.57,.10]);
  }
  box('base','cast',[-.54,.40,.05],[.61,.30,.76]);
  for(let i=0;i<8;i++) box('base','steel',[-.81+i*.075,.42,.11],[.025,.31,.73]);
  for(const y of [.29,.38,.47,.56]) box('base','gasket',[.6,y,.834],[.60,.017,.015]);
  for(const x of [.18,1.02]) for(const y of [.27,.63]) screw('base',[x,y,.84]);
  for(let i=0;i<3;i++) {
    const x=-.90+i*.15;
    const cable=tube([[x,.39,.45],[x,.32,.62],[x+.11,.25,.64],[x+.26,.26,.52]],.018,16);
    add('base',cable,i===1?'anodized':'polymer',origin);
  }

  // Bearing blocks, stepped output coupler and helical lead screw on the bridge face.
  shaft('rail','bright',[0,2.22,.235],.048,1.71,rz);
  const helix=[];
  for(let i=0;i<=300;i++) {
    const t=i/300,angle=t*2*Math.PI*20;
    helix.push([-0.75+1.50*t,2.22+.054*Math.cos(angle),.235+.054*Math.sin(angle)]);
  }
  add('rail',tube(helix,.011,300),'steel',origin);
  for(const x of [-.83,.83]){
    box('rail','anodized',[x,2.22,.23],[.14,.22,.25]);
    shaft('rail','dark',[x,2.22,.37],.072,.04,rx);
    for(const dx of [-.047,.047]) for(const dy of [-.078,.078]) screw('rail',[x+dx,2.22+dy,.363],.015);
  }
  shaft('rail','brass',[-.98,2.22,.235],.082,.17,rz);
  for(let i=0;i<4;i++)shaft('rail','dark',[-1.045+.04*i,2.22,.235],.085,.014,rz);
  box('rail','cast',[-1.04,2.20,.02],[.24,.28,.27]);
  for(let i=0;i<7;i++) box('rail','steel',[-1.142+i*.034,2.22,.015],[.014,.29,.28]);
  for(const x of [-.70,.70])for(const z of [-.48,.48]){
    box('rail','cast',[x,1.93,z],[.16,.075,.15]);
    screw('rail',[x,1.93,z+.083],.026);
  }

  // Stepped spindle, collar, collet and nozzle taper. Vacuum hoses terminate at fittings.
  const spindle=turned([[.03,-.31],[.04,-.29],[.061,-.275],[.061,-.235],[.080,-.225],
    [.080,-.15],[.12,-.14],[.126,-.12],[.126,.055],[.143,.066],[.143,.135],[.12,.151],[.08,.152]]);
  add('nozzle',spindle,'bright',[0,1.80,0]);
  const collet=turned([[.018,-.105],[.034,-.095],[.046,-.050],[.062,-.044],[.062,-.004],[.068,0],[.068,.025]],36);
  add('nozzle',collet,'brass',[0,1.50,0]);
  shaft('nozzle','bright',[0,1.375,0],.014,.05);
  for(let i=0;i<6;i++) shaft('nozzle','cast',[0,1.72+i*.028,0],.14,.012);
  for(const x of [-.125,.125]){
    box('nozzle','anodized',[x,1.96,.10],[.08,.23,.20]);
    for(const y of [1.89,2.03]) screw('nozzle',[x,y,.206],.022);
    shaft('nozzle','brass',[x,2.08,.02],.044,.06);
    const hose=tube([[x,2.10,.02],[x*1.25,2.20,-.07],[x*2,2.18,-.22],[x*2.4,2.02,-.28]],.023);
    add('nozzle',hose,x>0?'anodized':'polymer',origin);
  }

  // A front bearing face, crown and curved feed hoses stay readable through the cutaway.
  for(const x of [-.122,.122]){
    box('nozzle','cast',[x,1.94,.25],[.085,.19,.075]);
    screw('nozzle',[x,1.90,.296],.026);screw('nozzle',[x,2.00,.296],.026);
  }
  shaft('nozzle','steel',[0,1.86,.097],.104,.068,rx);
  shaft('nozzle','dark',[0,1.86,.134],.077,.016,rx);
  shaft('nozzle','brass',[0,1.86,.148],.047,.018,rx);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    box('nozzle','dark',[.065*Math.sin(a),1.495,.065*Math.cos(a)],[.009,.048,.008],[0,a,0]);
  }
  // This example board is a separate cutaway workpiece, never an assembly step or a live PCB.
  box('workpiece','soldermask',[.05,1.112,0],[.67,.046,.75]);
  for(const x of [-.10,.16])for(const z of [-.12,.14]){
    box('workpiece','polymer',[x,1.16,z],[.13,.045,.13]);
    for(let j=0;j<4;j++)for(const side of [-1,1])
      box('workpiece','steel',[x-.046+j*.03,1.139,z+side*.085],[.012,.012,.034]);
  }
  for(let i=0;i<6;i++)box('workpiece','brass',[-.19+i*.077,1.14,.32],[.038,.009,.058]);
  // Open reel flanges and spokes reveal the core, tape edge and feed wheel.
  const radius=feederCount===6?.132:.164;
  const rim=new THREE.TorusGeometry(radius,.014,7,36);
  const winding=new THREE.TorusGeometry(radius*.73,.010,6,32);
  for(let i=0;i<feederCount;i++){
    const x=-2.25*.31+i*2.25*.62/(feederCount-1);
    shaft('feeder','tape',[x,.76,1.174],radius*.76,.071,rx);
    for(const z of [1.135,1.217]){
      add('feeder',rim,'cast',[x,.76,z]);
      add('feeder',winding,'brass',[x,.76,z]);
      for(let j=0;j<5;j++){
        const a=j*2*Math.PI/5,mid=radius*.48;
        box('feeder','steel',[x+mid*Math.cos(a),.76+mid*Math.sin(a),z],
          [radius*.83,.018,.014],[0,0,a]);
      }
    }
    shaft('feeder','bright',[x,.76,1.23],.037,.026,rx);
    screw('feeder',[x,.76,1.252],.024);
    shaft('feeder','brass',[x,1.035,1.27],.065,.045,rz);
    for(let j=0;j<10;j++){
      const a=j*2*Math.PI/10;
      box('feeder','steel',[x,1.035+.065*Math.cos(a),1.27+.065*Math.sin(a)],[.052,.020,.021],[a,0,0]);
    }
    const path=[[x,.77,1.26],[x,.88,1.31],[x,1.035,1.33],[x,1.114,1.20],[x,1.133,.91]];
    const curve=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(...p)));
    const verts=[],indices=[];
    for(let j=0;j<=20;j++){
      const q=curve.getPoint(j/20);verts.push(q.x-.028,q.y,q.z,q.x+.028,q.y,q.z);
      if(j) {const a=j*2;indices.push(a-2,a,a-1,a-1,a,a+1);}
    }
    const ribbon=new THREE.BufferGeometry();ribbon.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    ribbon.setIndex(indices);ribbon.computeVertexNormals();add('feeder',ribbon,'tape',origin);
  }

  for(const {part,geometry,finish,poses} of batches.values()){
    const key=part+':'+finish;
    if(!materials.has(key)){
      const [color,metalness,roughness]=METALS[finish];
      materials.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness,side:finish==='tape'?THREE.DoubleSide:THREE.FrontSide}));
    }
    const material=materials.get(key);
    const mesh=poses.length===1 ? new THREE.Mesh(geometry,material) : new THREE.InstancedMesh(geometry,material,poses.length);
    if(mesh.isInstancedMesh) poses.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    else poses[0].decompose(mesh.position,mesh.quaternion,mesh.scale);
    mesh.userData.explanatoryPart=part;
    groups[part].add(mesh);
  }
  return {materials:[...materials.entries()].map(([key,material])=>({part:key.split(':')[0],material})),
    dispose(){for(const geometry of geometries)geometry.dispose();}};
}

// A small procedurally lit studio environment supplies reflections without a network asset.
export function studioEnvironment(){
  const width=128,height=64,bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height;
    const panel=(cx,cy,sx,sy)=>Math.exp(-Math.pow((u-cx)/sx,6)-Math.pow((v-cy)/sy,6));
    const key=panel(.66,.67,.065,.14),strip=panel(.28,.60,.025,.25),rim=panel(.89,.58,.06,.09);
    const light=.09+.15*v+key*.75+strip*.59+rim*.32;
    const i=(y*width+x)*4;
    bytes.set([Math.min(255,Math.round(light*255)),Math.min(255,Math.round((light+.025*strip)*255)),Math.min(255,Math.round((light+.06*strip)*255)),255],i);
  }
  const map=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  map.mapping=THREE.EquirectangularReflectionMapping;
  map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;return map;
}
