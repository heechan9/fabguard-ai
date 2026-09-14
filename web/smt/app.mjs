import * as THREE from './vendor/three.module.js';
import {Simulation,STATIONS,FAULTS,assess} from './simulation.mjs';

const $=id=>document.getElementById(id),sim=new Simulation();
let selected='PCB-001',activeStation=2,followInjected=false;
const timeText=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const stationButtons=STATIONS.map((s,i)=>{const button=document.createElement('button');button.innerHTML=`<small>${String(i+1).padStart(2,'0')}</small>${s.label}<small>${s.name}</small>`;button.addEventListener('click',()=>selectStation(i));$('station-strip').append(button);return button;});
function selectStation(i){activeStation=i;stationButtons.forEach((b,j)=>{b.classList.toggle('active',i===j);b.setAttribute('aria-pressed',String(i===j));});$('station-info').textContent=`${STATIONS[i].label} (${STATIONS[i].name}) · ${STATIONS[i].description}`;}
selectStation(2);
function arm(fault){sim.arm(fault);followInjected=true;updateUI();}
document.querySelectorAll('[data-fault]').forEach(b=>b.addEventListener('click',()=>arm(b.dataset.fault)));
$('play').addEventListener('click',()=>{if(sim.boards.every(b=>b.done))return;sim.running=!sim.running;updateUI();});
$('reset').addEventListener('click',()=>{sim.reset();selected='PCB-001';followInjected=false;for(const g of boardMeshes.values()){scene?.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});}boardMeshes.clear();$('speed').value='1';sim.advance(.001);updateUI();});
$('speed').addEventListener('change',e=>{sim.speed=Number(e.target.value);});
$('board-select').addEventListener('change',e=>{selected=e.target.value;updateUI();});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(sim.snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fabguard-smt-synthetic-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
let prevOptions='',prevHistory='';
function updateUI(){
 if(followInjected){const b=sim.boards.at(-1);if(b.fault&&!sim.pending){selected=b.id;followInjected=false;}}
 const options=sim.boards.map(b=>b.id).join(',');if(options!==prevOptions){$('board-select').replaceChildren(...sim.boards.map(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.id+(b.fault?` · ${FAULTS[b.fault]}`:'');return o;}));prevOptions=options;}
 $('board-select').value=selected;const b=sim.boards.find(b=>b.id===selected)||sim.boards[0],a=assess(b);
 $('board-status').textContent=a.status.replace('가상 AOI NG','가상 불량').replace('가상 AOI OK','가상 최종검사 통과').replace('관측값 정상 범위','가상 측정값이 설정 범위 안에 있어요');$('board-status').className=`board-status ${a.level==='warn'?'warn':a.level==='danger'?'danger':''}`;
 $('board-location').textContent=b.done?'배출 완료':`현재 공정 · ${STATIONS[Math.max(0,b.stage)].label}`;
 $('volume').textContent=b.stage<2?'—':b.volume===null?'누락':`${b.volume}%`;$('peak').textContent=b.peak===null?'—':`${b.peak}°C`;$('reason').textContent=a.reason.replaceAll('SPI','납 검사(SPI)').replaceAll('가상 AOI','가상 최종 검사');
 const historyKey=b.id+':'+b.history.length;if(prevHistory!==historyKey){$('history').replaceChildren(...b.history.slice().reverse().map(h=>{const li=document.createElement('li'),t=document.createElement('time'),s=document.createElement('span');t.textContent=timeText(h.time);s.textContent=h.text;li.append(t,s);return li;}));prevHistory=historyKey;}
 const done=sim.boards.length===12&&sim.boards.every(b=>b.done);$('play').textContent=done?'실험 완료':sim.running?'일시정지':'계속 실행';$('play').disabled=done;$('run-status').textContent=done?'배치 완료':sim.running?'시뮬레이션 실행 중':'일시정지';$('run-dot').style.background=sim.running?'#1d9b7a':'#94a5ac';$('clock').textContent=timeText(sim.time);
 $('completed').textContent=sim.boards.filter(b=>b.done).length;$('ng-count').textContent=sim.boards.filter(b=>b.aoi==='NG').length;$('review-count').textContent=sim.boards.filter(b=>b.stage>=2&&b.volume===null).length;
 $('pending').textContent=sim.pending?`다음 PCB · ${FAULTS[sim.pending]}`:sim.boards.length===12?'투입 완료 · 처음부터 다시 시작하세요':'문제를 선택해 보세요';
 document.querySelectorAll('[data-fault]').forEach(button=>{button.disabled=sim.boards.length>=12;button.classList.toggle('armed',sim.pending===button.dataset.fault);button.setAttribute('aria-pressed',String(sim.pending===button.dataset.fault));});
}

// Concept geometry, not manufacturer CAD. No geometry or parameters imply physical validation.
const viewport=$('viewport'),boardMeshes=new Map(),machines=[],heads=[];
let renderer,scene,camera,selectionRing;const widths=STATIONS.map((_,i)=>i===6?4.4:i===0||i===10?1.7:i===5||i===7||i===9?1.45:2.25),positions=[];
let offset=0;for(let i=0;i<widths.length;i++){positions.push(offset+widths[i]/2);offset+=widths[i]+.65;}for(let i=0;i<positions.length;i++)positions[i]-=offset/2;
let azimuth=.35,elevation=.63,zoom=1,pinchDistance=0,lastPointer=null,dragDistance=0;const pointers=new Map();
const color={shell:0xe4ecef,dark:0x344e5c,rail:0x5a7481,mint:0x43b998,amber:0xe8aa4e,red:0xd75948};
function box(parent,w,h,d,x,y,z,c,opacity=1){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:.65,metalness:.18,transparent:opacity<1,opacity,depthWrite:opacity===1}));mesh.position.set(x,y,z);mesh.castShadow=opacity===1;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cylinder(parent,radius,height,x,y,z,c){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,12),new THREE.MeshStandardMaterial({color:c,roughness:.5}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function label(parent,text,x,y,z){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#bbd8dd';ctx.font='600 38px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,56);const tex=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));sprite.position.set(x,y,z);sprite.scale.set(2.55,.5,1);parent.add(sprite);return sprite;}
function makeMachine(i){const group=new THREE.Group(),x=positions[i],w=widths[i];group.position.x=x;group.userData.station=i;scene.add(group);
 const open=[0,5,7,9,10].includes(i);box(group,w,.65,1.7,0,.45,0,color.shell);box(group,w+.14,.13,1.9,0,.86,0,color.dark);
 for(const z of[-.61,.61])box(group,w+.5,.12,.1,0,1.03,z,color.rail);
 for(const lx of[-w*.36,w*.36])for(const z of[-.59,.59])cylinder(group,.055,.27,lx,.08,z,color.dark);
 box(group,w*.72,.39,.035,0,.46, .87,0xc3d0d8);box(group,.07,.18,.055,w*.28,.49,.9,0x6d8490);
 if(!open){
  box(group,w,.13,1.9,0,2.17,0,color.shell);
  for(const xx of[-w/2+.06,w/2-.06])for(const z of[-.83,.83])box(group,.1,1.25,.1,xx,1.55,z,color.shell);
  box(group,w-.18,.98,.035,0,1.58,-.85,0x71a3ac,.16);
  box(group,w-.18,.98,.035,0,1.58,.85,0x739aa7,.1);
  if(i===6){for(let k=0;k<6;k++){box(group,.46,.1,1.25,-1.7+k*.68,1.75,0,0xea9561,.62);}for(let k=0;k<8;k++)box(group,.04,.1,.6,-1.7+k*.48,2.26,0,0x8ca3ad);}
  if(i===3||i===4){box(group,w-.25,.09,.14,0,1.9,0,color.dark);const head=cylinder(group,.11,.48,0,1.59,0,0x3d7485);heads.push({head,group});}
  if(i===2||i===8){box(group,.34,.23,.34,0,1.92,0,color.dark);const scan=box(group,w-.35,.012,1.02,0,1.3,0,i===2?0x47c5c1:0x689fd3,.27);group.userData.scan=scan;}
  if(i===1){box(group,w-.3,.09,.82,0,1.63,0,0x869fab);}
  box(group,.45,.35,.1,w*.23,2.47,.28,color.dark);box(group,.34,.24,.015,w*.23,2.47,.341,0x75c7bb);
 }
 if(i===0||i===10){for(let k=0;k<7;k++)box(group,.95,.04,.9,-.1,1.08+k*.1,0,0x55796d);box(group,.1,.9,1.25,-w/2+.1,1.43,0,color.dark);}
 if(i===7){for(let k=0;k<3;k++)cylinder(group,.18,.09,-.4+k*.4,.96,0,0x769ba7);}
 cylinder(group,.035,.5,w*.38,open?1.65:2.55,-.58,color.dark);const lamp=cylinder(group,.07,.15,w*.38,open?1.98:2.87,-.58,color.mint);group.userData.lamp=lamp;
 label(group,String(i+1).padStart(2,'0')+'  '+STATIONS[i].name,0,open?2.55:3.45,0);machines.push(group);
}
function makeBoard(b){const group=new THREE.Group();group.userData.boardId=b.id;const pcb=box(group,.67,.07,.79,0,0,0,0x287c63);group.userData.pcb=pcb;for(let k=0;k<4;k++){box(group,.13,.065,.16,-.19+(k%2)*.34,.065,-.2+Math.floor(k/2)*.34,0x273d46);}for(let k=0;k<5;k++)box(group,.48,.006,.013,0,.041,-.31+k*.14,0xcbb776);scene.add(group);boardMeshes.set(b.id,group);return group;}
function cameraUpdate(){if(!camera)return;const aspect=viewport.clientWidth/Math.max(1,viewport.clientHeight),distance=(aspect<1.35?47:36)*zoom;camera.position.set(Math.sin(azimuth)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.cos(azimuth)*Math.cos(elevation)*distance);camera.lookAt(0,.6,0);camera.aspect=aspect;camera.updateProjectionMatrix();}
function resize(){if(!renderer)return;renderer.setSize(viewport.clientWidth,viewport.clientHeight);cameraUpdate();}
try{
 scene=new THREE.Scene();scene.background=new THREE.Color(0x091018);scene.fog=new THREE.Fog(0x091018,65,130);camera=new THREE.PerspectiveCamera(42,1,.1,180);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.prepend(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffffff,0x76929b,2.9));const sun=new THREE.DirectionalLight(0xffffff,3.1);sun.position.set(-12,23,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:15,bottom:-15,far:70});sun.shadow.bias=-.001;scene.add(sun);
 const ground=box(scene,90,.08,50,0,-.2,0,0x0b141e);ground.receiveShadow=true;
 const grid=new THREE.GridHelper(70,70,0x285853,0x162c36);grid.position.y=-.145;scene.add(grid);
 box(scene,offset+1,.08,4.2,-.3,-.09,0,0x17272e);
 for(const z of[-2.35,2.35]){box(scene,offset+2,.008,.025,-.3,-.13,z,0x397d75);}
 for(let i=0;i<11;i++)makeMachine(i);
 for(let i=0;i<10;i++){const x=(positions[i]+widths[i]/2+positions[i+1]-widths[i+1]/2)/2;box(scene,.65,.08,1.2,x,.94,0,color.dark);}
 selectionRing=new THREE.Mesh(new THREE.RingGeometry(.52,.58,32),new THREE.MeshBasicMaterial({color:0x39d6c4,side:THREE.DoubleSide,transparent:true,opacity:.85}));selectionRing.rotation.x=-Math.PI/2;scene.add(selectionRing);
 new ResizeObserver(resize).observe(viewport);resize();
}catch(error){$('view-error').hidden=false;console.error('3D initialization failed',error);}

$('camera-reset').addEventListener('click',()=>{azimuth=.35;elevation=.63;zoom=1;cameraUpdate();});$('top-view').addEventListener('click',()=>{azimuth=0;elevation=1.53;zoom=1;cameraUpdate();});
viewport.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.45,Math.min(1.8,zoom*Math.exp(event.deltaY*.001)));cameraUpdate();},{passive:false});
viewport.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});viewport.setPointerCapture(event.pointerId);lastPointer={x:event.clientX,y:event.clientY};dragDistance=0;if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
viewport.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;const prev=pointers.get(event.pointerId),dx=event.clientX-prev.x,dy=event.clientY-prev.y;dragDistance+=Math.abs(dx)+Math.abs(dy);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>0&&pinchDistance>0)zoom=Math.max(.45,Math.min(1.8,zoom*pinchDistance/d));pinchDistance=d;}else{azimuth-=dx*.006;elevation=Math.max(.2,Math.min(1.53,elevation+dy*.006));}cameraUpdate();});
function pointerEnd(event){const clicked=pointers.size===1&&dragDistance<8;pointers.delete(event.pointerId);pinchDistance=0;if(clicked&&renderer){const rect=viewport.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...boardMeshes.values()],true);if(hits.length){let obj=hits[0].object;while(obj&&!obj.userData.boardId)obj=obj.parent;if(obj){selected=obj.userData.boardId;updateUI();}}else{const m=ray.intersectObjects(machines,true);if(m.length){let obj=m[0].object;while(obj&&obj.userData.station===undefined)obj=obj.parent;if(obj)selectStation(obj.userData.station);}}}}
viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);pinchDistance=0;});
viewport.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')azimuth-=.1;if(event.key==='ArrowRight')azimuth+=.1;if(event.key==='ArrowUp')elevation=Math.min(1.53,elevation+.1);if(event.key==='ArrowDown')elevation=Math.max(.2,elevation-.1);if(event.key==='+')zoom=Math.max(.45,zoom-.1);if(event.key==='-')zoom=Math.min(1.8,zoom+.1);cameraUpdate();});
function draw(){if(!renderer||!scene)return;for(const b of sim.boards){const mesh=boardMeshes.get(b.id)||makeBoard(b),stage=Math.max(0,Math.min(10,b.stage));const from=positions[stage]-widths[stage]/2-.24,to=positions[stage]+widths[stage]/2+.24;mesh.position.set(b.done?positions[10]+1.3:from+(to-from)*b.progress,1.11,b.done?((Number(b.id.slice(-3))-1)%6)*.15:0);mesh.visible=!b.done||b.id===selected;const a=assess(b);mesh.userData.pcb.material.color.setHex(a.level==='danger'?color.red:a.level==='warn'?color.amber:0x287c63);if(b.id===selected){selectionRing.position.set(mesh.position.x,1.2,mesh.position.z);}}
 for(let i=0;i<machines.length;i++){const group=machines[i],hasFault=sim.boards.some(b=>b.stage===i&&assess(b).level!=='normal');group.userData.lamp.material.color.setHex(hasFault?color.amber:color.mint);if(group.userData.scan)group.userData.scan.position.y=1.2+.2*(1+Math.sin(sim.time*4));}
 for(const {head} of heads){head.position.x=Math.sin(sim.time*3)*.62;head.position.z=Math.cos(sim.time*2)*.25;}renderer.render(scene,camera);
}
if(matchMedia('(prefers-reduced-motion: reduce)').matches)sim.running=false;
sim.advance(.001);updateUI();let last=performance.now(),lastUI=0;
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!document.hidden)sim.advance(dt*sim.speed);if(now-lastUI>100){updateUI();lastUI=now;}draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);

// Optional browser agent surface. Uses the same validated actions as the visible UI.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});for(const tool of[
 {name:'read_smt_simulation',description:'Read the synthetic SMT run. No real factory or AI model is connected.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>sim.snapshot()},
 {name:'stage_smt_fault',description:'Arm one synthetic fault for the next PCB, replacing any pending fault.',inputSchema:{type:'object',properties:{fault:{type:'string',enum:Object.keys(FAULTS)}},required:['fault'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||Object.keys(input).length!==1||!Object.hasOwn(FAULTS,input.fault))throw new Error('Invalid fault');arm(input.fault);return {pending_fault:sim.pending};}}
 ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}}
