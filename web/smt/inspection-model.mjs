// Authored educational cases. No learned parameters or physical simulator.
export const CASES = Object.freeze({
  clear: {label:'검사 항목에 이상이 없는 사례', assumption:'내부 빈 공간 없음 · 회로 연결 유지 · 이웃 회로 분리', xray:'clear', circuit:'clear'},
  void: {label:'내부 빈 공간이 있는 사례', assumption:'내부 빈 공간은 있지만 회로 연결은 유지된다고 가정', xray:'void', circuit:'clear'},
  open: {label:'회로가 끊어진 사례 (Open)', assumption:'지정 검사 구간이 끊어졌다고 가정 · X-ray 자료는 미제공', xray:'missing', circuit:'open'},
  short: {label:'이웃 회로가 붙은 사례 (Short)', assumption:'분리돼야 할 두 회로가 연결됐다고 가정 · X-ray 자료는 미제공', xray:'missing', circuit:'short'},
  missing: {label:'검사 자료가 없는 사례', assumption:'두 검사 모두 자료 없음 · 정상으로 간주하지 않음', xray:'missing', circuit:'missing'},
});

export function inspect(caseId,method){
  if(!Object.hasOwn(CASES,caseId))throw new Error('Unknown inspection case');
  if(!['xray','electrical'].includes(method))throw new Error('Unknown inspection method');
  const sample=CASES[caseId],value=method==='xray'?sample.xray:sample.circuit;
  if(value==='missing')return {status:'unknown',title:'자료 없음 · 판단 보류',reason:'제공된 가상 검사 자료가 없어 판정하지 않습니다.',visual:'missing'};
  if(method==='xray')return value==='void'
    ?{status:'review',title:'내부 빈 공간 표시 · 검토 필요',reason:'사례에 지정된 내부 빈 공간을 표시했습니다. 실제 불량 합격 기준이나 장비 검출 결과가 아닙니다.',visual:'void'}
    :{status:'clear',title:'설정한 내부 이상 없음',reason:'이 사례에는 내부 빈 공간을 넣지 않았습니다. 실제 제품의 무결함을 보증하지 않습니다.',visual:'clear'};
  const reason={clear:'같은 회로는 이어지고 이웃 회로는 분리된다는 가상 연결 조건을 만족합니다.',open:'이어져야 할 검사 구간이 끊어진 것으로 설정했습니다.',short:'분리돼야 할 두 회로가 연결된 것으로 설정했습니다.'}[value];
  return {status:value==='clear'?'clear':'review',title:{clear:'가상 연결 조건 만족',open:'단선 (Open) · 연결 끊김',short:'단락 (Short) · 이웃 회로 연결'}[value],reason,visual:value};
}

export class InspectionSession {
  constructor(){this.reset();}
  reset(){this.boardId=null;this.caseId=null;this.results={};}
  selectBoard(id){if(id!==this.boardId){this.reset();this.boardId=id;}}
  selectCase(id){if(!Object.hasOwn(CASES,id))throw new Error('Unknown inspection case');this.caseId=id;this.results={};}
  run(method){if(!this.boardId||!this.caseId)throw new Error('Select a board and case first');const result=inspect(this.caseId,method);this.results[method]=result;return result;}
}
