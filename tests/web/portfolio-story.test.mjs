import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storyEvidence, renderHeroEvidence, renderPortfolioStory } from '../../web/portfolio-story.mjs';
const summary = JSON.parse(readFileSync(new URL('../../web/data/summary.json', import.meta.url), 'utf8'));
const app = readFileSync(new URL('../../web/app.js', import.meta.url), 'utf8');
const csv = path => {
  const [head, ...rows] = readFileSync(new URL(path, import.meta.url), 'utf8').trim().split(/\r?\n/);
  return rows.map(row => Object.fromEntries(row.split(',').map((value, i) => [head.split(',')[i], value])));
};

test('headline counts match canonical evaluation CSV, including missed and normal inspections', () => {
  const top = csv('../../results/v1/top_k_test.csv').find(r => Number(r.k_fraction) === .1);
  const result = csv('../../results/v1/test_metrics.csv').find(r => r.candidate === summary.selected_model);
  const e = storyEvidence(summary);
  assert.equal(e.total, ['tp','tn','fp','fn'].reduce((sum, key) => sum + Number(result[key]), 0));
  assert.equal(e.inspected, Number(top.inspection_count));
  assert.equal(e.captured, Number(top.captured_fail));
  assert.equal(e.failures, Number(top.total_fail));
  assert.equal(e.missed, Number(top.total_fail) - Number(top.captured_fail));
  assert.equal(e.passed, Number(top.false_inspections));
  assert.equal(e.lift, Number(top.lift));
  assert.match(renderHeroEvidence(summary), /24건 중 19건/);
  assert.match(renderHeroEvidence(summary), /홀드아웃 사전 노출/);
  assert.match(renderPortfolioStory(summary), /불량 5건 · 정상 35건/);
  assert.match(renderPortfolioStory(summary), /\(5 ÷ 40\) ÷ \(24 ÷ 392\) = 2\.04/);
  assert.match(renderPortfolioStory(summary), /전후 개선율이나 인과효과가 아닙니다/);
  assert.match(renderPortfolioStory(summary), /github\.com\/heechan9\/fabguard-ai\/issues/);
  assert.match(app, /실패한 성능을 숨기지 않고, 제한된 자원에서 쓸 수 있는 판단 근거로 다시 설계했습니다/);
  assert.match(app, /위험도 순으로 추천하고<br>근거의 한계까지 표시/);
});

test('missing or contradictory evidence fails before rendering a success claim', () => {
  const changes = [s => s.status = 'confirmed', s => s.test = [], s => s.top_k = [],
    s => s.top_k[1].total_fail = 25, s => s.top_k[1].captured_fail = 41,
    s => s.top_k[1].inspection_count = 393, s => s.top_k[1].inspection_count = NaN,
    s => s.test.find(r => r.candidate === s.selected_model).tp = -1,
    s => s.top_k[1].false_inspections = 34, s => s.top_k[1].lift = 9.99];
  for (const change of changes) { const bad = structuredClone(summary); change(bad); assert.throws(() => renderHeroEvidence(bad)); }
});
