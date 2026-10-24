import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const page = readFileSync(new URL('../../web/research/index.html', import.meta.url),'utf8');
const root = new URL('../../web/', import.meta.url);
test('research snapshot pins each source to its verified commit',()=>{
 for (const sha of ['0bdf2458a5f6bdbab1cde7485cb3ff574d08994b','e7cdc47bfc13740448f7ee160a4047f42fd887fc','7a2389b6ee34d5e25aa948498541f1d7edf0e90b','18015c7c81e6b7edb6e57e80abfb53003d88c224']) assert.ok(page.includes(`/blob/${sha}/`));
 assert.ok(page.includes('2026-10-23 14:32 UTC'));
 assert.ok(page.includes('Draft·미병합'));
});
test('claims distinguish abstention, adverse target result, synthetic scope and unrun work',()=>{
 for(const claim of ['ABSTAIN · 점수 없음 · 순위 없음','0.47934','116건 중 1건','실제 로봇 데이터 SPC 비교','실행 결과가 아직 없습니다','합성 데이터만','39회 고정 학습','기존 계산기를 대체하지 않습니다']) assert.ok(page.includes(claim), claim);
 assert.ok(page.includes('0.9333') && page.includes('1.1667') && page.includes('0.8000'));
 assert.ok(page.includes('104·28·32') && page.includes('49/50·50/50·50/50'));
});
test('static research page has no executable code or private artifact links',()=>{
 assert.doesNotMatch(page, /<(script|iframe|form|input)\b/i);
 assert.doesNotMatch(page, /(?:file:\/\/|\/Users\/|\/workspace\/|drive\.google\.com|\.joblib|\.pkl)/i);
 assert.ok(page.includes("default-src 'none'"));
});
test('local links exist and section IDs resolve uniquely',()=>{
 const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const [,href] of page.matchAll(/href="([^"]+)"/g)){
  if(href.startsWith('#')) assert.ok(ids.includes(href.slice(1)),href);
  else if(href.startsWith('/')) assert.ok(existsSync(new URL(href.slice(1)+(href.endsWith('/')?'index.html':''),root)),href);
 }
 for(const path of ['index.html','secom/index.html','equipment/index.html']) assert.ok(readFileSync(new URL(path,root),'utf8').includes('href="/research/index.html"'));
});
test('tables and keyboard navigation expose accessible context',()=>{
 assert.equal((page.match(/<table>/g)||[]).length,(page.match(/<caption>/g)||[]).length);
 assert.ok(page.includes('class="skip" href="#content"'));
 assert.ok(page.includes('aria-label="연구 항목 바로가기"'));
 assert.ok(page.includes('scope="col"') && page.includes('scope="row"'));
});
test('integrated navigation exposes separate robot demo and detailed SECOM record without replacing app',()=>{
 const home=readFileSync(new URL('index.html',root),'utf8');
 const secom=readFileSync(new URL('secom/index.html',root),'utf8');
 assert.match(home, /<aside[^>]*aria-label="별도 확장 실험"/);
 assert.ok(home.includes('href="/robot/index.html"'));
 assert.ok(home.includes('id="app"') && home.includes('src="/app.js"'));
 assert.ok(secom.includes('href="/secom/research.html"'));
 assert.ok(page.includes('href="/robot/index.html"') && page.includes('href="/secom/research.html"'));
 for(const target of ['robot/index.html','secom/research.html']) assert.ok(existsSync(new URL(target,root)));
 assert.ok(page.includes('실제 로봇 검증 결과는 아닙니다'));
});
