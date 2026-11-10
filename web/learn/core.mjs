import {lessons} from './content.mjs';
export const STORAGE_KEY='fabguard-learning-v1';
export const pick=(value,lang)=>value[lang==='en'?'en':'ko'];
export function suggestedOrder(answers={}) {
  return [...lessons].sort((a,b)=>Number(answers[a.id]===a.correct)-Number(answers[b.id]===b.correct)).map(x=>x.id);
}
export function blankRecord(lesson) {
  return {concept:lesson.id,evidence:`synthetic-${lesson.id}`,misconception:lesson.id,source:lesson.source,checked:false};
}
export function validateRecords(value) {
  if (!Array.isArray(value)||value.length>lessons.length) throw Error('Invalid record list');
  const seen=new Set();
  return value.map(row=>{
    if(!row || Object.keys(row).sort().join(',')!=='checked,concept,evidence,misconception,source') throw Error('Invalid fields');
    const lesson=lessons.find(x=>x.id===row.concept);
    if(!lesson||seen.has(lesson.id)||typeof row.checked!=='boolean') throw Error('Invalid concept');
    seen.add(lesson.id);const expected=blankRecord(lesson);
    for(const key of ['evidence','misconception','source']) if(row[key]!==expected[key])throw Error('Invalid reference');
    return {...expected,checked:row.checked};
  });
}
export function saveRecords(storage,records) {
  const cleaned=validateRecords(records);
  storage.setItem(STORAGE_KEY,JSON.stringify({version:1,records:cleaned}));
}
export function loadRecords(storage) {
  const raw=storage.getItem(STORAGE_KEY);
  if(raw===null)return [];
  if(raw.length>2500)throw Error('Oversized record');
  const parsed=JSON.parse(raw);
  if(!parsed||parsed.version!==1||Object.keys(parsed).sort().join(',')!=='records,version')throw Error('Invalid version');
  return validateRecords(parsed.records);
}
export function clearRecords(storage){storage.removeItem(STORAGE_KEY);}
// Loading is an explicit union. A stale snapshot cannot erase a newer session
// link or reverse a self-check; this does not write anything back to storage.
export function mergeRecords(current, restored) {
 const merged=new Map(validateRecords(current).map(row=>[row.concept,row]));
 for(const row of validateRecords(restored)){
  const existing=merged.get(row.concept);
  merged.set(row.concept,{...row,checked:Boolean(row.checked||existing?.checked)});
 }
 return validateRecords([...merged.values()]);
}
