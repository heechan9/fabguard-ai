import { loadSource, newDocument, parseDocument, appendRecord, serializeDocument } from './model.mjs';
const $ = id => document.getElementById(id);
let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ko';
let source = null, current = null, sampleId = null;
let documentDirty = false, draftDirty = false, operation = 0;
const fields = ['reviewer_role', 'reviewed_at', 'outcome', 'proposed_action', 'rationale', 'available_evidence', 'missing_evidence'];
const copy = {
ko: {
skip:'본문으로 건너뛰기', back:'SECOM 상세로', title:'근거에 연결된 검토 메모', lead:'저장된 SECOM 위험순위 한 건을 읽고, 확인한 내용과 부족한 근거를 따로 기록합니다.', boundary:'공개 기록의 사후 검토입니다. 역할은 본인 선언이며 인증되지 않습니다. 원인 확정·출하 승인·장비 제어·실제 현장 검토 완료가 아닙니다.', loading:'고정된 근거 파일을 확인하고 있습니다.', loaded:'고정된 근거 파일의 무결성을 확인했습니다. 출처 진위나 검토자 권한의 인증은 아닙니다.', source:'고정 원본 근거', sourceBoundary:'점수는 저장된 모델 출력입니다. 익명 변수의 물리적 원인을 나타내지 않습니다. 원본 해시는 기록과 근거의 연결용이며 작성자의 신원·권한을 인증하지 않습니다.', labelHeading:'사후 관측 라벨 — 모델 판단과 분리', labelBoundary:'과거 공개 데이터에 포함된 결과입니다. 예측 시점에 미래 결과를 알고 있었다는 뜻이 아닙니다.', record:'검토 메모 추가', required:'모든 항목을 작성하세요. 알 수 없는 정보는 없다고 적고 부족한 근거를 명시하세요. 기록은 수정·삭제하지 않고 새 버전을 덧붙입니다.', reviewerRole:'역할 (본인 선언 · 미인증)', reviewedAt:'검토 시각 (UTC ISO 형식)', setNow:'현재 시각', timeHelp:'예: 2026-10-31T04:30:00.000Z. 실제 검토 시각을 입력하세요. 과거 측정 시각과 다릅니다.', outcome:'검토 상태', insufficient:'근거 부족', observation:'관찰 내용 기록 (판정 아님)', action:'후속 제안 (실행 명령 아님)', hold:'판단 보류', requestEvidence:'근거 요청', reinspect:'재검사 제안', referenceOnly:'참고 메모만', rationale:'이유', available:'확인 가능한 근거', missing:'없거나 추가로 필요한 근거', add:'현재 메모를 새 버전으로 기록', history:'메모 이력', pending:'pending · 아직 기록된 사람 검토 메모 없음', revisions:'개 버전 · 권한 인증·현장 검토 완료가 아님', files:'파일로 보존·다시 열기', storage:'현재 기록과 입력은 브라우저 메모리에만 있습니다. 새로고침·페이지 이동 시 사라집니다. JSON 파일을 내려받아 직접 보존하세요. 서버 업로드·자동 저장·다중사용자 데이터베이스가 없습니다.', unsigned:'파일은 서명되지 않았으며 외부에서 편집할 수 있습니다. 형식·출처 연결 검사는 기록 내용의 진실성이나 실제 사람의 검토를 증명하지 않습니다.', recordedAt:'이 버전의 기록 시각', privacy:'민감한 개인정보나 내부 기밀은 입력하지 마세요. 내려받은 파일은 일반 텍스트이며 암호화되지 않습니다.', export:'기록 JSON 내려받기', exportHelp:'아직 ‘새 버전으로 기록’하지 않은 입력란 내용은 내보내기에 포함되지 않습니다.', import:'같은 원본·생산 건의 기록 JSON 열기 (최대 1 MiB)', importHelp:'현재 이력과 다른 과거 버전은 덮어쓰지 않습니다. 검증 실패 시 현재 이력과 입력은 유지합니다.', footer:'FabGuard · 공개 데이터 기반 오프라인 검토 보조 · 현장 검증 아님', recorded:'새 메모 버전을 기록했습니다. 파일로 내려받아 보존하세요.', imported:'검증된 파일 이력을 불러왔습니다. 입력란 내용은 유지했습니다.', exported:'JSON 내려받기를 요청했습니다. 브라우저의 다운로드 완료와 파일을 확인하세요.', errorPrefix:'처리하지 못했습니다. 현재 이력과 입력은 유지됩니다.', loadError:'고정 근거를 확인하지 못했습니다. 검토 기능을 열지 않습니다.', tooLarge:'파일은 1 MiB 이하여야 합니다.', badSample:'해당 SECOM 생산 건이 고정 원본에 없습니다.', version:'버전', normal:'정상 (0)', fail:'불량 (1)', raw:'저장된 값', source_repo_sha:'원본 저장소 SHA', priority_table_sha256:'정본 CSV SHA-256', sample_id:'생산 건 ID', rank:'저장 순위', risk_score:'저장 위험점수 (확률 보증 아님)', prediction:'고정 임계값의 저장 예측', model:'모델', evidence_scope:'변수 근거 범위', source_role:'자료 역할', analysis_role:'분석 역할', measurement_timestamp:'원본 측정 시각 (원자료의 시간대 미명시)'
},
en: {
skip:'Skip to content', back:'SECOM detail', title:'A review note tied to evidence', lead:'Read one saved SECOM ranking record, then separately document observations and missing evidence.', boundary:'Retrospective review of public records. Reviewer roles are self-declared and unauthenticated. This is not causal confirmation, release approval, equipment control or completed field review.', loading:'Checking the pinned evidence file.', loaded:'Pinned evidence-file integrity checked. This does not authenticate source truth or reviewer authority.', source:'Pinned source evidence', sourceBoundary:'The score is a saved model output, not a physical cause attributed to anonymous variables. Hashes bind content; they do not authenticate authors or authority.', labelHeading:'Retrospective observed label — separate from prediction', labelBoundary:'This outcome is in the historical public dataset. It does not imply future outcomes were known at prediction time.', record:'Append a review note', required:'Complete every field. State when information is unavailable and identify missing evidence. Notes are appended as new revisions, never edited or deleted.', reviewerRole:'Role (self-declared · unauthenticated)', reviewedAt:'Review time (UTC ISO format)', setNow:'Use current time', timeHelp:'Example: 2026-10-31T04:30:00.000Z. Enter the actual review time, not the historical measurement time.', outcome:'Review status', insufficient:'Insufficient evidence', observation:'Documented observation (not a verdict)', action:'Proposed next step (not an execution command)', hold:'Withhold judgment', requestEvidence:'Request evidence', reinspect:'Propose reinspection', referenceOnly:'Reference note only', rationale:'Rationale', available:'Available evidence', missing:'Missing or additional evidence needed', add:'Append current note as a new revision', history:'Note history', pending:'pending · No human review note recorded', revisions:'revision(s) · Not authenticated or completed field review', files:'Preserve and reopen a file', storage:'Records and inputs exist only in browser memory. Reloading or leaving loses them. Download the JSON file to preserve it yourself. There is no server upload, autosave or multi-user database.', unsigned:'Files are unsigned and can be edited externally. Shape and source-binding checks do not prove truthful content or an actual human review.', recordedAt:'Revision recorded at', privacy:'Do not enter sensitive personal information or confidential material. Downloaded files are plain text and are not encrypted.', export:'Download recorded JSON', exportHelp:'Inputs not yet appended as a revision are excluded from the exported file.', import:'Open a record JSON for this same source and sample (maximum 1 MiB)', importHelp:'Conflicting or older histories cannot overwrite the current history. Failed validation preserves existing history and inputs.', footer:'FabGuard · Public-data offline review support · Not field validated', recorded:'New note revision recorded. Download the file to preserve it.', imported:'Validated file history loaded. Form inputs were preserved.', exported:'JSON download requested. Check the browser download and resulting file.', errorPrefix:'Could not process this action. Existing history and inputs are preserved.', loadError:'Could not verify pinned evidence. Review controls remain unavailable.', tooLarge:'File must be no larger than 1 MiB.', badSample:'This SECOM sample is not in the pinned source.', version:'Revision', normal:'Pass (0)', fail:'Fail (1)', raw:'Saved value', source_repo_sha:'Source repository SHA', priority_table_sha256:'Canonical CSV SHA-256', sample_id:'Sample ID', rank:'Saved rank', risk_score:'Saved risk score (not a calibrated probability guarantee)', prediction:'Saved prediction at the fixed threshold', model:'Model', evidence_scope:'Feature evidence scope', source_role:'Source role', analysis_role:'Analysis role', measurement_timestamp:'Original measurement time (source timezone unspecified)'
}
};
const t = key => copy[language][key] || key;
let messageKey = '', errorText = '', loadFailed = false;
function status(key) { messageKey = key; $('file-status').textContent = t(key); }
function clearError() { errorText = ''; $('error').hidden = true; $('error').textContent = ''; }
function showError(error, loading = false) {
  errorText = error instanceof Error ? error.message : String(error);
  loadFailed = loading;
  $('error').textContent = `${t(loading ? 'loadError' : 'errorPrefix')} ${errorText}`;
  $('error').hidden = false; $('error').focus();
}
function pair(list, label, value) {
  const dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = label; dd.textContent = String(value ?? ''); list.append(dt, dd);
}
function renderEvidence() {
  if (!current) return;
  const list = $('source-details'); list.replaceChildren();
  for (const key of ['sample_id','rank','risk_score','prediction','measurement_timestamp','model','evidence_scope','source_role','analysis_role','source_repo_sha','priority_table_sha256']) {
    const value = current.source[key];
    pair(list, t(key), key === 'prediction' ? (value === 1 ? t('fail') : t('normal')) : value);
  }
  const label = current.source.retrospective_label;
  $('retrospective-label').textContent = `${t('raw')}: ${label === 1 ? t('fail') : t('normal')}`;
  $('back-link').href = `/${language === 'en' ? '?lang=en' : ''}#detail/${encodeURIComponent(sampleId)}`;
}
function renderHistory() {
  if (!current) return;
  $('history-status').textContent = current.history.length ? `${current.history.length} ${t('revisions')}` : t('pending');
  const list = $('history-list'); list.replaceChildren();
  const labels = {reviewer_role:'reviewerRole',reviewed_at:'reviewedAt',outcome:'outcome',proposed_action:'action',rationale:'rationale',available_evidence:'available',missing_evidence:'missing'};
  const enums = {insufficient_evidence:'insufficient',documented_observation:'observation',hold:'hold',request_evidence:'requestEvidence',reinspect:'reinspect',reference_only:'referenceOnly'};
  current.history.forEach((entry, i) => {
    const li = document.createElement('li'), heading = document.createElement('h3');
    heading.textContent = `${t('version')} ${entry.revision ?? i + 1}`; li.append(heading);
    const recorded = document.createElement('p'); recorded.textContent = `${t('recordedAt')}: ${entry.recorded_at}`; li.append(recorded);
    for (const key of fields) { const p = document.createElement('p'), strong = document.createElement('strong'); strong.textContent = `${t(labels[key])}: `; p.append(strong, document.createTextNode((['outcome','proposed_action'].includes(key) && enums[entry[key]]) ? t(enums[entry[key]]) : String(entry[key] ?? ''))); li.append(p); }
    list.append(li);
  });
}
function translate() {
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'FabGuard · SECOM offline review' : 'FabGuard · SECOM 오프라인 검토';
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  $('language-toggle').textContent = language === 'en' ? '한국어' : 'English';
  $('language-toggle').setAttribute('aria-label', language === 'en' ? '한국어로 전환' : 'Switch to English');
  if (source) $('load-status').textContent = t('loaded');
  else if (loadFailed) $('load-status').textContent = t('loadError');
  renderEvidence(); renderHistory();
  if (messageKey) $('file-status').textContent = t(messageKey);
  if (errorText) $('error').textContent = `${t(loadFailed ? 'loadError' : 'errorPrefix')} ${errorText}`;
}
$('language-toggle').addEventListener('click', () => { language = language === 'en' ? 'ko' : 'en'; translate(); });
$('reviewed-at').value = new Date().toISOString();
$('review-form').addEventListener('input', () => { draftDirty = true; });
$('review-form').addEventListener('change', () => { draftDirty = true; });
$('set-now').addEventListener('click', () => { $('reviewed-at').value = new Date().toISOString(); draftDirty = true; });
window.addEventListener('beforeunload', event => { if (documentDirty || draftDirty) { event.preventDefault(); event.returnValue = ''; } });
$('review-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!current || !$('review-form').reportValidity()) return;
  const token = ++operation; clearError();
  const values = Object.fromEntries(fields.map(key => [key, $('review-form').elements.namedItem(key).value]));
  try {
    const next = await appendRecord(current, values, source, new Date().toISOString());
    if (token !== operation) return;
    current = next; documentDirty = true; draftDirty = false; renderHistory(); status('recorded');
  } catch(error) { if (token === operation) showError(error); }
});
$('export-record').addEventListener('click', () => {
  if (!current) return;
  clearError();
  const blob = new Blob([serializeDocument(current)], {type:'application/json'});
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `fabguard-${sampleId}-review-v${current.history.length}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  documentDirty = false; status('exported');
});
$('import-record').addEventListener('change', async event => {
  const file = event.target.files?.[0], token = ++operation;
  event.target.value = ''; // Capture first, then allow same-file retry even if this read is superseded.
  if (!file || !current) return;
  clearError();
  try {
    if (file.size > 1024 * 1024) throw new Error(t('tooLarge'));
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    if (token !== operation) return;
    const next = await parseDocument(text, source, sampleId, {now:new Date().toISOString(),current});
    if (token !== operation) return;
    current = next; documentDirty = false; renderHistory(); status('imported');
  } catch(error) { if (token === operation) showError(error); }
});
translate();
try {
  const response = await fetch('./source.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  source = await loadSource(new Uint8Array(await response.arrayBuffer()));
  sampleId = new URLSearchParams(location.search).get('sample') || source.rows[0]?.sample_id;
  if (!source.rows.some(row => row.sample_id === sampleId)) throw new Error(t('badSample'));
  current = newDocument(source, sampleId);
  $('workspace').hidden = false; $('review-fields').disabled = false; translate();
} catch(error) { source = null; showError(error, true); $('load-status').textContent = t('loadError'); }
