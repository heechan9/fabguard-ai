import {OhtSimulation} from './model.mjs';
const $=id=>document.getElementById(id),sim=new OhtSimulation();
const english={skip:'Skip to concept',smt:'Separate SMT / floor AGV',secom:'Real SECOM analysis',title:'Travel overhead. Lower to the load port.',lead:'A separate semiconductor-fab concept: one ceiling-track vehicle carries one synthetic FOUP container from A to B.',boundary:'Synthetic explanatory motion · No real equipment or sensor connection · No throughput or safety validation',scene:'OHT-01 · Overhead transport concept',synthetic:'Synthetic geometry · Not physical dimensions',fallback:'3D is unavailable. The status, playback and check record below still describe the same synthetic sequence. Reload to retry 3D.',sceneLabel:'A ← Ceiling rail · Hoist · Synthetic FOUP → B',overview:'Overview',cameraA:'View load port A',cameraB:'View load port B',cameraNote:'View selection changes only the camera, never time or transport state.',controlTitle:'PLAY THE EXPLANATION',caseLabel:'Illustrative case',normal:'Basic transfer · A → B',delay:'Long stop at B · Delay check',caseNote:'Changing cases resets time to zero and pauses.',play:'Play',reset:'Reset · Pause',replay:'Replay from start',clock:'Illustrative time',carrier:'FOUP location',ack:'Record a human check',ackNote:'This only records a check in this page. It is not recovery, delay clearance or work approval. Delay remains until reset, case change or Replay. Replay starts a new illustrative run, not recovery.',howTitle:'One container, continuous transfer',how:'Approach → stop → lower and pick → raise → travel to B → stop → lower and place → raise empty → return empty. The single container belongs to A, the hoist or B, never multiple places.',delayTitle:'How to read the long stop',delayBody:'The delay case stops for 8 illustrative seconds after arrival at B, then indicates a delay. The container stays on the vehicle; it never restarts automatically. A human check is not recovery. This timing is not an equipment threshold.',limitsTitle:'What this scene does not do',limits:'Separate from the SMT PCB line and floor AGV. SECOM, UR3 and Fledge sensors do not drive motion. No SLAM, real motion control, physical clearance, collision or safety validation, logistics optimization or throughput prediction. No manufacturer designs, models or logos are reproduced.',sourcesTitle:'Public terminology references',sources:'Muratec describes the basic ceiling-track, lifting-hoist and load-port-access concept. Daifuku presents Cleanway overhead cleanroom transport. These sources do not validate this synthetic geometry, timing or performance.'};
const korean=new Map([...document.querySelectorAll('[data-copy]')].map(el=>[el,el.textContent]));
let en=new URLSearchParams(location.search).get('lang')==='en',focus='overview',renderer,scene,camera,view,frame,lastStatus='';
const phases={approach:['A로 접근','Approach A'],'stop-a':['A 정차','Stop at A'],'lower-pick':['하강 · 집기 준비','Lower to pick'],pick:['A에서 집기','Pick at A'],'raise-loaded':['용기와 상승','Raise loaded'],'travel-loaded':['B로 이동','Travel to B'],'stop-b':['B 정차','Stop at B'],'lower-place':['하강 · 놓기 준비','Lower to place'],place:['B에 놓기','Place at B'],'raise-empty':['빈 호이스트 상승','Raise empty'],'return-empty':['빈 차량 복귀','Return empty'],complete:['완료 · B에 용기','Complete · container at B'],'long-stop':['B에서 긴 정차','Long stop at B'],delayed:['지연 · 사람 확인 필요','Delayed · human check needed']};
function words(ko,eng){return en?eng:ko;}
function setText(id,text){if($(id).textContent!==text)$(id).textContent=text;}
function render(){
 const active=document.activeElement,p=sim.pose;
 const text=`${words(sim.running?'재생 중':'정지',sim.running?'Playing':'Paused')} · ${phases[p.phase][en?1:0]}`;
 if(text!==lastStatus){$('status').textContent=text;lastStatus=text;}
 $('status').dataset.phase=p.phase;
 const time=sim.time.toFixed(1);if($('clock').value!==time)$('clock').value=time;
 setText('carrier-location',p.owner==='hoist'?words('호이스트에 부착','Attached to hoist'):p.owner==='port-a'?words('로드포트 A','Load port A'):words('로드포트 B','Load port B'));
 setText('play',sim.running?words('일시정지','Pause'):words('재생','Play'));$('play').disabled=sim.time>=sim.end;
 $('ack').disabled=!p.delayed||sim.acknowledged;
 $('delay-state').dataset.delayed=String(p.delayed);
 setText('delay-state',p.delayed?words('지연 유지 · 확인 기록으로 해제되지 않음','Delay latched · a check does not clear it'):words('지연 미표시 · 실제 장비 정상 판정 아님','No delay indication · not a real-equipment health verdict'));
 setText('ack-state',sim.acknowledged?words(`확인 기록 있음 · 설명 시간 ${sim.ackTime.toFixed(1)}초 · 지연 유지`,`Check recorded · illustrative time ${sim.ackTime.toFixed(1)}s · delay remains`):words('확인 기록 없음','No check recorded'));
 if(active===$('play')&&$('play').disabled)$('replay').focus();
 if(active===$('ack')&&$('ack').disabled&&sim.acknowledged)$('ack-state').focus();
 view?.update(p);
}
function canvasLabel(){return words('설명용 OHT 3D 장면. 아래 상태 설명과 시점 버튼을 사용하세요.','Explanatory OHT 3D scene. Use the text status and view buttons below.');}
function language(){
 document.documentElement.lang=en?'en':'ko';
 for(const [el,ko]of korean)el.textContent=en?english[el.dataset.copy]:ko;
 $('language').textContent=en?'한국어':'English';$('language').lang=en?'ko':'en';
 document.querySelector('nav').setAttribute('aria-label',words('주요 화면','Navigation'));
 document.querySelector('.camera-controls').setAttribute('aria-label',words('시점 선택','Camera views'));
 lastStatus='';if(renderer)renderer.domElement.setAttribute('aria-label',canvasLabel());render();
}
$('language').addEventListener('click',()=>{en=!en;const url=new URL(location.href);if(en)url.searchParams.set('lang','en');else url.searchParams.delete('lang');history.replaceState(null,'',url);language();});
$('play').addEventListener('click',()=>{if(sim.running)sim.pause();else sim.play();render();});
$('reset').addEventListener('click',()=>{sim.reset();render();});
$('replay').addEventListener('click',()=>{sim.replay();render();});
$('scenario').addEventListener('change',()=>{sim.reset($('scenario').value);render();});
$('ack').addEventListener('click',()=>{sim.acknowledge();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){sim.pause();render();}});
$('scenario').value=sim.scenario;
language();
function fallback(){if(renderer)renderer.domElement.hidden=true;$('view-error').hidden=false;}
let resize=()=>{};
for(const button of document.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>{focus=button.dataset.camera;for(const b of document.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b===button));resize();});
// Text controls and time must not depend on successful or prompt WebGL imports.
let last;
function tick(now){const dt=last===undefined?0:Math.min(.1,Math.max(0,(now-last)/1000));last=now;sim.advance(dt);render();if(renderer&&!renderer.domElement.hidden){try{renderer.render(scene,camera);}catch{fallback();}}frame=requestAnimationFrame(tick);}
frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>{sim.pause();cancelAnimationFrame(frame);});
window.addEventListener('pageshow',event=>{if(event.persisted){last=undefined;frame=requestAnimationFrame(tick);}});
try{
 const [THREE,{mountOht,cameraPose}]=await Promise.all([import('../smt/vendor/three.module.js'),import('./view.mjs')]);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.1,150);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.domElement.setAttribute('aria-label',canvasLabel());renderer.domElement.setAttribute('role','img');$('viewport').prepend(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffffff,0x425869,2));const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(2,9,6);scene.add(light);
 view=mountOht(scene,{label(parent,text,x,y,z){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#142431';ctx.fillRect(0,0,256,64);ctx.font='bold 32px system-ui';ctx.fillStyle='#edf3f8';ctx.textAlign='center';ctx.fillText(text,128,44);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(1.6,.4,1);parent.add(sprite);}});
 const theme=()=>{const dark=document.documentElement.dataset.theme==='dark';scene.background=new THREE.Color(dark?0x0b141d:0xaab6c5);view.theme(dark);};theme();new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 resize=()=>{const el=$('viewport');camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);cameraPose(camera,camera.aspect,focus);};new ResizeObserver(resize).observe($('viewport'));resize();
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();});
}catch{fallback();}
