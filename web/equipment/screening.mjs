import {validateCSV} from './contract.mjs';
import {individuals} from './spc-model.mjs';

const timeZone=/^([1-9]\d{3})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
function validTime(value){
  const parts=timeZone.exec(value);
  if(!parts)return false;
  const [,year,month,day,hour,minute,second,,offsetHour,offsetMinute]=parts;
  const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  return date.toISOString().slice(0,10)===`${year}-${month}-${day}` &&
    Number(hour)<24 && Number(minute)<60 && Number(second)<60 &&
    (offsetHour===undefined || (Number(offsetHour)<=14 && Number(offsetMinute)<60 &&
      (Number(offsetHour)!==14 || Number(offsetMinute)===0))) && Number.isFinite(Date.parse(value));
}

export function screenEquipmentCSV(data,mapping,context,baselineCount) {
  const validated=validateCSV(data,mapping,context);
  if (validated.rejected.length) throw Error(`격리된 행 ${validated.rejected.length}개를 수정한 뒤 분석하세요.`);
  const extra=['timestamp','lot_id','recipe_id'];
  if(extra.some(f=>!Number.isInteger(mapping[f])||mapping[f]<0||mapping[f]>=data.headers.length) ||
     new Set([...Object.values(mapping)]).size!==Object.values(mapping).length) {
    throw Error('시각·LOT·Recipe를 서로 다른 열에 연결하세요.');
  }
  if(!Number.isInteger(baselineCount)||baselineCount<10||baselineCount>=validated.accepted.length) {
    throw Error('기준 구간은 최소 10건이고 이후 측정이 1건 이상 필요합니다.');
  }
  const records=validated.accepted.map((item,i)=>{
    const raw=data.rows[i];
    const timestamp=raw[mapping.timestamp].trim();
    const lot_id=raw[mapping.lot_id].trim();
    const recipe_id=raw[mapping.recipe_id].trim();
    if(!validTime(timestamp)) throw Error(`레코드 ${i+1}: 시간대가 포함된 유효한 ISO 시각이 필요합니다.`);
    if(!lot_id||!recipe_id) throw Error(`레코드 ${i+1}: LOT와 Recipe가 필요합니다.`);
    return {...item,timestamp,lot_id,recipe_id,record:i+1};
  });
  const pad=records[0].pad_id, recipe=records[0].recipe_id;
  if(records.some(r=>r.pad_id!==pad||r.recipe_id!==recipe)) throw Error('한 파일은 같은 패드 위치와 Recipe만 분석합니다.');
  for(let i=1;i<records.length;i++) {
    if(Date.parse(records[i].timestamp)<=Date.parse(records[i-1].timestamp)) throw Error(`레코드 ${i+1}: 시각이 중복되거나 역순입니다.`);
  }
  let spc;
  try {spc=individuals(records.map(r=>r.value),baselineCount);}
  catch {throw Error('기준 구간의 변동·관리한계를 계산할 수 없습니다. 다른 기준을 결과에 맞춰 소급 선택하지 마세요.');}
  const queue=spc.statuses.flatMap((status,i)=>{
    if(status==='within_limits')return [];
    const r=records[i+baselineCount];
    return [{...r,screening_status:status,review_status:'pending'}];
  });
  return {source_role:context.role,equipment_id:context.equipment.trim(),metric:context.metric,
    pad_id:pad,recipe_id:recipe,baseline_count:baselineCount,baseline_end:records[baselineCount-1].timestamp,
    sample_count:records.length,spc,queue};
}
