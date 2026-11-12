import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { renderPublicGuide } from '../../web/public-guide.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('easy guide uses a separate, initially collapsed native disclosure', () => {
  for (const language of ['ko', 'en']) {
    const html = renderPublicGuide(language);
    assert.match(html, /^<details class="public-guide" id="public-guide">/);
    assert.equal((html.match(/<summary>/g) || []).length, 1);
    assert.equal((html.match(/<article>/g) || []).length, 5);
    assert.doesNotMatch(html, /<details[^>]*\bopen\b|class="professional-details"/);
  }
});

test('Korean guide distinguishes saved scores, real recordings and synthetic practice', () => {
  const html = renderPublicGuide('ko');
  for (const text of ['이미 계산된 점수', '정비 전후 모델 성능을 평가하는 기능은 아닙니다', '공개 센서 기록', '설명용 합성 장면', '능력 평가가 아닙니다', '자동으로 연결되는 것도 아닙니다']) assert.ok(html.includes(text), text);
  assert.match(html, /현장 배포 완료를 뜻하지 않습니다/);
});

test('English guide carries the same limits and the same current destinations', () => {
  const en = renderPublicGuide('en');
  for (const text of ['saved score order', 'does not evaluate model performance before and after maintenance', 'Real historical recordings', 'Synthetic demonstrations', 'not automatically connected']) assert.ok(en.includes(text), text);
  const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links(en), links(renderPublicGuide('ko')));
  assert.equal(renderPublicGuide('unsupported'), renderPublicGuide('ko'));
});

test('all easy-guide links resolve to existing public entry files or routes', () => {
  const paths = [...renderPublicGuide().matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  for (const path of paths) {
    assert.ok(path.startsWith('/'), path);
    if (path.startsWith('/#')) { assert.equal(path, '/#risks'); continue; }
    const file = path.endsWith('/') ? `${path}index.html` : path;
    assert.ok(existsSync(new URL(`../../web${file}`, import.meta.url)), path);
  }
});

test('guide integration preserves expert disclosure and adds no data execution', () => {
  const app = read('../../web/app.js');
  assert.match(app, /import \{ renderPublicGuide \} from "\.\/public-guide\.mjs"/);
  assert.match(app, /app\.append\(professional\);\s*app\.querySelector\('\.hero'\)\?\.insertAdjacentHTML\('afterend', renderPublicGuide\(language\)\)/);
  const source = read('../../web/public-guide.mjs');
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|new Function|eval\(|import /);
  assert.doesNotMatch(source, /libfile_|drive\.google|claude\.ai|cohort_guard|PVD|2\.6153|63개/);
});

test('maintenance explanation keeps original controls and narrows performance claims', () => {
  const html = read('../../web/equipment/context-review.html');
  assert.match(html, /정비 전후에 모델이 더 정확해졌는지 평가하는 화면은 아닙니다/);
  assert.match(html, /입력값과 검사 결과를 처음 알 수 있었던 시각/);
  assert.match(html, /합성 사례나 코드 검사 통과는 그 평가를 대신하지 않습니다/);
  for (const id of ['context-file', 'context-example', 'context-clear', 'context-view', 'context-form', 'review-export']) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
});

test('historical research snapshot points to current guide without relabeling old results', () => {
  const html = read('../../web/research/index.html');
  assert.doesNotMatch(html, /오늘 추가된 연구/);
  assert.match(html, /프로젝트 소개의 쉬운 설명/);
  assert.match(html, /2026-10-23 14:32 UTC 근거 스냅샷/);
  assert.match(html, /2026-10-24 추가 기록/);
});
