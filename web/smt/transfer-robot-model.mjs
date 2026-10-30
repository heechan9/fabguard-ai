import {STATIONS} from './simulation.mjs';
// Presentation-only motion within the existing open Cooling stage. No new process,
// measurement, routing, cycle time or real robot kinematics is introduced.
export const TRANSFER_STAGE=7;
export const TRANSFER_NAME='가상 이송 로봇 R-02';
export const TRANSFER_SCOPE='냉각 구간 → 최종 검사 입구 · 설명용 합성 동작 · 실제 장비·운동학·디지털 트윈 검증 아님';
export const TRANSFER_WIDTH=1.45; // Existing Cooling deck width (app.mjs).
const start=-TRANSFER_WIDTH/2-.24,end=TRANSFER_WIDTH/2+.24;
export function transferPose(board){
 if(!board||!Number.isInteger(board.stage)||board.stage<TRANSFER_STAGE)return {phase:'냉각 구간 대기',position:null,carrying:false};
 if(board.stage>TRANSFER_STAGE)return {phase:'이송 완료 · 최종 검사로',position:null,carrying:false};
 const p=Number.isFinite(board.progress)?Math.max(0,Math.min(1,board.progress)):0;
 let x=start,y=1.11,phase='집기';
 if(p<.25)y+=.64*Math.max(0,(p-.08)/.17);
 else if(p<.75){phase='이송';x=start+(end-start)*(p-.25)/.5;y=1.75;}
 else {phase=p<.94?'내려놓기':'이송 완료 · 최종 검사로';x=end;y=1.11+.64*(1-Math.min(1,(p-.75)/.19));}
 return {phase,position:{x,y,z:0},carrying:p>=.08&&p<.94};
}
// 3 s stage / 4 s insertion cadence means at most one active board. Fail closed
// for invalid/overlapping presentation input rather than attaching two PCBs.
export function activeTransferBoard(boards){
 const active=boards.filter(b=>b.stage===TRANSFER_STAGE&&!b.done);
 return active.length===1?active[0]:null;
}

const transferEnd=STATIONS.slice(0,TRANSFER_STAGE+1).reduce((sum,s)=>sum+s.duration,0);
// The existing 4 s insertion cadence leaves a 1 s empty-gripper return after the
// 3 s Cooling stage. Pure timeline sampling also works for paused/intro sources.
export function transferRobotPose(boards,time){
 const active=activeTransferBoard(boards);
 if(active)return transferPose(active);
 const parked={phase:'냉각 구간 대기',position:{x:start,y:1.11,z:0},carrying:false};
 if(!Number.isFinite(time)||boards.filter(b=>b.stage===TRANSFER_STAGE&&!b.done).length>1)return parked;
 const completed=boards.filter(b=>b.stage>TRANSFER_STAGE&&Number.isFinite(b.born));
 if(!completed.length)return parked;
 const lastEnd=Math.max(...completed.map(b=>b.born+transferEnd)),t=time-lastEnd;
 if(t<0||t>=1)return parked;
 let x=end,y=1.11,phase='빈 그리퍼 올리기';
 if(t<.25)y+=.64*t/.25;
 else if(t<.75){phase='빈 그리퍼 복귀';x=end+(start-end)*(t-.25)/.5;y=1.75;}
 else {phase='다음 집기 준비';x=start;y=1.11+.64*(1-(t-.75)/.25);}
 return {phase,position:{x,y,z:0},carrying:false};
}
