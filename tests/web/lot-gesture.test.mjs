import test from 'node:test';
import assert from 'node:assert/strict';
import {TapGuard} from '../../web/smt/gesture-model.mjs';
import {Simulation} from '../../web/smt/simulation.mjs';
import {lotSummary} from '../../web/smt/lot-model.mjs';
test('two and three fingers cannot select on any release, including no movement',()=>{for(const ids of [[1,2],[2,1],[1,2,3]]){const g=new TapGuard();ids.forEach(id=>g.down(id));ids.forEach(id=>assert.equal(g.end(id),false));g.down(9);assert.equal(g.end(9),true);}});
test('cancel, unknown release and dragging do not select',()=>{const g=new TapGuard();g.down(1);g.move(1,8,0);assert.equal(g.end(1),false);g.down(2);assert.equal(g.end(2,true),false);assert.equal(g.end(99),false);});
test('lot boundaries ignore fault injection and counts reconcile with boards',()=>{const s=new Simulation();s.arm('paste');s.advance(16);s.arm('missing');s.advance(100);const snap=s.snapshot();assert.equal(snap.boards[3].lot_id,'LOT-001');assert.equal(snap.boards[4].lot_id,'LOT-002');assert.deepEqual(snap.lot_summary.map(x=>x.inserted),[4,4,4]);for(const [field,predicate] of [['completed',b=>b.done],['virtual_ng',b=>b.aoi==='NG'],['missing_measurement',b=>b.stage>=2&&b.volume===null]])assert.equal(snap.lot_summary.reduce((n,g)=>n+g[field],0),s.boards.filter(predicate).length);s.reset();assert.equal(s.snapshot().lot_summary.length,1);assert.equal(s.snapshot().boards[0].lot_id,'LOT-001');assert.equal(s.snapshot().lot_summary[0].completed,0);});
test('NG and missing are overlapping counts, not a partition',()=>{const g=lotSummary([{done:true,stage:11,volume:null,aoi:'NG'}])[0];assert.equal(g.inserted,1);assert.equal(g.virtual_ng,1);assert.equal(g.missing_measurement,1);});
