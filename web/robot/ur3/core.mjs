export const COLUMNS = ['Num','Timestamp','Current_J0','Temperature_T0','Current_J1','Temperature_J1','Current_J2','Temperature_J2','Current_J3','Temperature_J3','Current_J4','Temperature_J4','Current_J5','Temperature_J5','Speed_J0','Speed_J1','Speed_J2','Speed_J3','Speed_J4','Speed_J5','Tool_current','cycle ','Robot_ProtectiveStop','grip_lost'];
export const SENSOR_INDICES = Array.from({length:19},(_,i)=>i+2);
export const GAP_SECONDS = 5; // Display boundary, not a fault or model alarm threshold.
const requireValue = value => {if(!value) throw Error('UR3 데이터 계약 불일치');};
export function validateDataset(data) {
 requireValue(data?.schema_version==='fabguard-ur3-records/v1');
 requireValue(JSON.stringify(data.columns)===JSON.stringify(COLUMNS));
 requireValue(data.source?.license==='CC BY 4.0' && data.source.xlsx_sha256==='f0f10917de9056908a82cec1aa459ddf9da2d2db70d269b128f99241c8796091');
 requireValue(Array.isArray(data.rows)&&data.rows.length===7409);
 let previous=-Infinity;
 for(const row of data.rows){
  requireValue(Array.isArray(row)&&row.length===24&&Number.isSafeInteger(row[0]));
  const time=Date.parse(row[1]);requireValue(Number.isFinite(time)&&new Date(time).toISOString()===row[1]&&time>previous);previous=time;
  requireValue(SENSOR_INDICES.every(i=>row[i]===null||typeof row[i]==='number'&&Number.isFinite(row[i])));
  requireValue(Number.isSafeInteger(row[21])&&[22,23].every(i=>row[i]===null||typeof row[i]==='boolean'));
 }
 requireValue(['anomaly_recall','false_alarm_rate','detection_delay'].every(k=>data.performance?.[k]===null));
 const audit=computeAudit(data.rows);
 requireValue(audit.sensor_missing_rows===data.audit?.sensor_missing_rows&&audit.gaps.length===data.audit?.gaps?.length);
 requireValue(JSON.stringify(audit.gaps)===JSON.stringify(data.audit.gaps)&&JSON.stringify(audit.cycle_decreases)===JSON.stringify(data.audit.cycle_decreases));
 return data;
}
export function deltaSeconds(rows,index){return index>0?(Date.parse(rows[index][1])-Date.parse(rows[index-1][1]))/1000:null;}
export function computeAudit(rows){
 const gaps=[],cycle_decreases=[];let sensor_missing_rows=0;
 rows.forEach((r,i)=>{if(SENSOR_INDICES.some(j=>r[j]===null))sensor_missing_rows++;
  const delta=deltaSeconds(rows,i);if(delta>GAP_SECONDS)gaps.push({row:i+1,seconds:delta});
  if(i&&r[21]<rows[i-1][21])cycle_decreases.push(i+1);
 });return {gaps,cycle_decreases,sensor_missing_rows};
}
export function rowState(rows,index,sensor){
 if(!SENSOR_INDICES.includes(sensor)||!Number.isInteger(index)||index<0||index>=rows.length)throw Error('잘못된 센서 또는 행');
 const row=rows[index],gap=deltaSeconds(rows,index);
 return {row,value:row[sensor],missing:row[sensor]===null,anySensorMissing:SENSOR_INDICES.some(i=>row[i]===null),gap:gap>GAP_SECONDS?gap:null,
  cycleDecrease:index>0&&row[21]<rows[index-1][21],protectiveStop:row[22],gripLost:row[23]};
}
export function nextRecord(rows,index,kind){
 if(!['gap','missing','stop','grip'].includes(kind))throw Error('알 수 없는 탐색 조건');
 for(let i=index+1;i<rows.length;i++){
  if(kind==='gap'&&deltaSeconds(rows,i)>GAP_SECONDS||kind==='missing'&&SENSOR_INDICES.some(j=>rows[i][j]===null)||kind==='stop'&&rows[i][22]===true||kind==='grip'&&rows[i][23]===true)return i;
 }return null;
}
// Real UTC positions, no interpolation; a gap/null breaks the path.
export function tracePoints(rows,index,sensor){
 rowState(rows,index,sensor);
 return rows.slice(Math.max(0,index-119),index+1).map((r,k)=>{
  const actual=Math.max(0,index-119)+k;
  return {index:actual,time:Date.parse(r[1]),value:r[sensor],breakBefore:deltaSeconds(rows,actual)>GAP_SECONDS};
 });
}
