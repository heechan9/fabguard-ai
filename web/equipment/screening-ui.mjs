import {screenEquipmentCSV} from './screening.mjs';

function add(parent,tag,value){
  const element=document.createElement(tag);
  element.textContent=String(value);
  parent.append(element);
  return element;
}

export function renderEquipmentScreening(root,data,mapping,context,count,sourceBytes,isCurrent){
  const report=screenEquipmentCSV(data,mapping,context,count);
  add(root,'h2','업로드 CSV · 오프라인 SPC 점검 목록');
  add(root,'p',`${report.equipment_id} · ${report.metric} · 패드 ${report.pad_id} · Recipe ${report.recipe_id} · ${report.source_role}(사용자 선언). 기준 ${count}건, 이후 ${report.sample_count-count}건. 중심선 ${report.spc.center.toFixed(3)}, 관리한계 ${report.spc.lcl.toFixed(3)}–${report.spc.ucl.toFixed(3)}. 기준 종료 ${report.baseline_end}.`);
  add(root,'p',report.spc.baselineFlaggedRows.length
    ? `기준 구간 이탈로 이후 판정을 보류했습니다. 기준 행: ${report.spc.baselineFlaggedRows.join(', ')}`
    : '기준 구간은 별도 안정성 검증을 거치지 않았습니다. 이탈은 불량 확정이 아니며 범위 안도 품질 합격을 뜻하지 않습니다.');
  add(root,'p',`검토 대기 ${report.queue.length}건. 기록된 결정이나 현장 승인 없이 모두 pending 상태입니다.`);
  const wrap=add(root,'div','');wrap.className='table-scroll';
  const table=add(wrap,'table','');add(table,'caption','검토할 측정 기록');
  const head=add(table,'thead',''),header=add(head,'tr','');
  for(const title of ['원본 행','시각','LOT / 기판 / 패드','측정값','점검 신호','상태'])add(header,'th',title).scope='col';
  const body=add(table,'tbody','');
  for(const item of report.queue.slice(0,100)){
    const row=add(body,'tr','');
    for(const value of [item.record,item.timestamp,`${item.lot_id} / ${item.board_id} / ${item.pad_id}`,item.value,item.screening_status,item.review_status])add(row,'td',value);
  }
  if(report.queue.length>100)add(root,'p','화면은 첫 100건만 표시합니다. 전체 목록은 JSON으로 저장하세요.');
  const button=add(root,'button','점검 목록 JSON 저장');button.type='button';
  button.addEventListener('click',async()=>{
    if(!isCurrent())return;
    try{
      const digest=await crypto.subtle.digest('SHA-256',sourceBytes);
      if(!isCurrent())return;
      const source_sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      const payload={schema_version:'fabguard-equipment-csv-screening/v1',source_sha256,...report,
        claim_boundary:'Offline statistical screening of user-declared input; no authenticated reviewer, equipment connection, defect diagnosis or control action'};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='fabguard-equipment-screening.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{button.textContent='저장 실패 · 다시 시도';}
  });
}
