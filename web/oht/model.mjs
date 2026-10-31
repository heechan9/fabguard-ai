// Illustrative seconds and scene units only; no equipment telemetry or control.
export const PORT_A=-4,PORT_B=4,CARRY_Y=4.25,PORT_Y=1.65;
const mix=(a,b,p)=>a+(b-a)*Math.max(0,Math.min(1,p));
export function poseAt(seconds,scenario='normal'){
 const t=Number.isFinite(seconds)?Math.max(0,seconds):0;
 let phase='approach',x=mix(-6,PORT_A,t/3),y=CARRY_Y,owner='port-a';
 if(t>=3){phase='stop-a';x=PORT_A;}
 if(t>=5){phase='lower-pick';y=mix(CARRY_Y,PORT_Y,(t-5)/2);}
 if(t>=7){phase='pick';y=PORT_Y;owner='hoist';}
 if(t>=8){phase='raise-loaded';y=mix(PORT_Y,CARRY_Y,(t-8)/2);}
 if(t>=10){phase='travel-loaded';x=mix(PORT_A,PORT_B,(t-10)/6);y=CARRY_Y;}
 if(t>=16){phase='stop-b';x=PORT_B;}
 if(scenario==='delay'&&t>=16){phase=t>=24?'delayed':'long-stop';}
 else{
  if(t>=18){phase='lower-place';y=mix(CARRY_Y,PORT_Y,(t-18)/2);}
  if(t>=20){phase='place';y=PORT_Y;owner='port-b';}
  if(t>=21){phase='raise-empty';y=mix(PORT_Y,CARRY_Y,(t-21)/2);}
  if(t>=23){phase='return-empty';x=mix(PORT_B,-6,(t-23)/4);y=CARRY_Y;}
  if(t>=27){phase='complete';x=-6;}
 }
 return{phase,x,hoistY:y,owner,carrierX:owner==='port-a'?PORT_A:owner==='port-b'?PORT_B:x,carrierY:owner==='hoist'?y:PORT_Y,delayed:phase==='delayed'};
}
export class OhtSimulation{
 constructor(scenario='normal'){this.reset(scenario);}
 reset(scenario=this.scenario){this.scenario=scenario==='delay'?'delay':'normal';this.time=0;this.running=false;this.acknowledged=false;this.ackTime=null;}
 get end(){return this.scenario==='delay'?24:27;}
 get pose(){return poseAt(this.time,this.scenario);}
 play(){if(this.time<this.end)this.running=true;}
 pause(){this.running=false;}
 replay(){this.reset();this.play();}
 advance(dt){if(this.running&&Number.isFinite(dt)&&dt>0){this.time=Math.min(this.end,this.time+dt);if(this.time>=this.end)this.running=false;}return this.pose;}
 acknowledge(){if(this.pose.delayed&&!this.acknowledged){this.acknowledged=true;this.ackTime=this.time;}}
}
