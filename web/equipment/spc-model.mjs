// Offline individual-value screening. Keep parity with fabguard.spc.individuals_report.
export function individuals(values, count = 10) {
  if (!Number.isInteger(count) || count < 10 || count >= values.length) throw Error('Invalid baseline count');
  if (values.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v)))) throw Error('Invalid value');
  const baseline = values.slice(0, count);
  if (baseline.includes(null)) throw Error('Missing baseline');
  const center = baseline.reduce((a,b)=>a+b,0)/count;
  const mr = baseline.slice(1).reduce((s,v,i)=>s+Math.abs(v-baseline[i]),0)/(count-1);
  const lcl = center-3*mr/1.128, ucl = center+3*mr/1.128;
  if (![center,mr,lcl,ucl].every(Number.isFinite) || !(lcl<center && center<ucl)) throw Error('Unusable baseline');
  const baselineFlaggedRows=baseline.flatMap((v,i)=>v<lcl || v>ucl?[i+1]:[]);
  const blocked=baselineFlaggedRows.length>0;
  return {center,lcl,ucl,meanMovingRange:mr,baselineFlaggedRows,statuses:values.slice(count).map(v=>v===null?'unknown':blocked?'baseline_review_required':v<lcl?'below_limit':v>ucl?'above_limit':'within_limits')};
}
export const BASELINE = Object.freeze([99,101,99,101,99,101,99,101,99,101]);
export function scenario(kind) {
  const later = {initial:[100,101,99,100],high:[100,110,99,100],low:[100,90,99,100],missing:[100,null,99,100]}[kind];
  if (!later) throw Error('Unknown scenario');
  return [...BASELINE,...later];
}
