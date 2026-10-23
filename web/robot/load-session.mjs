// Generation-guarded loading for the robot demo. Pure (no DOM), so CI can test races.
//
// Every load gets a new generation. After each await the loader checks that its
// generation is still current; if Clear, unlock or a newer load happened meanwhile,
// it discards its work. Results are committed once, atomically, by the newest load only.
// Disabling buttons is not relied on: stale completions are dropped here.

export function createLoader({digest, process}) {
  let generation = 0;
  return {
    /** Invalidate every in-flight load (Clear, unlock, contract change). */
    cancel() { generation += 1; },
    get generation() { return generation; },
    /**
     * sources: [{name, read: () => Promise<ArrayBuffer|null>, preset}]
     * onCommit(records, meta) runs only if this load is still the newest.
     * Returns {status: 'committed'|'stale'|'error', error?}.
     */
    async load(sources, onCommit, meta = {}) {
      const token = ++generation;
      const records = [];
      try {
        for (const source of sources) {
          const bytes = await source.read();
          if (token !== generation) return {status: 'stale'};
          const sha256 = bytes === null ? null : await digest(bytes);
          if (token !== generation) return {status: 'stale'};
          records.push(process(source, bytes, sha256));
        }
      } catch (error) {
        return token === generation ? {status: 'error', error} : {status: 'stale'};
      }
      if (token !== generation) return {status: 'stale'};
      onCommit(records, meta);
      return {status: 'committed'};
    },
  };
}
