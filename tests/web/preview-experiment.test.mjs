import {setTimeout as sleep} from 'node:timers/promises';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {latestPreview} from '../../verification/smt-preview-experiment.mjs';
import {Simulation, manufacturingEvents} from '../../web/smt/simulation.mjs';
import {placementPose} from '../../web/smt/interactive-model.mjs';

const delay = 5, revisions = 100;
async function experiment(queued) {
  const sim = new Simulation(), applied = [], latencies = [];
  let run = 'run-1', last = performance.now(), pendingMax = 0, stopSnapshot;
  const preview = latestPreview({
    defer: fn => setTimeout(fn, 0),
    derive: async items => { await sleep(delay); return items.map(placementPose); },
    publish: (_value, frame) => applied.push([frame.run, frame.revision]),
  });
  preview.reset(run);
  for (let i = 0; i < revisions; i++) {
    if (i === 20) {sim.emergencyStop(); stopSnapshot = sim.snapshot();}
    if (i === 25) {sim.releaseStop(); sim.running = true;}
    if (i === 60) {sim.reset(); run = 'run-2'; preview.reset(run);}
    if (i === 62) sim.armPeak(267);
    sim.advance(1);
    const frame = {run, revision:i, preview:sim.boards};
    if (queued) {
      preview.offer(frame);
      pendingMax = Math.max(pendingMax, preview.stats().pending);
    } else {
      const displayOnly = sim.boards.map(({id, stage, progress}) => ({id, stage, progress}));
      await sleep(delay); displayOnly.map(placementPose); applied.push([frame.run, frame.revision]);
    }
    await sleep(1);
    const next = performance.now(); latencies.push(next-last); last = next;
  }
  for (let drain = 0; preview.stats().inFlight && drain < 100; drain++) await sleep(5);
  assert.equal(preview.stats().inFlight,false);
  const p95 = latencies.sort((a,b) => a-b)[Math.ceil(latencies.length*.95)-1];
  sim.advance(1000);
  return {stopSnapshot, p95, applied, pendingMax, dropped:preview.stats().dropped,
          snapshot:sim.snapshot(), events:manufacturingEvents(sim.snapshot())};
}

const baseline = await experiment(false);
const test = await experiment(true);
assert.deepEqual(test.snapshot,baseline.snapshot);
assert.deepEqual(test.stopSnapshot,baseline.stopSnapshot);
assert.equal(test.stopSnapshot.emergency_stopped,true);
assert.deepEqual(test.events,baseline.events);
assert.equal(test.pendingMax,1);
assert.deepEqual(test.applied.at(-1), ['run-2',99]);
assert(!test.applied.some(([run, revision]) => run === 'run-1' && revision >= 60));
assert.equal(test.dropped + test.applied.length,revisions);
console.log(JSON.stringify({injectedAsyncDelayMs:delay,revisions,scope:'Node wall-clock simulation-loop proxy; not browser/renderer',
 baseline:{p95TickGapMs:baseline.p95,published:baseline.applied.length},
 candidate:{p95TickGapMs:test.p95,published:test.applied.length,pendingMax:test.pendingMax,discarded:test.dropped},
 sameAuthoritativeSnapshotAndEvents:true}));

// Controlled race: run-1 revision is definitely in flight, unlike timing-dependent benchmark.
const tasks = [], published = [];
let finishOld;
const queue = latestPreview({
  defer: task => tasks.push(task),
  derive: items => items[0].id === 'old'
    ? new Promise(resolve => { finishOld = resolve; })
    : Promise.resolve(items),
  publish: (value, stamp) => published.push([stamp.run,stamp.revision,value[0]]),
});
queue.reset('one');
queue.offer({run:'one',revision:0,preview:[{id:'old',stage:3,progress:.4}]});
const runningOld = tasks.shift()();
assert.equal(queue.stats().inFlight,true);
queue.offer({run:'one',revision:1,preview:[]});
queue.reset('two');
assert.equal(queue.offer({run:'one',revision:2,preview:[]}),false);
const source = {id:'new',stage:4,progress:.2,alarm:'ignored'};
queue.offer({run:'two',revision:0,preview:[source]});
source.progress = .9;
assert.equal(queue.offer({run:'two',revision:0,preview:[]}),false);
finishOld([{id:'old'}]);
await runningOld;
assert.deepEqual(published,[]);
await tasks.shift()();
assert.deepEqual(published,[['two',0,{id:'new',stage:4,progress:.2}]]);
assert.deepEqual(queue.stats(),{pending:0,inFlight:false,dropped:2});

// A -> B -> A with the exact same revision is still a different internal epoch.
const abaQueue = [], abaPublished = [];
let finishA;
const aba = latestPreview({
  defer: callback => abaQueue.push(callback),
  derive: items => items[0].id==='old' ? new Promise(resolve => {finishA=resolve;}) : items,
  publish: items => abaPublished.push(items[0].id),
});
aba.reset('A');
aba.offer({run:'A',revision:1,preview:[{id:'old'}]});
const firstA = abaQueue.shift()();
aba.reset('B'); aba.reset('A');
aba.offer({run:'A',revision:1,preview:[{id:'new'}]});
finishA([{id:'old'}]);
await firstA;
assert.deepEqual(abaPublished,[]);
await abaQueue.shift()();
assert.deepEqual(abaPublished,['new']);

const recoveredQueue = [], recovered = [];
let unavailable = true;
const recovery = latestPreview({
  defer: callback => {if (unavailable) throw new Error('defer unavailable'); recoveredQueue.push(callback);},
  derive: items => items,
  publish: items => recovered.push(items[0].id),
});
recovery.reset('A');
recovery.offer({run:'A',revision:1,preview:[{id:'discarded'}]});
assert.deepEqual(recovery.stats(),{pending:0,inFlight:false,dropped:1});
unavailable = false;
recovery.offer({run:'A',revision:2,preview:[{id:'kept'}]});
await recoveredQueue.shift()();
assert.deepEqual(recovered,['kept']);

// Asynchronous publication must be part of the guarded preview job.
const publisherTasks = [], publisherAccepted = [];
let rejectFirst, startedFirst;
const firstStarted = new Promise(resolve => { startedFirst = resolve; });
const publication = latestPreview({
  defer: callback => publisherTasks.push(callback),
  derive: items => items,
  publish: async (items, stamp) => {
    if (stamp.revision === 1) {
      await new Promise((_, reject) => { rejectFirst = reject; startedFirst(); });
    }
    publisherAccepted.push(items[0].id);
  },
});
publication.reset('publish-run');
publication.offer({run:'publish-run',revision:1,preview:[{id:'failing'}]});
const publishing = publisherTasks.shift()();
await firstStarted;
publication.offer({run:'publish-run',revision:2,preview:[{id:'kept'}]});
assert.deepEqual(publication.stats(),{pending:1,inFlight:true,dropped:0});
assert.equal(publisherTasks.length,0);
rejectFirst(new Error('asynchronous publication failed'));
await publishing;
assert.deepEqual(publication.stats(),{pending:1,inFlight:true,dropped:1});
await publisherTasks.shift()();
assert.deepEqual(publisherAccepted,['kept']);
assert.deepEqual(publication.stats(),{pending:0,inFlight:false,dropped:1});
