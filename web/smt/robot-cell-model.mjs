// Presentation only: consumes the existing synthetic AOI, never sensor/model output.
export const ROBOT_NAME='가상 로봇 R-01';
export const ROBOT_SCOPE='가상 로봇 이송·분류 셀 · 설명용 합성 규칙 · 실제 학교 장비·센서 이상 탐지·공정 제어와 연결되지 않음';
export const DESTINATIONS={ok:{label:'가상 정상 위치',x:0,z:2.8},ng:{label:'가상 불량 위치',x:0,z:-2.8},review:{label:'검토 보류 위치',x:1.3,z:2.8}};
export function robotRoute(board){
 if(board?.aoi==='NG')return 'ng';
 if(board?.aoi==='OK')return board.volume===null?'review':'ok';
 return null;
}
export function robotPose(board){
 const route=robotRoute(board);
 if(!route||!Number.isInteger(board.stage)||board.stage<9)return {phase:'최종 검사 대기',route:null,position:null,carrying:false};
 if(board.stage>9){const d=DESTINATIONS[route];return {phase:'내려놓기 완료',route,position:{x:d.x,y:1.1,z:d.z},carrying:false};}
 const p=Number.isFinite(board.progress)?Math.max(0,Math.min(1,board.progress)):0;
 const d=DESTINATIONS[route];let position,phase;
 if(p<.25){phase='집기';position={x:0,y:1.11+Math.max(0,(p-.1)/.15)*.65,z:0};}
 else if(p<.75){phase='이송';const t=(p-.25)/.5;position={x:d.x*t,y:1.76,z:d.z*t};}
 else {phase=p<.9?'내려놓기':'내려놓기 완료';const t=Math.min(1,(p-.75)/.15);position={x:d.x,y:1.76-.66*t,z:d.z};}
 return {phase,route,position,carrying:p>=.1&&p<.9};
}
