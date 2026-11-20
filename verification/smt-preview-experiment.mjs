// Opt-in research only: no imports from the production page and never owns simulation state.
// derive and prepare are display-only and must not publish side effects.
export function latestPreview({defer, derive, prepare = value => value}) {
  let run = null, revision = -1, epoch = Symbol(), pending = null, inFlight = false, dropped = 0;
  let shown = null, committed = 0;
  function reset(nextRun) {
    if (typeof nextRun !== 'string' || !nextRun || nextRun === run) throw new Error('distinct run ID required');
    if (pending) dropped++;
    pending = null; run = nextRun; revision = -1; epoch = Symbol(); shown = null;
  }
  function advance() {
    if (inFlight || !pending) return;
    inFlight = true;
    const task = async () => {
      const job = pending; pending = null;
      if (job) {
        try {
          const value = await derive(job.preview);
          const prepared = await prepare(value);
          // Final publication is owned by this scheduler, without any callback or await.
          if (job.epoch === epoch && job.revision === revision) {
            shown = Object.freeze({run:job.run, revision:job.revision, value:prepared});
            committed++;
          } else dropped++;
        } catch {
          dropped++; // Preview failure cannot mutate authoritative simulation or stop scheduling.
        }
      }
      inFlight = false;
      advance();
    };
    try {defer(task);} catch {
      if (pending) dropped++;
      pending = null;
      inFlight = false;
    }
  }
  function offer(job) {
    if (run === null || job.run !== run || !Number.isSafeInteger(job.revision) || job.revision <= revision) return false;
    // Intentionally only plain display props, no captured boards, evidence, alarms or callbacks.
    const preview = Object.freeze(job.preview.map(({id, stage, progress}) => Object.freeze({id, stage, progress})));
    revision = job.revision;
    if (pending) dropped++;
    pending = {run, revision, epoch, preview};
    advance();
    return true;
  }
  return {reset, offer, current: () => shown, committedCount: () => committed, stats: () => ({pending: Number(Boolean(pending)), inFlight, dropped})};
}
