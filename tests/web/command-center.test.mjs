import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commandCenterData, renderCommandCenter, scorePath, stages} from '../../web/command-center.mjs';
const read = file => readFileSync(new URL('../../'+file, import.meta.url), 'utf8');
const summary = JSON.parse(read('web/data/summary.json'));
const risks = JSON.parse(read('web/data/priority_top50.json'));
test('command center preserves source values, ranking, historic timestamps and denominator', () => {
  const before = JSON.stringify({summary, risks});
  const view = commandCenterData(summary, risks);
  assert.deepEqual(view.priority, risks.slice(0, 5));
  assert.deepEqual(view.scores, risks.map(row => row.risk_score));
  assert.equal(view.priority[0].risk_score, 0.2817735609);
  assert.deepEqual(view.budgets.map(row => [row.inspection_count,row.captured_fail,row.total_fail]), [[20,4,24],[40,5,24],[79,7,24]]);
  assert.ok(view.recent.every(row => row.timestamp.startsWith('2008-')));
  assert.deepEqual(view.recent.map(row => row.timestamp), [...view.recent].map(row => row.timestamp).sort().reverse());
  view.priority[0].risk_score = 1;
  assert.equal(JSON.stringify({summary, risks}), before);
});
test('invalid, missing, duplicated, reordered and non-finite records never render as normal', () => {
  for (const mutate of [r=>r.pop(), r=>r[0].risk_score=NaN, r=>r[0].risk_score=Infinity, r=>r[0].risk_score=-1, r=>r[0].risk_score=1.1, r=>r[0].rank=4, r=>r[1].sample_id=r[0].sample_id, r=>r[1].risk_score=1, r=>r[0].label=2, r=>r[0].timestamp='now', r=>r[0].sample_id='<script>']) {
    const copy=structuredClone(risks);mutate(copy);assert.throws(()=>commandCenterData(summary, copy));
  }
  for (const mutate of [s=>s.top_k=null, s=>s.top_k[0].fail_capture_rate=0.9, s=>s.top_k[0].total_fail=0, s=>s.top_k[0].inspection_count=null]) {
    const copy=structuredClone(summary);mutate(copy);assert.throws(()=>commandCenterData(copy, risks));
  }
});
test('rank plot uses fixed 0–1 scale, never invented sensor waveforms', () => {
  assert.equal(scorePath([1,.5,0]), 'M0.00,8.00 L300.00,48.00 L600.00,88.00');
  assert.throws(()=>scorePath([NaN,0]));assert.throws(()=>scorePath([.4]));
  const html=renderCommandCenter(summary, risks, 'en');
  assert.match(html,/NOT A TIME SERIES/);assert.match(html,/no live equipment connection/);
  assert.match(html,/not an actual process route or equipment-health display/);
  assert.doesNotMatch(html,/NORMAL|ATTENTION|min ago|CHAMBER PRESSURE|SAMPLE A4179/);
  assert.equal((html.match(/data-stage=/g)||[]).length,6);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
});
test('Korean and English views retain sample links, history, human-review limits and all original routes', () => {
  for (const lang of ['ko','en']) {
    const html=renderCommandCenter(summary,risks,lang);
    for (const row of risks.slice(0,5)) assert.ok(html.includes(`#detail/${row.sample_id}`));
    assert.match(html,/href="#risks"/);assert.match(html,/href="#limitations"/);
    assert.match(html,/AI PRIORITIZES. ENGINEERS DECIDE/);
  }
  assert.doesNotMatch(renderCommandCenter(summary,risks,'en'),/[가-힣]/);
  const app=read('web/app.js');assert.match(app,/import\('\.\/command-center.mjs'\)/);assert.match(app,/Overview unavailable/);
  for (const route of ['summary','global','risks','limitations','overview']) assert.ok(app.includes(`hash === "${route}"`));
});
test('six original illustrations are self-contained and have no fake status indicators', () => {
  for (const stage of stages) {
    const svg=read(`web/assets/command-center/${stage.id}.svg`);
    assert.match(svg,/viewBox="0 0 160 120"/);assert.match(svg,/<title/);
    assert.doesNotMatch(svg,/<script|<foreignObject|<image|href=|https?:\/\/(?!www.w3.org)/);
  }
});
