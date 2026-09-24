// Read-only projections of a pinned FabGuard evidence snapshot. No SMT inference.
export const DATASETS = [
  {id:'dkasc', label:'호주 · DKASC', year:'2025', title:'Alice Springs 태양광 관측', root:'results/dkasc-alice-springs-2025', audit:'normalization_audit.json', kind:'관측값', period:'2025년 · Australia/Darwin', periodNote:'연간 파일과 365일 정규화 행렬 기준. 원본 CSV의 첫·끝 시각은 동봉된 감사에 미기록.', scope:'Alice Springs 현장 집계', unit:'kW로 추정 · 원천 스키마 직접 확인 대기'},
  {id:'pvlive', label:'영국 · PV_Live', year:'2025', title:'GB 전력망 태양광 추정', root:'results/pvlive-gb-national-2025', audit:'fetch_audit.json', kind:'추정값', period:'2025-01-01 00:30 → 2026-01-01 00:00 UTC', periodNote:'30분 구간의 종료 시각. 2025년 발전 구간에 해당하며 마지막 종료 시각은 2026년 1월 1일.', scope:'GB 전력망 전국 집계 · GSP 0', unit:'MW 입력 → kW 정규화'},
  {id:'pvgis', label:'벨기에 · PVGIS', year:'2020', title:'Brussels 태양광 기준 계산', root:'results/pvgis-brussels-2020', audit:'fetch_audit.json', kind:'모델 기반 기준값', period:'2020년 · UTC 시간별', periodNote:'요청 연도 2020, 8,784개 시간 구간. 미래 발전량 예측 결과가 아닌 과거 조건의 기준 계산.', scope:'Brussels 좌표 50.8503, 4.3517', unit:'W 입력 → kW 정규화'},
  {id:'enedis', label:'프랑스 · Enedis', year:'2024', title:'배전망 태양광 주입량 추정', root:'results/enedis-france-national-solar-2024', audit:'fetch_audit.json', kind:'추정값', period:'2024-01-01 00:00 ≤ 시각 < 2025-01-01 00:00 UTC', periodNote:'원천 CET/CEST 오프셋을 UTC로 변환한 30분 구간. 개별 공장 계측이 아닌 국가 배전망 집계.', scope:'France national distribution network', unit:'30분 Wh → 평균 W → kW'},
  {id:'rte', label:'프랑스 · RTE', year:'2024', title:'프랑스 국가 태양광 발전 추정', root:'results/rte-france-national-solar-2024', audit:'fetch_audit.json', kind:'추정값', period:'2024-01-01 00:00 ≤ 시각 < 2025-01-01 00:00 UTC', periodNote:'366일 수집 기록을 연속 UTC 30분 간격으로 정규화. 결측과 수정 상태를 보존한 국가 집계 자료.', scope:'France national electricity system', unit:'MW 입력 → kW 정규화'},
  {id:'meteo', label:'프랑스 · Météo', year:'2024', title:'Paris-Montsouris 기상 관측', root:'results/meteo-france-paris-montsouris-2024', audit:'fetch_audit.json', kind:'관측값 · 기상', period:'2024년 · 시간별', periodNote:'감사에서 프랑스 본토 시간별 시각을 UTC로 해석. 발전량이나 SMT 라인 환경 센서값은 아님.', scope:'PARIS-MONTSOURIS · 관측소 75114001', unit:'시간별 GLO J/cm² × 10000/3600 → 평균 W/m²'}
];
export function csvRows(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value,i) => [keys[i], value !== '' && Number.isFinite(Number(value)) ? Number(value) : value])));
}
export function datasetEvidence(snapshot, id) {
  const meta = DATASETS.find(item => item.id === id);
  if (!meta) throw new Error('알 수 없는 자료');
  const auditPath = `${meta.root}/${meta.audit}`, reportPath = `${meta.root}/report.json`;
  const audit = snapshot.files[auditPath], report = snapshot.files[reportPath];
  const weather = snapshot.files['web/data/global_e2e_summary.json'].sources.meteo_france_paris_2024;
  const rows = audit.normalized_rows ?? audit.rows;
  const analysisRows = report?.source.input_rows ?? weather.input_rows;
  const hash = report?.source.input_sha256 ?? weather.input_sha256;
  return {meta, audit, report, auditPath, reportPath:report ? reportPath : 'web/data/global_e2e_summary.json', rows,
    interval:audit.interval_minutes ?? audit.period_minutes ?? audit.sampling_minutes ?? report?.sdt_report.sampling,
    frictionless:report?.validation.frictionless.valid ?? weather.frictionless_valid,
    lineageMatches:rows === analysisRows && audit.normalized_sha256 === hash,
    hash, sdt:report?.sdt_report ?? null};
}
export function secomEvidence(snapshot) {
  const summary = snapshot.files['web/data/summary.json'];
  const manifest = snapshot.files['results/v1/manifest.json'];
  return {summary, manifest, audit:snapshot.files['results/v1/data_audit.json'],
    cv:summary.cv.find(row => row.candidate === manifest.selected_candidate_from_train_cv),
    test:csvRows(snapshot.files['results/v1/test_metrics.csv']).find(row => row.candidate === manifest.selected_candidate_from_train_cv),
    topK:csvRows(snapshot.files['results/v1/top_k_test.csv']),
    phase1:snapshot.files['web/data/phase1_summary.json'],
    costs:csvRows(snapshot.files['results/phase1/inspection_cost_scenarios.csv'])};
}
export function scenarioCost(row, inspection, missed) {
  if (![inspection,missed].every(x => Number.isFinite(x) && x >= 0 && x <= 1000000)) throw new Error('비용 가정은 0~1,000,000 사이여야 합니다.');
  return {total:row.inspection_count * inspection + row.missed_fail * missed, baseline:(row.captured_fail + row.missed_fail) * missed};
}
export function sourceUrl(snapshot, path) {
  return `https://github.com/${snapshot.repository}/blob/${snapshot.revision}/${path}`;
}
