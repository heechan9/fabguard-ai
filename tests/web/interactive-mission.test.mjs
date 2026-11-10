import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,assess} from '../../web/smt/simulation.mjs';
import {lotMissionSummary,placementPose} from '../../web/smt/interactive-model.mjs';
test('temperature intervention targets only next PCB and remains unobserved until reflow exit',()=>{const s=new Simulation();const previous=s.boards[0].rawPeak;s.armPeak(260);s.advance(4);assert.equal(s.boards[0].rawPeak,previous);assert.equal(s.boards[1].rawPeak,260);assert.equal(s.boards[1].peak,null);assert.equal(s.snapshot().control_events[0].kind,'next_peak_assumption');s.advance(29.1);assert.equal(s.boards[1].peak,260);s.advance(100);assert.equal(s.boards[1].aoi,'NG');assert.equal(s.boards.filter(b=>b.fault==='temperature').length,1);});
test('normal assumption, replacement, validation and completed guard',()=>{const s=new Simulation();for(const v of [NaN,Infinity,234,281,'260'])assert.throws(()=>s.armPeak(v));s.armPeak(260);s.armPeak(245);s.advance(100);assert.equal(s.boards[1].peak,245);assert.equal(s.boards[1].aoi,'OK');assert.throws(()=>s.armPeak(260));const t=new Simulation();t.armPeak(260);t.arm('missing');t.advance(100);assert.equal(t.boards[1].volume,null);assert.ok(t.boards[1].peak<250);assert.equal(assess(t.boards[1]).level,'warn');});
test('latched synthetic stop freezes all time and never clears missing/HOLD or silently resumes',()=>{const s=new Simulation();s.arm('missing');s.advance(14);const before=JSON.stringify(s.boards);s.emergencyStop();s.running=true;s.advance(10);assert.equal(s.time,14);assert.equal(JSON.stringify(s.boards),before);s.emergencyStop();assert.equal(s.controlEvents.filter(e=>e.kind==='simulation_stop').length,1);s.releaseStop();assert.equal(s.running,false);s.advance(10);assert.equal(s.time,14);s.running=true;s.advance(100);assert.equal(assess(s.boards[1]).level,'warn');assert.equal(s.snapshot().emergency_stopped,false);s.reset();assert.equal(s.controlEvents.length,0);assert.equal(s.emergencyStopped,false);});
test('same interventions and seed produce identical snapshots; exported events do not alias state',()=>{const run=()=>{const s=new Simulation();s.armPeak(260);s.advance(20);s.emergencyStop();s.releaseStop();s.running=true;s.advance(100);return s;};assert.deepEqual(run().snapshot(),run().snapshot());const s=run(),out=s.snapshot();out.control_events[0].peak_celsius=0;assert.equal(s.controlEvents[0].peak_celsius,260);});
test('LOT mission distinguishes pending, NG and HOLD without releasing anything',()=>{const s=new Simulation();s.arm('missing');s.advance(4);assert.equal(lotMissionSummary(s.boards)[0].hold,0);s.advance(100);const row=lotMissionSummary(s.boards)[0];assert.equal(row.hold,1);assert.equal(row.completed,4);assert.equal(row.virtual_ng,0);assert.equal(row.state,'hold');assert.equal(row.waiting,0);});
test('placement geometry follows board stage/progress, never arbitrary wall time',()=>{assert.equal(placementPose({stage:2,progress:.9}).placed,0);assert.equal(placementPose({stage:3,progress:0}).placed,0);assert.equal(placementPose({stage:3,progress:.49}).placed,1);assert.equal(placementPose({stage:4,progress:0}).placed,2);assert.equal(placementPose({stage:5,progress:0}).placed,4);assert.equal(placementPose(null).active,false);for(const stage of [3,4])for(const progress of [0,.25,.5,.75,.999]){const p=placementPose({stage,progress});assert.ok(p.y>=1.4&&p.y<=1.8);assert.ok(p.placed>=0&&p.placed<=4);}});

test('explicit boundary values preserve existing greater-than-250 AOI contract',()=>{for(const [peak,expected] of [[235,'OK'],[250,'OK'],[251,'NG'],[280,'NG']]){const s=new Simulation();s.armPeak(peak);s.advance(100);assert.equal(s.boards[1].peak,peak);assert.equal(s.boards[1].aoi,expected);}});

test('temperature assumptions require their dedicated value-bearing action',()=>{const s=new Simulation();assert.throws(()=>s.arm('temperature'));assert.equal(s.pending,null);assert.equal(s.controlEvents.length,0);s.armPeak(260);assert.equal(s.pendingPeak,260);});

const peakEvents=s=>s.snapshot().control_events.filter(e=>e.kind.startsWith('next_peak_assumption'));
const strip=b=>({id:b.id,born:b.born,fault:b.fault,rawVolume:b.rawVolume,rawPeak:b.rawPeak});

test('temperature replaced by temperature records queued/replaced and applies only the final value',()=>{const s=new Simulation();s.armPeak(260);s.armPeak(245);s.advance(100);
 assert.deepEqual(peakEvents(s).map(e=>[e.kind,e.status,e.assumption_seq,e.peak_celsius]),[['next_peak_assumption','queued',1,260],['next_peak_assumption_replaced','replaced',1,260],['next_peak_assumption','queued',2,245],['next_peak_assumption_applied','applied',2,245]]);
 assert.equal(peakEvents(s)[1].replaced_by,'temperature');const applied=peakEvents(s).filter(e=>e.status==='applied');assert.equal(applied.length,1);assert.equal(applied[0].board_id,'PCB-002');assert.equal(s.boards[1].rawPeak,245);assert.ok(s.boards.every(b=>b.rawPeak!==260));});

test('temperature replaced by another fault is never recorded as applied',()=>{const s=new Simulation();s.armPeak(260);s.arm('missing');s.advance(100);
 assert.deepEqual(peakEvents(s).map(e=>[e.kind,e.status]),[['next_peak_assumption','queued'],['next_peak_assumption_replaced','replaced']]);assert.equal(peakEvents(s)[1].replaced_by,'missing');assert.equal(peakEvents(s)[1].next_board_id,'PCB-002');
 assert.equal(s.boards[1].fault,'missing');assert.notEqual(s.boards[1].rawPeak,260);assert.equal(s.pendingPeak,null);
 const t=new Simulation();t.arm('heat');t.arm('paste');assert.equal(t.controlEvents.length,0);});

test('applied time is the new PCB insertion time even when one large advance overshoots it',()=>{const s=new Simulation();s.armPeak(270);s.advance(100);const [queued,applied]=peakEvents(s);assert.equal(queued.simulation_seconds,0);assert.equal(applied.simulation_seconds,4);assert.equal(applied.simulation_seconds,s.boards[1].born);assert.ok(s.time>applied.simulation_seconds);
 const t=new Simulation();t.advance(9);t.armPeak(255);assert.equal(peakEvents(t)[0].next_board_id,'PCB-004');t.advance(100);const late=peakEvents(t).at(-1);assert.equal(late.status,'applied');assert.equal(late.board_id,'PCB-004');assert.equal(late.simulation_seconds,12);assert.equal(t.boards[3].born,12);assert.equal(t.boards[3].rawPeak,255);
 const times=t.controlEvents.map(e=>e.simulation_seconds);assert.deepEqual(times,[...times].sort((a,b)=>a-b));});

test('queued/replaced bookkeeping leaves seed-42 RNG and all other boards unchanged',()=>{const base=new Simulation();base.advance(100);const s=new Simulation();s.armPeak(260);s.armPeak(275);s.advance(100);
 assert.deepEqual(s.boards.map(strip).filter((_,i)=>i!==1),base.boards.map(strip).filter((_,i)=>i!==1));assert.equal(s.boards[1].rawVolume,base.boards[1].rawVolume);assert.equal(s.boards[1].rawPeak,275);
 for(const fault of ['paste','heat','missing','condition','review']){const a=new Simulation();a.arm(fault);a.advance(100);const b=new Simulation();b.armPeak(250);b.arm(fault);b.advance(100);assert.deepEqual(b.boards.map(strip),a.boards.map(strip));}});

test('reset from a latched stop starts a paused fresh run; normal reset and constructor keep auto-run',()=>{const fresh=new Simulation();assert.equal(fresh.running,true);
 const s=new Simulation();s.armPeak(260);s.advance(20);s.armPeak(265);s.emergencyStop();s.reset();
 assert.equal(s.running,false);assert.equal(s.emergencyStopped,false);assert.deepEqual(s.controlEvents,[]);assert.equal(s.pendingPeak,null);assert.equal(s.pending,null);assert.equal(s.time,0);assert.deepEqual(s.boards,fresh.boards);
 s.advance(10);assert.equal(s.time,0);s.running=true;s.advance(100);const ref=new Simulation();ref.advance(100);assert.deepEqual(s.boards,ref.boards);assert.deepEqual(s.controlEvents,[]);
 const n=new Simulation();n.advance(5);n.reset();assert.equal(n.running,true);n.emergencyStop();n.releaseStop();n.reset();assert.equal(n.running,true);});
