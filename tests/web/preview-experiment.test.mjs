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
  return {stopSnapshot, p95, pendingMax, dropped:preview.stats().dropped,
          count:queued ? preview.committedCount() : applied.length, current:preview.current(),
          snapshot:sim.snapshot(), events:manufacturingEvents(sim.snapshot())};
}

const baseline = await experiment(false);
const test = await experiment(true);
assert.deepEqual(test.snapshot,baseline.snapshot);
assert.deepEqual(test.stopSnapshot,baseline.stopSnapshot);
assert.equal(test.stopSnapshot.emergency_stopped,true);
assert.deepEqual(test.events,baseline.events);
assert.equal(test.pendingMax,1);
assert.equal(test.current.run,'run-2');
assert.equal(test.current.revision,99);
assert.equal(test.dropped + test.count,revisions);
console.log(JSON.stringify({injectedAsyncDelayMs:delay,revisions,scope:'Node wall-clock simulation-loop proxy; not browser/renderer',
 baseline:{p95TickGapMs:baseline.p95,published:baseline.count},
 candidate:{p95TickGapMs:test.p95,published:test.count,pendingMax:test.pendingMax,discarded:test.dropped},
 sameAuthoritativeSnapshotAndEvents:true}));

// Controlled race: run-1 revision is definitely in flight, unlike timing-dependent benchmark.
const tasks = [];
let finishOld;
const queue = latestPreview({
  defer: task => tasks.push(task),
  derive: items => items[0].id === 'old'
    ? new Promise(resolve => { finishOld = resolve; })
    : Promise.resolve(items),
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
assert.equal(queue.current(),null);
await tasks.shift()();
assert.deepEqual(queue.current(),{run:'two',revision:0,value:[{id:'new',stage:4,progress:.2}]});
assert.deepEqual(queue.stats(),{pending:0,inFlight:false,dropped:2});

// A -> B -> A with the exact same revision is still a different internal epoch.
const abaQueue = [];
let finishA;
const aba = latestPreview({
  defer: callback => abaQueue.push(callback),
  derive: items => items[0].id==='old' ? new Promise(resolve => {finishA=resolve;}) : items,
});
aba.reset('A');
aba.offer({run:'A',revision:1,preview:[{id:'old'}]});
const firstA = abaQueue.shift()();
aba.reset('B'); aba.reset('A');
aba.offer({run:'A',revision:1,preview:[{id:'new'}]});
finishA([{id:'old'}]);
await firstA;
assert.equal(aba.current(),null);
await abaQueue.shift()();
assert.equal(aba.current().value[0].id,'new');

const recoveredQueue = [];
let unavailable = true;
const recovery = latestPreview({
  defer: callback => {if (unavailable) throw new Error('defer unavailable'); recoveredQueue.push(callback);},
  derive: items => items,
});
recovery.reset('A');
recovery.offer({run:'A',revision:1,preview:[{id:'discarded'}]});
assert.deepEqual(recovery.stats(),{pending:0,inFlight:false,dropped:1});
unavailable = false;
recovery.offer({run:'A',revision:2,preview:[{id:'kept'}]});
await recoveredQueue.shift()();
assert.equal(recovery.current().value[0].id,'kept');

// A failing asynchronous publication preparation must stay isolated.
const publisherTasks = [];
let rejectFirst, startedFirst;
const firstStarted = new Promise(resolve => { startedFirst = resolve; });
const publication = latestPreview({
  defer: callback => publisherTasks.push(callback),
  derive: items => items,
  prepare: async items => {
    if (items[0].id === 'failing') {
      await new Promise((_, reject) => { rejectFirst = reject; startedFirst(); });
    }
    return items;
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
assert.equal(publication.current().value[0].id,'kept');
assert.equal(publication.committedCount(),1);
assert.deepEqual(publication.stats(),{pending:0,inFlight:false,dropped:1});

// Successful stale preparation after reset, or even within the same epoch, never commits.
for (const change of ['reset','new-revision','reset-aba']) {
  const callbacks = [];
  let completeOld, markStarted;
  const oldStarted = new Promise(resolve => { markStarted = resolve; });
  const preview = latestPreview({
    defer: task => callbacks.push(task),
    derive: items => items,
    prepare: async items => {
      if (items[0].id === 'old') {
        await new Promise(resolve => { completeOld = resolve; markStarted(); });
      }
      return items[0].id;
    },
  });
  preview.reset('old-run');
  preview.offer({run:'old-run', revision:1, preview:[{id:'old'}]});
  const oldTask = callbacks.shift()();
  await oldStarted;
  if (change === 'reset') preview.reset('new-run');
  if (change === 'reset-aba') {preview.reset('mid-run'); preview.reset('old-run');}
  const run = change === 'reset' ? 'new-run' : 'old-run';
  const revision = change === 'new-revision' ? 2 : 1;
  preview.offer({run, revision, preview:[{id:'new'}]});
  assert.equal(preview.current(),null);
  completeOld(); // Resolve, not reject. Invalidity comes only from reset/new sequence.
  await oldTask;
  assert.equal(preview.current(),null);
  assert.equal(preview.committedCount(),0);
  assert.deepEqual(preview.stats(),{pending:1,inFlight:true,dropped:1});
  await callbacks.shift()();
  assert.deepEqual(preview.current(),{run,revision,value:'new'});
  assert.equal(preview.committedCount(),1);
  assert.deepEqual(preview.stats(),{pending:0,inFlight:false,dropped:1});
}
