import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spiHudRecord, hudAnchorVisible, HUD_COPY, HUD_STATION} from '../../web/smt/hud-model.mjs';
import {Simulation} from '../../web/smt/simulation.mjs';

const board = (extra = {}) => ({id:'PCB-001',stage:2,volume:100,fault:null,history:[],...extra});
test('HUD is one SPI process and never reveals a future precomputed measurement', () => {
 assert.equal(HUD_STATION,2);
 assert.equal(spiHudRecord(null).state,'waiting');
 const b=board({stage:1,volume:99});
 Object.defineProperty(b,'rawVolume',{get(){throw new Error('unobserved measurement must not be read');}});
 assert.deepEqual(spiHudRecord(b),{boardId:'PCB-001',phase:'before',state:'waiting',value:null});
});
test('SPI demo range is inclusive; within is not a whole-board or equipment quality claim', () => {
 for(const volume of [80,100,120])assert.equal(spiHudRecord(board({volume})).state,'within');
 for(const volume of [0,79.99,120.01,140])assert.equal(spiHudRecord(board({volume})).state,'outside');
 assert.equal(spiHudRecord(board({stage:8,peak:270,aoi:'NG'})).state,'within');
 assert.equal(spiHudRecord(board({stage:8})).phase,'after');
 assert.equal(spiHudRecord(board()).phase,'here');
});
test('missing and invalid measurements do not become zero or a normal status', () => {
 for(const volume of [null,undefined,NaN,Infinity,-Infinity,'100']){
  const record=spiHudRecord(board({volume}));assert.equal(record.state,'missing');assert.equal(record.value,null);
 }
 assert.equal(spiHudRecord(board({volume:0})).value,0);
});
test('context HOLD remains explicit even if the SPI value is in range', () => {
 for(const fault of ['condition','review'])assert.equal(spiHudRecord(board({fault})).state,'hold');
 assert.equal(spiHudRecord(board({fault:'condition',volume:null})).state,'missing');
 assert.equal(spiHudRecord(board({fault:'condition',stage:1})).state,'waiting');
});
test('HUD observes all existing scenarios without changing seeded records or exports', () => {
 for(const fault of [null,'paste','missing','heat','condition','review']){
  const sim=new Simulation(),baseline=new Simulation();if(fault){sim.arm(fault);baseline.arm(fault);}
  for(let n=0;n<100;n++){
   sim.advance(1);baseline.advance(1);for(const b of sim.boards)spiHudRecord(b);
   assert.deepEqual(sim.snapshot(),baseline.snapshot());
  }
  assert.equal(sim.boards.length,12);assert.ok(sim.boards.every(b=>b.done));
 }
});
test('off-screen, clipped and non-finite anchors suppress the marker instead of lying about position', () => {
 assert.equal(hudAnchorVisible({x:200,y:100,z:0},800,435),true);
 for(const p of [{x:-1,y:100,z:0},{x:900,y:100,z:0},{x:100,y:20,z:0},{x:100,y:430,z:0},{x:100,y:100,z:2},{x:100,y:100,z:-2},{x:NaN,y:100,z:0}])assert.equal(hudAnchorVisible(p,800,435),false);
});
test('all HUD status and phase text has Korean and English equivalents and a synthetic boundary', () => {
 for(const lang of ['ko','en']){
  for(const state of ['waiting','missing','hold','outside','within'])assert.ok(HUD_COPY[lang].states[state]);
  for(const phase of ['before','here','after'])assert.ok(HUD_COPY[lang].phases[phase]);
 }
 assert.match(HUD_COPY.ko.scope,/합성.*실제 장비 연결 아님/);
 assert.match(HUD_COPY.en.scope,/synthetic.*no device connected/);
});
test('HUD uses non-intercepting decoration and inherits existing controls without introducing animation', async () => {
 const [css,ui,app,html]=await Promise.all(['web/smt/hud.css','web/smt/hud.mjs','web/smt/app.mjs','web/smt/index.html'].map(p=>readFile(new URL('../../'+p,import.meta.url),'utf8')));
 assert.ok(css.lastIndexOf('.smt-page .spi-hud[hidden]')>css.indexOf('@container'), 'hidden wins after mobile left-docking rule');
 assert.match(css,/pointer-events:none/);assert.match(css,/@container\(max-width:759px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(css,/@keyframes/);
 assert.match(ui,/aria-pressed="true" aria-controls="spi-hud"/);assert.match(ui,/setAttribute\('aria-hidden', 'true'\)/);
 assert.match(app,/spiHud\?\.update\(\{suppressed:true\}\)/);
 assert.match(app,/spiHud\?\.update\(\{suppressed:false\}\)/);
 assert.match(html,/id="spi-hud" class="spi-hud" hidden/);
});
