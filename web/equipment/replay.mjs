// Compare two saved screening results. This does not authenticate either file.
const schema='fabguard-equipment-csv-screening/v1';
const settings=['source_role','equipment_id','metric','pad_id','recipe_id','baseline_count','baseline_end','sample_count'];
const measures=['center','lcl','ucl','meanMovingRange','baselineFlaggedRows','statuses'];
const rowFields=['record','timestamp','lot_id','board_id','pad_id','value','screening_status','review_status'];

function valid(report){
  if(!report || typeof report!=='object' || Array.isArray(report) || report.schema_version!==schema ||
    !/^[a-f0-9]{64}$/.test(report.source_sha256) ||
    !Number.isInteger(report.sample_count) || report.sample_count<11 ||
    !Number.isInteger(report.baseline_count) || report.baseline_count<10 || report.baseline_count>=report.sample_count ||
    settings.slice(0,5).some(k=>typeof report[k]!=='string'||!report[k]) ||
    typeof report.baseline_end!=='string' || !report.baseline_end ||
    !report.spc || typeof report.spc!=='object' ||
    measures.slice(0,4).some(k=>!Number.isFinite(report.spc[k])) ||
    !Array.isArray(report.spc.statuses) || report.spc.statuses.length!==report.sample_count-report.baseline_count ||
    report.spc.statuses.some(value=>!['within_limits','above_limit','below_limit','baseline_review_required','unknown'].includes(value)) ||
    !Array.isArray(report.spc.baselineFlaggedRows) || !Array.isArray(report.queue) || report.queue.length>report.sample_count) {
    throw Error('비교할 FabGuard 점검 결과 JSON 형식이 아닙니다.');
  }
  if(report.spc.baselineFlaggedRows.some((id,i,all)=>!Number.isInteger(id)||id<1||id>report.baseline_count||(i>0&&id<=all[i-1]))) {
    throw Error('기준 구간 이탈 행이 올바르지 않습니다.');
  }
  let last=report.baseline_count;
  for(const row of report.queue){
    if(!row || !Number.isInteger(row.record) || row.record<=last || row.record>report.sample_count ||
      rowFields.slice(1,5).some(k=>typeof row[k]!=='string') || !Number.isFinite(row.value) ||
      typeof row.screening_status!=='string' || row.review_status!=='pending') {
      throw Error('이전 점검 목록의 행 형식이나 pending 상태가 올바르지 않습니다.');
    }
    last=row.record;
  }
}

export function compareScreeningResults(previous,current){
  valid(previous);valid(current);
  const changedInputs=['source_sha256',...settings].filter(k=>previous[k]!==current[k]);
  if(changedInputs.length)return {status:'NOT_COMPARABLE',changed_inputs:changedInputs};
  const changedMeasures=measures.filter(k=>JSON.stringify(previous.spc[k])!==JSON.stringify(current.spc[k]));
  const before=new Map(previous.queue.map(row=>[row.record,row]));
  const after=new Map(current.queue.map(row=>[row.record,row]));
  const changedRecords=[...new Set([...before.keys(),...after.keys()])].filter(id=>
    rowFields.some(k=>before.get(id)?.[k]!==after.get(id)?.[k])).sort((a,b)=>a-b);
  return {status:changedMeasures.length||changedRecords.length?'OUTPUT_CHANGED':'MATCH',
    changed_measures:changedMeasures,changed_record_count:changedRecords.length,
    changed_records_preview:changedRecords.slice(0,100)};
}
