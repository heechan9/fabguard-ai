const v = (text) => typeof text === 'string' && text === text.trim() && /^[a-z0-9-]+$/.test(text);
const instant = (n) => Number.isSafeInteger(n) && n >= 0;
const frameKey = ({ stream, id }) => `${stream}:${id}`;

function validate(rows, archive) {
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Invalid fixture roster');
  const keys = archive ? 'arrivalAt,captureAt,digest,id,stream' : 'captureAt,digest,id,stream';
  for (const row of rows) {
    if (!row || Object.keys(row).sort().join(',') !== keys || !v(row.stream) || !v(row.id) ||
        !instant(row.captureAt) || typeof row.digest !== 'string' || row.digest.length !== 64 ||
        !/^[0-9a-f]{64}$/.test(row.digest) ||
        (archive && (!instant(row.arrivalAt) || row.arrivalAt < row.captureAt))) {
      throw new Error('Invalid frame identity, timestamp, or digest');
    }
  }
}

export function reconcile(expected, archive) {
  validate(expected, false);
  validate(archive, true);
  const wanted = new Map(expected.map(row => [frameKey(row), row]));
  if (!wanted.size || wanted.size !== expected.length) throw new Error('Expected frames must be unique');
  const groups = new Map();
  for (const row of archive) {
    const key = frameKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const findings = [];
  for (const key of [...new Set([...wanted.keys(), ...groups.keys()])].sort()) {
    const origin = wanted.get(key);
    const observed = groups.get(key) ?? [];
    if (!origin) findings.push({ type: 'unexpected frame', key });
    if (!observed.length) findings.push({ type: 'missing frame', key });
    if (observed.length > 1) findings.push({ type: 'duplicate archive entry', key });
    if (origin && observed.some(row => row.captureAt !== origin.captureAt)) {
      findings.push({ type: 'capture time changed', key });
    }
    if (origin && observed.some(row => row.digest !== origin.digest)) {
      findings.push({ type: 'payload digest changed', key });
    }
  }
  return { expectedCount: expected.length, archivedCount: archive.length,
    fixtureMatches: findings.length === 0, findings };
}

export const syntheticPayloads = Object.freeze(['capture-one', 'capture-two']);
export const changedPayload = 'capture-two-edited';
const changedDigest = 'f3abbae43544d0300f80945c57653d4a486ea2e11feb673ba1b0cf98fbc7cdf2';
const digests = ['d0809a80c3708cee6d9aaeeed49606daeb0bf524e1cc8a6a8ecfcaef58655b1b', 'e8e11744d55c0f3fad235715a7d741871fed6e3867b9e87c30a45b1b858640f7'];
export const expectedFrames = Object.freeze(digests.map((digest, i) =>
  Object.freeze({ stream: 'camera-a', id: `frame-${i+1}`, captureAt: 100 + i * 10, digest })));

export function fixture(scenario) {
  const [a, b] = expectedFrames;
  // Both captures arrive together; that does not make their capture times equal.
  const first = { ...a, arrivalAt: 150 };
  const second = { ...b, arrivalAt: 150 };
  if (scenario === 'complete') return [first, second];
  if (scenario === 'substitution') return [second, { ...second }];
  if (scenario === 'digest') return [first, { ...second, digest: changedDigest }];
  if (scenario === 'restamped') return [{ ...first, captureAt: first.arrivalAt }, second];
  throw new Error('Unknown fixed scenario');
}

function wirePage(doc) {
  const pick = doc.getElementById('frame-scenario');
  const run = doc.getElementById('frame-run');
  const status = doc.getElementById('frame-status');
  const expected = doc.getElementById('frame-expected');
  const observed = doc.getElementById('frame-observed');
  const reset = () => {
    status.textContent = 'No archive check run yet.';
    expected.textContent = observed.textContent = '—';
  };
  pick.addEventListener('change', reset);
  run.addEventListener('click', () => {
    reset();
    try {
      const result = reconcile(expectedFrames, fixture(pick.value));
      expected.textContent = 'camera-a: frame-1 captured at 100 ms; frame-2 captured at 110 ms.';
      observed.textContent = result.findings.length ?
        `${result.archivedCount} archive entries. ${result.findings.map(f => `${f.type}: ${f.key}`).join('; ')}.` :
        '2 archive entries. Both frames arrived at 150 ms, retaining their original capture times and digests.';
      status.textContent = result.fixtureMatches ? 'Synthetic archive matches the fixture.' : 'Synthetic archive does not match the fixture.';
    } catch {
      status.textContent = 'Synthetic archive check could not be run.';
    }
  });
}

if (typeof document !== 'undefined') wirePage(document);
