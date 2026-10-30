// Authored context examples only. No physical recipe, maintenance system or SECOM mapping.
const CONTEXT={
 condition:{code:'condition_change',label:'조건 변경 · 비교 근거 확인 필요',kind:'가상 레시피 맥락 변경',before:'설명용 조건 A',after:'설명용 조건 B · 비교 가능성 미확인',next:'변경 전후의 검사 조건·기준 버전 기록을 비교하고 같은 기준으로 비교 가능한지 확인합니다.'},
 review:{code:'needs_review',label:'정비 후 검토 기록 없음',kind:'가상 정비 이력',before:'정비 전 맥락',after:'정비 후 맥락 · 재확인 기록 미제공',next:'정비 이력과 정비 후 확인 기록을 확보하고 담당 엔지니어가 검토합니다.'}
};
export function holdReasons(board){
 if(!board||board.stage<2)return [];
 const reasons=[];
 if(board.volume===null)reasons.push({code:'missing_measurement',label:'납 측정 누락',next:'누락 측정 기록과 수집 상태를 확인합니다.'});
 const context=CONTEXT[board.fault];
 if(context)reasons.push({code:context.code,label:context.label,next:context.next});
 return reasons;
}
export function contextReview(board){
 const measured=Boolean(board&&board.stage>=2),context=measured?CONTEXT[board.fault]:null;
 const events=context?[{time:board.born+7,kind:context.kind,before:context.before,after:context.after}]:[];
 const reasons=holdReasons(board);
 const hypotheses=!measured?[]:[
  {category:'장비',candidate:context?.code==='needs_review'?'정비 전후 검사 맥락의 차이 가능성':'장비 조건·이력 차이 가능성',next:'같은 기판에 연결된 장비·정비 이력 기록을 확인합니다. 현재 실제 기록은 없습니다.'},
  {category:'재료',candidate:'재료 묶음 또는 투입 조건 차이 가능성',next:'재료 묶음과 투입 이력을 확인합니다. 가상 LOT 번호만으로 재료 원인을 추정하지 않습니다.'},
  {category:'측정',candidate:board.volume===null?'측정 누락·수집 경로 문제 가능성':'측정 기준·검사 조건 차이 가능성',next:board.volume===null?'원본 측정과 수집 기록의 존재 여부를 확인합니다. 값을 채워 정상으로 처리하지 않습니다.':'측정 기준 버전·원본 기록과 반복 측정 가능 여부를 확인합니다.'}
 ];
 return {scope:'illustrative-not-operational',boardId:board?.id??null,reasons,events,hypotheses};
}
