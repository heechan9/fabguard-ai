// Independent explanatory material tray. Never reads or mutates production PCBs.
export const AGV_NAME='합성 바닥형 AGV A-01';
export const AGV_ROUTE=Object.freeze([{x:-8,z:4},{x:8,z:4},{x:8,z:7},{x:-8,z:7},{x:-8,z:4}].map(Object.freeze));
export const AGV_SIZE=Object.freeze({length:1.5,width:1.05,wheelRadius:.22});
export function routePosition(distance){
 let remaining=Math.max(0,Number.isFinite(distance)?distance:0)%38;
 for(let i=1;i<AGV_ROUTE.length;i++){
  const a=AGV_ROUTE[i-1],b=AGV_ROUTE[i],length=Math.hypot(b.x-a.x,b.z-a.z);
  if(remaining<=length)return {x:a.x+(b.x-a.x)*remaining/length,z:a.z+(b.z-a.z)*remaining/length,heading:Math.atan2(-(b.z-a.z),b.x-a.x)};
  remaining-=length;
 }
}
export function agvPose(time){
 const t=Math.max(0,Number.isFinite(time)?time:0);
 const phase=t<12?'transport':t<16?'wait':t<24?'transport':'blocked';
 const distance=t<12?t*19/12:t<16?19:Math.min(31,19+(t-16)*1.5);
 const cause=phase==='wait'?'대기 · 설명용 인계 지점의 4초 대기':phase==='blocked'?'경로 막힘 · 가상 장애물로 정지, AGV 다시 시작으로 재설정':'운반 · 고정 경로의 합성 자재 트레이';
 return {...routePosition(distance),phase,cause,distance};
}
export class FloorAgv{
 constructor(){this.reset(0);}
 reset(sourceTime=0){this.time=0;this.lastTime=Number.isFinite(sourceTime)?sourceTime:0;this.running=true;}
 update(sourceTime){
  if(!Number.isFinite(sourceTime))return this.pose;
  const delta=Math.max(0,sourceTime-this.lastTime);this.lastTime=sourceTime;
  if(this.running)this.time=Math.min(24,this.time+delta);
  return this.pose;
 }
 get pose(){return agvPose(this.time);}
}
