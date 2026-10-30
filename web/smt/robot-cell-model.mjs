import {holdReasons} from './context-review-model.mjs';
// Presentation only: consumes the existing synthetic AOI, never sensor/model output.
export const ROBOT_NAME='가상 로봇 R-01';
export const ROBOT_SCOPE='가상 로봇 이송·분류 셀 · 설명용 합성 규칙 · 실제 학교 장비·센서 이상 탐지·공정 제어와 연결되지 않음';
export const DESTINATIONS={ok:{label:'가상 정상 위치',x:0,z:2.8},ng:{label:'가상 불량 위치',x:0,z:-2.8},review:{label:'검토 보류 위치',x:1.3,z:2.8}};
export function robotRoute(board){
 if(board?.aoi==='NG')return 'ng';
 if(board?.aoi==='OK')return holdReasons(board).length?'review':'ok';
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

// Read only disclosed synthetic measurements; never infer a route from raw/future values.
export function robotReview(board){
 const pose=robotPose(board),measured=board.stage>=2,final=board.stage>=8&&['OK','NG'].includes(board.aoi);
 const missing=measured&&board.volume===null,reasons=holdReasons(board),held=reasons.length>0;
 const evidence=!measured?'납 검사 전 · 아직 측정 근거 없음':missing?'납 측정 누락 · 가상 최종검사 OK여도 정상으로 해제하지 않음':`납 ${board.volume}% · ${board.stage>=7?`최고 ${board.peak}°C`:'가열 결과 대기'}`;
 const context=held?' · '+reasons.map(r=>r.label).join(' / '):'';
 const decision=!final?(held?'측정·맥락 근거 보류 · 최종 검사 대기':'최종 검사 대기 · 분류 미확정'):board.aoi==='NG'?'가상 NG · 규칙상 불량 위치'+(held?' · 추가 검토 보류':''):held?'검토 보류 · 정상 위치로 보내지 않음':'가상 OK · 데모 규칙상 정상 위치';
 const next=held?reasons.map(r=>r.next).join(' ')+' 이 데모는 보류를 자동 해제하지 않습니다.':!final?'최종 검사와 측정 기록을 함께 확인합니다.':board.aoi==='NG'?'가상 검사 근거를 검토합니다. 실제 불량 원인 확정이나 설비 조치 지시가 아닙니다.':'설정한 합성 규칙만 통과했습니다. 실제 품질·출하 승인이나 안전 보증이 아닙니다.';
 return {evidence:evidence+context,decision,next,route:pose.route,state:held?'hold':!final?'waiting':board.aoi==='NG'?'review':'ok'};
}
