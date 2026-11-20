const FIXTURE = 'synthetic-roster/v1';
// SHA-256 of the UTF-8 ordered expected IDs, one per LF-terminated line.
const FIXTURE_SHA256 = '0c694d85c06332abb44610894ee89285f07732616f32d80b89754671af550419';
const EXPECTED_IDS = Object.freeze(['SYN-01', 'SYN-02', 'SYN-03']);
const SCENARIOS = Object.freeze({
  complete: Object.freeze(['SYN-01', 'SYN-02', 'SYN-03']),
  missing: Object.freeze(['SYN-01', 'SYN-03']),
  replacement: Object.freeze(['SYN-01', 'SYN-99', 'SYN-03']),
});

export function replay(scenario) {
  if (typeof scenario !== 'string' || !Object.hasOwn(SCENARIOS, scenario)) {
    throw new TypeError('Choose a supported synthetic scenario.');
  }
  const candidate = SCENARIOS[scenario];
  const missing = EXPECTED_IDS.filter(id => !candidate.includes(id));
  const foreign = candidate.filter(id => !EXPECTED_IDS.includes(id));
  const status = foreign.length ? 'SUBSTITUTED' : missing.length ? 'MISSING' : 'MATCH';
  const expected = 'Frozen eligible roster (' + EXPECTED_IDS.length + '): ' + EXPECTED_IDS.join(', ') + '. Fixed review budget per workflow: 2.';
  const observed = [
    'Baseline (' + EXPECTED_IDS.length + '): ' + EXPECTED_IDS.join(', '),
    'Candidate (' + candidate.length + '): ' + candidate.join(', '),
    'Missing: ' + (missing.join(', ') || 'none'),
    'Foreign: ' + (foreign.join(', ') || 'none'),
  ].join('. ') + '.';
  return {
    scenario,
    status,
    explanation: {
      MATCH: 'both eligible rosters match; ranking performance was not compared.',
      MISSING: 'the candidate roster is incomplete; the paired comparison stays on hold.',
      SUBSTITUTED: 'the row count is unchanged, but a foreign ID replaced an expected ID; the paired comparison stays on hold.',
    }[status],
    expected,
    observed,
    provenance: FIXTURE + ' · bundled synthetic records · expected roster SHA-256 ' + FIXTURE_SHA256 + ' (version fingerprint, not authenticity) · local replay only',
  };
}

export function receiptText(result) {
  return [
    'FabGuard public review receipt',
    'Scenario: ' + result.scenario,
    'Expected: ' + result.expected,
    'Observed: ' + result.observed,
    'Provenance: ' + result.provenance,
    'Outcome: ' + result.status + ' · ' + result.explanation,
    'Boundary: no result about defects, performance, factory suitability, or operating approval.',
  ].join('\n');
}

export function mount(doc) {
  const scenario = doc.getElementById('scenario');
  const run = doc.getElementById('run');
  const status = doc.getElementById('status');
  const fields = ['expected', 'observed', 'provenance'];
  const evidence = fields.map(id => doc.getElementById(id));
  const receipt = doc.getElementById('receipt');
  scenario.addEventListener('change', () => {
    status.textContent = 'Scenario changed. Run replay to update the result.';
    for (const item of evidence) item.textContent = '—';
    receipt.value = '';
  });
  run.addEventListener('click', () => {
    const result = replay(scenario.value);
    status.textContent = result.status + ': ' + result.explanation;
    for (let i = 0; i < evidence.length; i += 1) evidence[i].textContent = result[fields[i]];
    receipt.value = receiptText(result);
  });
}

if (typeof document !== 'undefined') mount(document);
