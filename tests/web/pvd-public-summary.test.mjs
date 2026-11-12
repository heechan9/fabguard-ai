import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../web/research/index.html',import.meta.url),'utf8');
const card=html.split('<section id="pvd"')[1]?.split('</section>')[0]??'';
test('PVD summary is anchored and separates stored results from live inference',()=>{
 assert.match(html,/href="#pvd"/); assert.match(card,/aria-labelledby="pvd-title"/);
 assert.match(card,/새 예측을 실행하지 않습니다/);assert.match(card,/불량 판정이나 실제 장비 제어 기능이 아닙니다/);
});
test('PVD summary states adverse subgroup and generalization limitations',()=>{
 for(const s of ['41.3%','500개','3.3672 → 3.6240','116개 LOT','시험자료 노출','계측 이전 실시간 예측','기존 SECOM']) assert.ok(card.includes(s),s);
});
test('Synthetic verifier checks are not misrepresented as predictive tests',()=>{
 for(const s of ['각각 합성 검사 63개','126개의 독립 실측 실험을 뜻하지 않습니다','Jules는 실행하지 못했습니다','예측 정확도','검증기 실행 기능을 연결하지 않았습니다']) assert.ok(card.includes(s),s);
});
test('Only public source links and aggregate presentation are included',()=>{
 assert.match(card,/https:\/\/zenodo.org\/records\/23442538/);
 assert.match(card,/https:\/\/creativecommons.org\/licenses\/by\/4.0\//);
 assert.doesNotMatch(card,/libfile_|\/workspace\/|cohort_guard\.py|<script|<iframe|<input|<form/);
});

test('Public summary discloses non-public evidence and reproducibility limits',()=>{
 for(const s of ['FG-PVD-ALCU-CENTER-TEMPORAL-01','공개 저장소만으로 동일 수치를 재현할 수는 없습니다','본 웹페이지의 테스트 개수가 아니며','공개 저장소만으로 해당 검사를 재실행할 수 없습니다']) assert.ok(card.includes(s),s);
});
