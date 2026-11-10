// Synthetic display state only. No heat transfer, inference, actuator or safety system.
import {lotSummary} from './lot-model.mjs';
import {holdReasons} from './context-review-model.mjs';
import {assess} from './simulation.mjs';
export const LOT_COLORS=[0x63c9df,0xcf9bec,0xeac27d];
export function lotMissionSummary(boards){return lotSummary(boards).map((row,index)=>{
 const members=boards.slice(index*4,index*4+4),hold=members.filter(b=>holdReasons(b).length).length;
 const warning=members.filter(b=>assess(b).level==='warn').length,waiting=members.filter(b=>b.stage<2).length;
 return {...row,hold,warning,waiting,state:row.virtual_ng?'ng':hold?'hold':warning?'review':row.completed===4?'complete':'running'};
});}
export function placementPose(board){
 if(!board)return {active:false,placed:0,x:0,z:0,y:1.8,phase:'대기'};
 if(board.stage<3)return {active:false,placed:0,x:0,z:0,y:1.8,phase:'실장 전'};
 if(board.stage>4)return {active:false,placed:4,x:0,z:0,y:1.8,phase:'가상 배치 완료'};
 const progress=Math.max(0,Math.min(.999999,board.progress)),cycle=progress*2,part=Math.floor(cycle),phase=cycle-part;
 return {active:true,placed:(board.stage-3)*2+part+(phase>=.75?1:0),x:-.19+part*.34,z:board.stage===3?-.2:.14,y:1.8-.4*Math.sin(Math.PI*phase),phase:phase<.25?'픽업':phase<.75?'배치 이동':'가상 배치'};
}
