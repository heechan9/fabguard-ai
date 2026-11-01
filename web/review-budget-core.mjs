/** Read-only projection of the existing saved top50; never score, fit or tune. */
export function budgetView(records, budget) {
  if (![20,40,50].includes(budget)) throw new Error('Unsupported review budget');
  if (!Array.isArray(records) || records.length !== 50) throw new Error('Expected the saved top50');
  const ids=new Set();
  for(const [i,row] of records.entries()) {
    if(row.rank!==i+1 || typeof row.sample_id!=='string' || !row.sample_id || ids.has(row.sample_id) || ![0,1].includes(row.label) || !Number.isFinite(row.risk_score)) throw new Error('Invalid ranked evidence');
    if(i && records[i-1].risk_score<row.risk_score)throw new Error('Scores are not in saved rank order');
    ids.add(row.sample_id);
  }
  const selected=records.slice(0,budget), failures=selected.reduce((n,r)=>n+r.label,0);
  return {ids:selected.map(r=>r.sample_id),reviewed:budget,failures,normal:budget-failures,hidden:50-budget};
}
