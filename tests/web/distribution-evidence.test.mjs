import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {esc,FEATURES,EVIDENCE_REVISION,distributionData,renderFeature,renderSensitivity,signed,sourceLink} from '../../web/secom/distribution-model.mjs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const prefix='web/data/session5-20261030/';
const summary=JSON.parse(read(prefix+'summary.json')),monthly=read(prefix+'monthly_summary.csv'),sensitivity=JSON.parse(read(prefix+'feature_475_sensitivity.json'));
const data=distributionData(summary,monthly,sensitivity);
test('published train evidence and all distribution images preserve source bytes',()=>{
  const manifest=JSON.parse(read(prefix+'manifest.json'));
  assert.equal(manifest.source_revision,EVIDENCE_REVISION);
  assert.equal(manifest.source_directory,'docs/review/session5-20261030');
  const files=['summary.json','monthly_summary.csv','feature_475_sensitivity.json',...FEATURES.map(f=>f+'.svg')];
  assert.deepEqual(Object.keys(manifest.files).sort(),files.sort());
  for(const file of files) assert.equal(createHash('sha256').update(read(prefix+file)).digest('hex'),manifest.files[file],file);
  assert.equal(data.summary.train_n,1175); assert.equal(data.summary.test_statistics_computed,false); assert.equal(data.summary.model_fit,false);
  assert.match(sourceLink('SECOM_DISTRIBUTION_EVIDENCE.md'),new RegExp(`/blob/${EVIDENCE_REVISION}/docs/`));
});
test('all five frozen feature views show observed and missing denominators without resorting',()=>{
  assert.deepEqual(FEATURES,['feature_059','feature_247','feature_519','feature_065','feature_475']);
  for(const feature of FEATURES){
    const html=renderFeature(data,feature);
    assert.match(html,new RegExp(feature)); assert.match(html,/관측 \/ 전체/); assert.match(html,/결측/); assert.match(html,/2008-07/);assert.match(html,/2008-08/);assert.match(html,/2008-09/);
    assert.match(html,/tabindex="0" role="region"/);assert.match(html,/scope="col"/);assert.match(html,/scope="row"/);assert.match(html,/<caption>/);
  }
  for(const feature of ['feature_247','feature_519']){
    const html=renderFeature(data,feature); assert.match(html,/7 \/ 15<small>결측 8/);assert.match(html,/287 \/ 542<small>결측 255/);assert.match(html,/728 \/ 1095/);assert.match(html,/367 \(33.52%\)/);
  }
  assert.throws(()=>renderFeature(data,'feature_999'));
});
test('monthly sign reversals remain signed and distinct from overall positive difference',()=>{
  const a=renderFeature(data,'feature_065'),b=renderFeature(data,'feature_475');
  for(const value of ['-1.811802','+3.638780','-1.177396','+2.314977']) assert.ok(a.includes(value));
  for(const value of ['+0.368371','-0.185212','+3.661376','+0.562853']) assert.ok(b.includes(value));
  assert.match(a,/음 → 양 → 음/);assert.match(b,/양 → 음 → 양/);
  assert.equal(signed(null),'계산 불가');assert.equal(signed(''),'계산 불가');assert.equal(signed(NaN),'계산 불가');assert.equal(signed(0),'0.000000');
});
test('sensitivity shows original and independent Pass/Fail maximum scenarios without mutation',()=>{
  const before=JSON.stringify(data),html=renderSensitivity(sensitivity);
  assert.match(html,/Pass군 최대 39.3528/);assert.match(html,/Fail군 최대 38.2143/);
  for(const value of ['+0.562853','+0.595014','+0.140649','1090 / 1094','79 / 79']) assert.ok(html.includes(value));
  assert.equal(JSON.stringify(data),before);
});
test('scope violations, invalid counts and incomplete or duplicate monthly rows fail closed',()=>{
  for(const key of ['model_fit','test_statistics_computed','performance_changed']) assert.throws(()=>distributionData({...summary,[key]:true},monthly,sensitivity));
  const changed=structuredClone(summary);changed.features[0].groups.pass.n_observed=1095;assert.throws(()=>distributionData(changed,monthly,sensitivity));
  assert.throws(()=>distributionData(summary,monthly.split('\n').slice(0,-2).join('\n'),sensitivity));
  const rows=monthly.trim().split('\n'); rows[2]=rows[1]; assert.throws(()=>distributionData(summary,rows.join('\n'),sensitivity));
  assert.throws(()=>distributionData(summary,monthly,{...sensitivity,deletion_recommended:true}));
});
test('new section keeps observed-only, hypothesis, partial-month and simulation boundaries explicit',()=>{
  const ui=read('web/secom/distribution.mjs'),page=read('web/secom/index.html');
  for(const phrase of ['observed-only','학습 폴드','중앙값 대치','결측 indicator','추가 검증 가설이지 원인 확정이 아닙니다','9월은 29일 11:13까지','원본 삭제','별도 합성 3D 체험','시험 392건']) assert.ok(ui.includes(phrase),phrase);
  assert.ok(page.indexOf('id="distribution-evidence"')<page.indexOf('id="fab-tour"'));
  assert.match(page,/src="\.\/secom.mjs"/);assert.match(page,/src="\.\/tour.mjs"/);
  assert.match(ui,/select.addEventListener\('change',update\)/);assert.match(ui,/role="alert"/);
});
test('offline, missing, malformed and invalid evidence init removes stale UI without touching performance', {timeout:3000}, async()=>{
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const originalFetch=Object.getOwnPropertyDescriptor(globalThis,'fetch');
  const cases=['offline','missing','malformed','invalid'];
  try {
    for(const scenario of cases){
      let html='<select id="distribution-feature"><option>STALE_FEATURE</option></select><p>STALE_DISTRIBUTION</p>';
      let finished;
      const rendered=new Promise(resolve=>{finished=resolve;});
      const root={get innerHTML(){return html;},set innerHTML(value){html=value;finished();}};
      const performance={innerHTML:'EXISTING_SECOM_PERFORMANCE',controls:{inspectionCost:1,missedCost:20}};
      const before=structuredClone(performance),queries=[],requested=[];
      Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector(selector){
        queries.push(selector);
        if(selector==='#distribution-content') return root;
        if(selector==='#secom-evidence') return performance;
        throw new Error(`Unexpected failed-init query: ${selector}`);
      }}});
      Object.defineProperty(globalThis,'fetch',{configurable:true,value:async url=>{
        requested.push(url);
        if(scenario==='offline') throw new TypeError('Failed to fetch');
        const file=url.split('/').at(-1);
        return {ok:!(scenario==='missing'&&file==='monthly_summary.csv'),
          async text(){return monthly;},
          async json(){
            if(scenario==='malformed'&&file==='summary.json') throw new SyntaxError('Invalid JSON');
            if(file==='summary.json') return scenario==='invalid'?{...summary,model_fit:true}:structuredClone(summary);
            return structuredClone(sensitivity);
          }};
      }});
      await import(`../../web/secom/distribution.mjs?failed-init=${scenario}`);
      await rendered;
      assert.equal(requested.length,3,scenario);
      assert.deepEqual(queries,['#distribution-content'],scenario);
      assert.match(html,/role="alert"/,scenario);
      assert.match(html,/기존 성능 결과와는 별도/,scenario);
      assert.match(html,new RegExp(EVIDENCE_REVISION),scenario);
      assert.doesNotMatch(html,/STALE_|<select|id="distribution-feature-content"/,scenario);
      assert.deepEqual(performance,before,scenario);
    }
  } finally {
    if(originalDocument) Object.defineProperty(globalThis,'document',originalDocument); else delete globalThis.document;
    if(originalFetch) Object.defineProperty(globalThis,'fetch',originalFetch); else delete globalThis.fetch;
  }
});

test('snapshot date text is escaped and sensitivity counts reject markup',()=>{
  assert.equal(esc('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
  const changed=structuredClone(sensitivity); changed.leave_one_group_maximum_out[0].summary.groups.pass.n_observed='<img>';
  assert.throws(()=>distributionData(summary,monthly,changed));
  const ui=read('web/secom/distribution.mjs');
  assert.ok(ui.includes('${esc(summary.train_start)}'));assert.ok(ui.includes('${esc(summary.train_end)}'));
});
