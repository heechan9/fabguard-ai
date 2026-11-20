// Public, fixed educational fixture. No input API beyond scenario selection.
const VERSION = 'fabguard-synthetic-receipt-audit/v1';
const CUTOFF = '2026-01-15T09:00:00Z';
const FIXED_ROSTER = Object.freeze([
  Object.freeze({ id: 'SYN-01', lot: 'SYN-LOT-A', tool: 'SYN-TOOL-1' }),
  Object.freeze({ id: 'SYN-02', lot: 'SYN-LOT-A', tool: 'SYN-TOOL-1' }),
  Object.freeze({ id: 'SYN-03', lot: 'SYN-LOT-B', tool: 'SYN-TOOL-1' }),
  Object.freeze({ id: 'SYN-04', lot: 'SYN-LOT-B', tool: 'SYN-TOOL-2' }),
]);
const INPUT_RECEIPTS = Object.freeze({
  clean: [
    ['SYN-01', '2026-01-15T08:58:00Z'],
    ['SYN-02', CUTOFF],
    ['SYN-03', '2026-01-15T08:59:30Z'],
    ['SYN-04', '2026-01-15T08:59:40Z'],
  ],
  'late-but-complete': [
    ['SYN-01', '2026-01-15T08:58:00Z'],
    ['SYN-02', CUTOFF],
    ['SYN-03', '2026-01-15T08:59:30Z'],
    ['SYN-03', '2026-01-15T09:00:01Z'],
    ['SYN-04', '2026-01-15T08:59:40Z'],
  ],
  'late-only': [
    ['SYN-01', '2026-01-15T08:58:00Z'],
    ['SYN-02', CUTOFF],
    ['SYN-03', '2026-01-15T09:00:01Z'],
    ['SYN-04', '2026-01-15T08:59:40Z'],
  ],
  'scoring-record-missing': [
    ['SYN-01', '2026-01-15T08:58:00Z'],
    ['SYN-02', CUTOFF],
    ['SYN-03', '2026-01-15T08:59:30Z'],
    ['SYN-04', '2026-01-15T08:59:40Z'],
  ],
});
// Separate recorded stage presence, not produced by a model or inferred from intake.
const SCORING_RECEIPTS = Object.freeze({
  clean: ['SYN-01', 'SYN-02', 'SYN-03', 'SYN-04'],
  'late-but-complete': ['SYN-01', 'SYN-02', 'SYN-03', 'SYN-04'],
  'late-only': null,
  'scoring-record-missing': ['SYN-01', 'SYN-02', 'SYN-03'],
});

function registeredGroupCounts(roster, admittedIds, scoredIds) {
  const groups = new Map();
  for (const record of roster) {
    const { id, lot, tool } = record;
    const key = JSON.stringify([lot, tool]);
    if (!groups.has(key)) groups.set(key, { lot, tool, raw: 0, admitted: 0, scored: scoredIds === null ? null : 0 });
    const group = groups.get(key);
    group.raw += 1;
    if (admittedIds.has(id)) group.admitted += 1;
    if (scoredIds?.has(id)) group.scored += 1;
  }
  return [...groups.values()].map(group => ({
    ...group,
    rawToAdmittedLoss: group.raw - group.admitted,
    admittedToScoredLoss: group.scored === null ? null : group.admitted - group.scored,
  }));
}

export function runSyntheticReceiptAudit(scenario) {
  if (typeof scenario !== 'string' || !Object.hasOwn(INPUT_RECEIPTS, scenario)) {
    throw new TypeError('Choose one of the four fixed synthetic scenarios.');
  }
  const raw = new Set(FIXED_ROSTER.map(record => record.id));
  const admitted = new Set();
  const late = new Set();
  const lateEvents = [];
  const cutoffMs = Date.parse(CUTOFF);
  for (const [id, availableAt] of INPUT_RECEIPTS[scenario]) {
    const timeMs = Date.parse(availableAt);
    if (!raw.has(id) || !Number.isFinite(timeMs)) throw new Error('Invalid bundled input receipt.');
    if (timeMs <= cutoffMs) {
      if (admitted.has(id)) throw new Error('Multiple eligible receipts for one bundled record.');
      admitted.add(id);
    } else {
      lateEvents.push({ id, receivedAt: availableAt });
      late.add(id);
    }
  }
  const notAdmittedIds = [...raw].filter(id => !admitted.has(id));
  const lateOnlyIds = notAdmittedIds.filter(id => late.has(id));
  const scoring = SCORING_RECEIPTS[scenario];
  const scored = notAdmittedIds.length || scoring === null ? null : new Set(scoring);
  if (scored !== null && (scoring.length !== scored.size || [...scored].some(id => !admitted.has(id)))) {
    throw new Error('Invalid bundled scoring receipt.');
  }
  const missingScoredIds = scored === null ? [] : [...admitted].filter(id => !scored.has(id));
  return {
    scenario,
    status: scored === null ? 'BLOCKED' : missingScoredIds.length ? 'MISSING' : 'MATCH',
    lateCount: lateEvents.length,
    lateEvents,
    lateOnlyIds,
    notAdmittedIds,
    missingScoredIds,
    scoringChecked: scored !== null,
    groups: registeredGroupCounts(FIXED_ROSTER, admitted, scored),
    totals: {
      raw: raw.size,
      admitted: admitted.size,
      scored: scored?.size ?? null,
      rawToAdmittedLoss: raw.size - admitted.size,
      admittedToScoredLoss: scored === null ? null : admitted.size - scored.size,
    },
    cutoff: CUTOFF,
    fixtureVersion: VERSION,
    operationalStatus: 'WITHHELD',
  };
}
