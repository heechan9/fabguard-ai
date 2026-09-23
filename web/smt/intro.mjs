import * as THREE from './vendor/three.module.js';
import {Simulation} from './simulation.mjs';
import {STATION_TERMS} from './terms.mjs';
import {INTRO_SECONDS,introShot,recordingFormat} from './intro-model.mjs';

// Reuses the live app's original geometry and synthetic simulation. No stock/generated footage.
export function mountIntro({scene,positions,begin,update,end,available}){
 const button=document.getElementById('intro-open'),dialog=document.getElementById('intro-dialog');
 const canvas=document.getElementById('intro-canvas'),ctx=canvas.getContext('2d');
 const status=document.getElementById('intro-status'),record=document.getElementById('intro-record');
 const preview=document.getElementById('intro-preview'),stop=document.getElementById('intro-stop');
 const download=document.getElementById('intro-download'),video=document.getElementById('intro-video');
 let active=null,url=null,generation=0;
 function revoke(){if(url){URL.revokeObjectURL(url);url=null;}download.hidden=true;video.hidden=true;video.removeAttribute('src');}
 function caption(shot){
  ctx.fillStyle='#080f14';ctx.fillRect(0,0,1080,1920);
  ctx.textAlign='left';ctx.fillStyle='#39d6c4';ctx.font='bold 40px sans-serif';ctx.fillText('FABGUARD AI',72,140);
  ctx.fillStyle='#edf4f6';ctx.font='bold 48px sans-serif';ctx.fillText(shot.heading,72,252);
  ctx.fillStyle='#b1c6ce';ctx.font='30px sans-serif';ctx.fillText(shot.subtitle,72,315);
 }
 function footer(shot){
  ctx.textAlign='left';ctx.fillStyle='#39d6c4';ctx.font='bold 42px sans-serif';
  const station=shot.station;
  ctx.fillText(station===null?'조립 → 가열 → 검사':`${String(station+1).padStart(2,'0')}  ${STATION_TERMS[station].plain}`,72,1440);
  ctx.fillStyle='#b1c6ce';ctx.font='29px sans-serif';ctx.fillText(shot.touring?'선택한 장비의 덮개를 숨긴 설명용 내부':'직접 돌려 보고, 기판의 흐름을 살펴보세요',72,1504);
  for(let i=0;i<11;i++){
   const x=72+i*85;ctx.fillStyle=i===station?'#39d6c4':'#20333d';ctx.fillRect(x,1570,72,58);
   ctx.fillStyle=i===station?'#081518':'#b1c6ce';ctx.textAlign='center';ctx.font='26px monospace';ctx.fillText(String(i+1).padStart(2,'0'),x+36,1608);
  }
  ctx.textAlign='left';ctx.fillStyle='#b1c6ce';ctx.font='27px sans-serif';
  ctx.fillText('가상 데이터·규칙 기반 데모 | 실제 AI 예측 아님',72,1720);
  ctx.fillText('설명용 구조 · 실제 장비 설계도/생산 성능 아님',72,1764);
  ctx.fillStyle='#edf4f6';ctx.font='30px sans-serif';ctx.fillText('fabguard-ai.vercel.app',72,1840);
  ctx.fillStyle='#39d6c4';ctx.fillRect(0,1908,1080*shot.t/INTRO_SECONDS,12);
 }
 caption(introShot(0));footer(introShot(0));
 button.addEventListener('click',()=>{dialog.showModal();});
 if(location.hash==='#intro-dialog')dialog.showModal();
 function finish(cancelled=false,message=''){
  const job=active;if(!job)return;active=null;job.cancelled=cancelled;
  cancelAnimationFrame(job.frame);clearTimeout(job.watchdog);
  try{if(job.recorder?.state!=='inactive')job.recorder?.stop();}catch{job.cancelled=true;}
  for(const track of job.stream?.getTracks()??[])track.stop();
  job.renderer?.dispose();end();
  preview.disabled=false;record.disabled=false;stop.disabled=true;
  status.textContent=message||(cancelled?'중단했어요. 다시 시작할 수 있어요.':job.recorder?'영상 파일을 마무리하고 있어요…':'10초 미리보기가 끝났어요.');
 }
 async function start(save){
  if(active)return;
  if(!available()){status.textContent='3D 화면을 사용할 수 없어 영상을 만들지 않았어요.';return;}
  const format=save?recordingFormat(globalThis.MediaRecorder):null;
  if(save&&(!format||!canvas.captureStream)){status.textContent='이 브라우저에서는 영상 저장을 지원하지 않아요. 미리보기는 사용할 수 있어요.';return;}
  revoke();preview.disabled=true;record.disabled=true;stop.disabled=false;
  const job={cancelled:false,frame:0,generation:++generation};active=job;
  try{
   // Finish loading fonts before timing/recording begins.
   await document.fonts.ready;if(active!==job)return;
   begin();
   job.renderer=new THREE.WebGLRenderer({antialias:true});job.renderer.setSize(1080,960,false);
   job.renderer.setPixelRatio(1);job.renderer.outputColorSpace=THREE.SRGBColorSpace;
   job.renderer.toneMapping=THREE.ACESFilmicToneMapping;job.renderer.toneMappingExposure=1.05;
   job.renderer.shadowMap.enabled=true;job.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   job.renderer.domElement.addEventListener('webglcontextlost',()=>finish(true,'3D 연결이 끊겨 저장을 중단했어요.'),{once:true});
   const camera=new THREE.PerspectiveCamera(42,1080/960,.1,180),sample=new Simulation();
   sample.advance(22); // Deliberately pre-populated synthetic showcase, isolated from the user's run.
   function paint(t){
    const shot=introShot(t);update(sample,shot.station);
    const azimuth=shot.touring?.45:.72+t*.012,elevation=shot.touring?.48:.67;
    const distance=shot.touring?9.5:48;
    const travel=shot.progress*10,left=Math.floor(travel);
    const x=shot.touring?positions[left]+(positions[Math.min(10,left+1)]-positions[left])*(travel-left):0,y=shot.touring?1.4:.7;
    camera.position.set(x+Math.sin(azimuth)*Math.cos(elevation)*distance,y+Math.sin(elevation)*distance,Math.cos(azimuth)*Math.cos(elevation)*distance);
    camera.lookAt(x,y,0);job.renderer.render(scene,camera);
    caption(shot);ctx.drawImage(job.renderer.domElement,0,390,1080,960);footer(shot);
   }
   paint(0);
   if(save){
    job.stream=canvas.captureStream(30);job.recorder=new MediaRecorder(job.stream,{mimeType:format.mime,videoBitsPerSecond:8000000});
    const chunks=[];
    job.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    job.recorder.onerror=()=>{job.cancelled=true;finish(true,'녹화 오류로 파일을 만들지 않았어요. 다시 시도해 주세요.');};
    job.recorder.onstop=()=>{
     if(job.cancelled||job.generation!==generation)return;
     const blob=new Blob(chunks,{type:job.recorder.mimeType||format.mime});
     if(!blob.size){status.textContent='영상 데이터가 없어 저장하지 못했어요.';return;}
     url=URL.createObjectURL(blob);download.href=url;download.download=`fabguard-smt-intro.${format.extension}`;
     download.textContent=`영상 다운로드 (${format.extension.toUpperCase()})`;download.hidden=false;
     video.src=url;video.hidden=false;status.textContent='영상이 준비됐어요. 재생해 확인한 뒤 다운로드하세요.';
    };
    job.recorder.start(250);
   }
   const started=performance.now();let previous=0;
   status.textContent=save?'10초 녹화 중 · 이 탭을 그대로 열어 두세요.':'10초 미리보기 중';
   function step(now){
    if(active!==job)return;
    try{const t=Math.min(INTRO_SECONDS,(now-started)/1000);sample.advance(Math.max(0,t-previous));previous=t;paint(t);
     if(t>=INTRO_SECONDS){finish();return;}job.frame=requestAnimationFrame(step);
    }catch{finish(true,'렌더링 오류로 중단했어요. 영상은 저장하지 않았어요.');}
   }
   job.watchdog=setTimeout(()=>finish(true,'녹화가 지연되어 중단했어요. 다시 시도해 주세요.'),15000);
   job.frame=requestAnimationFrame(step);
  }catch{finish(true,'영상 초기화에 실패했어요. 브라우저의 3D·녹화 지원을 확인해 주세요.');}
 }
 preview.addEventListener('click',()=>start(false));record.addEventListener('click',()=>start(true));
 stop.addEventListener('click',()=>finish(true));
 document.getElementById('intro-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>finish(true));dialog.addEventListener('cancel',()=>finish(true));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true,'탭을 떠나 녹화를 중단했어요. 다시 시작해 주세요.');});
 addEventListener('pagehide',()=>{finish(true);revoke();});
}
