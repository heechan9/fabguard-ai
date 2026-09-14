import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DATASETS,datasetEvidence,secomEvidence,scenarioCost,csvRows,sourceUrl} from '../../web/smt/evidence-model.mjs';
const snapshot = JSON.parse(readFileSync(new URL('../../web/data/evidence_snapshot.json',import.meta.url),'utf8'));
test('each PV source binds its report to audit rows/hash and correct source type',()=>{
  assert.equal(DATASETS.length,5);
  const kinds={dkasc:'observed',pvlive:'estimated',pvgis:'reference',enedis:'estimated',meteo:'observed'};
  for(const meta of DATASETS){
    const d=datasetEvidence(snapshot,meta.id);
    assert.ok(d.lineageMatches,meta.id);
    assert.equal(d.audit.source_type,kinds[meta.id]);
    assert.match(d.hash,/^[0-9a-f]{64}$/);
    if(d.report) assert.equal(d.report.source.source_type,kinds[meta.id]);
    assert.ok(sourceUrl(snapshot,d.auditPath).includes('/'+snapshot.revision+'/'));
  }
});
test('collection warnings survive successful structural and SDT checks',()=>{
  const enedis=datasetEvidence(snapshot,'enedis');
  assert.equal(enedis.audit.missing_energy_rows,207);
  assert.equal(enedis.audit.data_quality_warning,true);
  assert.equal(enedis.sdt['data quality warning'],false);
  assert.equal(enedis.frictionless,true);
  const au=datasetEvidence(snapshot,'dkasc');
  assert.equal(au.audit.remaining_missing_power,93);
  assert.equal(au.audit.negative_values_clipped_for_sdt,53817);
  assert.equal(au.audit.power_unit_status,'inferred_kW_pending_direct_schema_confirmation');
});
test('weather stays resource-only and RTE stays absent',()=>{
  const weather=datasetEvidence(snapshot,'meteo');
  assert.equal(weather.sdt,null);
  assert.equal(weather.report,undefined);
  assert.equal(weather.reportPath,'web/data/global_e2e_summary.json');
  assert.ok(!Object.keys(snapshot.files).some(p=>p.includes('rte-france-national-solar-2024')));
  assert.equal(snapshot.smt_model_connected,false);
  assert.equal(snapshot.raw_data_recomputed,false);
});
test('canonical SECOM V1 counts agree with stored display summary',()=>{
  const d=secomEvidence(snapshot);
  assert.equal(d.manifest.config.test_size,392);
  assert.equal(d.test.tn+d.test.tp+d.test.fn+d.test.fp,392);
  assert.equal(d.test.tp,0); assert.equal(d.test.fn,24);
  assert.match(d.manifest.evaluation_status,/provisional/);
  const top10=d.topK.find(r=>r.k_fraction===.1);
  assert.equal(top10.inspection_count,40); assert.equal(top10.captured_fail,5);
  for(let i=0;i<d.topK.length;i++) for(const [key,value] of Object.entries(d.topK[i])) assert.ok(Math.abs(value-d.summary.top_k[i][key])<1e-12,key);
  const display=d.summary.test.find(r=>r.candidate===d.test.candidate);
  assert.ok(Math.abs(display.pr_auc_average_precision-d.test.pr_auc_average_precision)<1e-12);
});
test('Phase 1 scenarios use their own outcomes and explicit cost assumptions',()=>{
  const d=secomEvidence(snapshot);
  for(const row of d.costs){
    const c=scenarioCost(row,row.inspection_cost_units,row.missed_fail_cost_units);
    assert.equal(c.total,row.scenario_total_cost);assert.equal(c.baseline,row.no_review_cost);
    assert.deepEqual(scenarioCost(row,0,0),{total:0,baseline:0});
  }
  const phase20=d.costs.find(r=>r.k_fraction===.2);
  assert.equal(phase20.captured_fail,8);
  assert.equal(d.topK.find(r=>r.k_fraction===.2).captured_fail,7);
  assert.equal(scenarioCost(phase20,2,10).total,318);
  for(const bad of [NaN,Infinity,-1,1000001]) assert.throws(()=>scenarioCost(phase20,bad,20));
});
