// Presentation-only translations. Never change source data, identifiers or exported evidence.
export const englishCopy = new Map(Object.entries({
'본문으로 건너뛰기':'Skip to content','주요 화면':'Main navigation','FabGuard AI 홈':'FabGuard AI home',
'3D 공정 체험':'3D process lab','반도체 분석 결과':'Semiconductor analysis','연구 근거·적용 상태':'Research evidence and implementation',
'장비 CSV 입력·SPC 점검 →':'Equipment CSV and SPC review →','브라우저 내 오프라인 분석 · 현장 검증 아님':'Offline browser analysis · not field validated',
'별도 확장 실험':'Separate extension experiment','로봇 확장 실험 (별도 · 합성 시연) →':'Robot extension (separate · synthetic demo) →',
'기존 제조 분석과 분리된 프로토타입입니다. 실제 로봇 데이터 검증·제어 기능이 아닙니다.':'A prototype separate from the manufacturing analysis. It does not validate or control a physical robot.',
'별도 실제 센서 기록':'Separate historical sensor measurements','UR3 · 실제 센서 기록':'UR3 · historical sensor measurements',
'UCI 공개 기록 7,409행 · 관절 전류·온도·속도와 툴 전류 19채널. 결측과 시간 공백을 유지한 탐색·재생이며 실시간 연결·예측·제어가 아닙니다. 합성 R-01·R-02 동작과 SECOM 익명 변수 분석에 연결하거나 합산하지 않습니다.':'7,409 public UCI records · 19 channels of joint current, temperature, speed and tool current. Exploration and replay preserve missing values and time gaps. No live connection, prediction or control; not combined with synthetic R-01/R-02 motion or anonymous SECOM analysis.',
'실제 센서 기록 살펴보기 →':'Explore historical sensor records →',
'문제 · 선택 · 검증':'Problem · decisions · validation','점검 순서를 정하고,':'Set the review order,','판단의 근거를 남깁니다.':'and preserve the evidence.',
'공정·품질·스마트제조 관점에서 확인할 수 있는 세 가지 증거입니다.':'Three pieces of evidence for process, quality and smart manufacturing review.',
'오프라인 평가':'Offline evaluation','점검할 여력이 한정된다면?':'What if inspection capacity is limited?',
'생산 기록을 위험도 순으로 정렬하고, 먼저 살펴볼 범위를 정했습니다.':'Production records are ranked by risk and reviewed within a fixed budget.',
'우선점검 목록 열기 →':'Open the review queue →','점검 범위별 원자료':'Source results by review budget',
'가상 공정 체험':'Synthetic process lab','어디서 사람이 판단해야 할까?':'Where is human judgment needed?',
'SMT 공정과 이상 시나리오를 조작하며 확인할 위치와 판단 경계를 살펴봅니다.':'Explore SMT stages and synthetic scenarios to see where review is needed and what cannot be concluded.',
'합성 시나리오입니다. 실제 설비 제어·물리 해석이나 SECOM 모델의 SMT 성능을 증명하지 않습니다.':'Synthetic scenarios only. They do not demonstrate hardware control, physical simulation or SECOM model performance on SMT.',
'가상 공정 체험 열기 →':'Open the synthetic lab →','시나리오와 검증 범위':'Scenarios and validation scope',
'데이터 연결 검증':'Data-contract validation','출처가 다른 값을 함께 다룬다면?':'How should different sources be handled?',
'관측·추정·기준·합성 값을 구분하고, 형식·단위·시간·출처를 확인하는 계약을 구현했습니다.':'Contracts distinguish observed, estimated, reference and synthetic values and check format, units, time and provenance.',
'태양광 자료의 연결 검증입니다. 반도체 모델의 외부 성능이나 제조 효과로 해석하지 않습니다.':'Validation of solar-data integration, not external semiconductor model performance or manufacturing impact.',
'출처별 검증 결과 열기 →':'View validation by source →','국가별 증거 목록':'Evidence catalog by country',
'01 · 결과':'01 · Result','02 · 원자료':'02 · Source evidence','분자와 분모 확인':'Check the numerator and denominator',
'03 · 계산 검증':'03 · Arithmetic audit','04 · 검토 요청':'04 · Review request','근거의 오류를 알려주세요':'Report an evidence discrepancy',
'재현 불일치, 누락된 한계, 화면과 원자료의 차이를 이슈로 남길 수 있습니다.':'Report reproducibility mismatches, missing limitations or differences between the display and source evidence.',
'GitHub 이슈 열기 →':'Open GitHub issues →','제작 과정 · 사람과 AI의 역할, 검증에서 드러난 한계':'Development · human and AI contributions · validation limits',
'사람이 정한 방향':'Human direction','최희찬: 반도체 생산 건 우선점검 문제, 프로젝트 범위와 사용자 관점, 결과의 주장 경계를 결정하고 검토합니다.':'Heechan Choi defines and reviews the prioritisation problem, project scope, user perspective and claim boundaries.',
'기여 기록 확인':'Contribution record','AI에게 맡긴 구현':'AI-assisted implementation',
'Codex가 실험·평가 코드, 웹 화면, 기술 문서와 테스트의 대부분을 작성했습니다. 이를 사용자의 단독 직접 코딩 성과로 표시하지 않습니다.':'Codex wrote most experiment/evaluation code, web interfaces, technical documentation and tests. This is not presented as solely hand-coded by the owner.',
'AI 활용 기록 확인':'AI usage record','확인하고 공개한 문제':'Disclosed problems',
'고정 임계값에서 불량을 포착하지 못한 결과와 홀드아웃 사전 노출을 기록했습니다. 자동 불량 판정 성능을 주장하지 않고 잠정 결과로 관리합니다.':'Failure to capture defects at the fixed threshold and prior holdout exposure are disclosed. Results remain provisional; automated defect classification is not claimed.',
'노출과 변경 이력 확인':'Exposure and change history','아직 필요한 증거':'Evidence still needed',
'독립 제조 데이터와 실제 점검·품질 기록이 필요합니다. 익명 변수의 원인성, 수율 개선, 비용 절감은 입증하지 못했습니다.':'Independent manufacturing data and actual inspection/quality records are needed. Causality, yield improvement and cost savings are not established.',
'다음 검증 조건 확인':'Next validation requirements','역할 설명은 저장소의 기여·AI 활용 기록에 근거합니다. 개별 오류를 사용자가 직접 발견했다는 이력은 추가하지 않았습니다.':'Roles follow repository contribution and AI usage records. No claim is added that the owner personally discovered individual errors.',
'직무 관점에서 읽기: 공정은 점검 순서, 품질은 포착과 누락, 스마트제조는 데이터 연결의 근거를 확인할 수 있습니다. 실제 공정 개선·설비 제어 실적은 아닙니다.':'Process reviewers can inspect prioritisation, quality reviewers capture and misses, and smart-manufacturing reviewers data contracts. These are not field process-improvement or equipment-control achievements.',
'직무별 증거와 설명 예시 →':'Role-specific evidence and examples →','검토 질문':'Review question',
'왜 정확도보다 점검 범위별 포착·누락을 봤을까요?':'Why examine capture and misses by review budget instead of accuracy alone?',
'평가 기준':'Evaluation contract','와':'and','재현 방법':'Reproduction guide','에서 확인할 수 있습니다.':'provide the details.',
'공정 흐름을 직접 살펴보세요.':'Explore the process flow.',
'PCB 이동·납 부족·과열·센서 누락을 조작하는 가상 실험실입니다. SECOM 모델을 SMT에 적용하지 않으며, 국가별 실제 분석 근거를 따로 확인할 수 있습니다.':'A synthetic lab for PCB movement, insufficient solder, overheating and missing sensors. The SECOM model is not applied to SMT; source-specific analysis evidence is separate.',
'SMT 3D 실험실':'SMT 3D lab','검증 설계와 한계를':'Explore the validation design','더 확인하시겠어요?':'and its limitations.',
'시간순 검증, 불확실성, 현장 적용 경계와 실패 기록을 한 화면에서 확인할 수 있습니다.':'Review temporal validation, uncertainty, field-use boundaries and disclosed failures in one place.',
'방법론과 한계 전체 보기':'View methodology and limits',
'우선점검':'Review queue','3D 모델링':'3D models','반도체 분석':'Analysis','우선점검 목록':'Review queue','먼저 확인할':'Review first:','생산 건 50개':'50 production records',
'위험점수 순으로 정렬한 저장 목록입니다. 한 건을 선택해 근거와 한계를 확인하세요.':'Saved records ranked by risk score. Select a record to review its evidence and limits.',
'위험점수는 불량 확정값이 아닙니다. RF 전체 중요 변수는 모든 건에 같으며, 개별 위험 원인을 뜻하지 않습니다.':'Risk scores do not confirm defects. RF global feature importance is the same for every record, not a case-specific cause.',
'AI가 위험 신호가 큰 순서로 정렬한 목록입니다. 위험점수는 불량 확정값이 아니며, 행을 선택하면 변수 근거의 범위와 해석 한계를 볼 수 있습니다. RF 전체 중요 변수는 모든 건에 동일하며 해당 건의 개별 위험 원인이 아닙니다.':'Records ranked by risk signal. A risk score does not confirm a defect. Select a row to inspect the evidence scope and limitations. RF global feature importance is identical for all records and is not a case-specific cause.',
'점검 후보':'Review candidates','위험도 순으로 정렬':'Ranked by risk','시간순 검증구간 · 위험도 상위 목록':'Temporal holdout · highest-ranked records','데이터 준비됨':'Data ready',
'← 좌우로 밀어 전체 열 보기 →':'← Scroll horizontally to view all columns →','순위':'Rank','생산 건 ID':'Record ID','측정 시각':'Measurement time','위험점수':'Risk score','실제 결과':'Recorded outcome','근거 범위':'Evidence scope','불량':'Fail','정상':'Pass',
'전체 모델 중요도':'Global model importance','RF 전체 모델의 중요 변수 상위 5개':'Top five features of the global RF model',
'모든 생산 건에 동일한 목록입니다. 이 건의 개별 예측 설명이나 위험 원인을 나타내지 않습니다. 익명 변수의 중요도는 실제 센서 원인·인과관계가 아닙니다.':'The same list is shown for all records. It is not a local prediction explanation or risk cause. Anonymous feature importance does not establish physical sensor causes or causality.',
'개별 선형 기여도':'Local linear contribution','이 건의 선형 모델 기여 변수':'Linear model feature contributions for this record',
'변환된 입력과 계수의 곱에 따른 로짓 기여도입니다. 기준값과 전처리에 의존하며, 실제 센서 원인·인과관계를 설명하지 않습니다.':'Logit contributions from transformed inputs multiplied by coefficients. They depend on the reference and preprocessing and do not explain physical sensor causes or causality.',
'설명 범위 미확인':'Unverified explanation scope','변수 설명을 확인할 수 없습니다':'Feature explanation unavailable','근거 범위를 확인하기 전에는 이 건의 설명으로 해석하지 않습니다.':'Do not interpret this as a case explanation until its evidence scope is verified.',
'← 우선점검 목록':'← Review queue','AI 위험점수':'AI risk score','고정 기준 예측':'Prediction at the fixed threshold','데이터의 실제 결과':'Recorded outcome','엔지니어 확인':'Engineer review','다음 단계:':'Next steps:',
'익명 변수의 실제 센서·공정 매핑 → 4M 및 변동점 기록 → 품질 이력 대조 → 재검사·설비점검 여부를 사람이 결정합니다.':'Map anonymous features to actual sensors/processes → examine 4M and change-point records → compare quality history → a person decides whether reinspection or equipment checks are needed.',
'해석할 때 주의':'Interpretation limits','이 건의 개별 예측 설명이 아니라 RF 전체 중요도입니다. 익명 변수는 실제 센서·공정 원인이 아닙니다.':'Global RF importance, not a local prediction explanation. Anonymous features are not actual sensor or process causes.',
'생산 건을 찾을 수 없습니다.':'Production record not found.','목록으로':'Back to queue','표시할 우선점검 생산 건이 없습니다.':'No review candidates to display.','화면을 찾을 수 없습니다.':'Page not found.','처음으로':'Home','결과를 불러오지 못했습니다.':'Could not load the results.','다시 시도':'Retry',
'데이터 처리 도구':'Data processing tools','합성 센서 REST 연결·재시작·중복격리 검증':'Synthetic sensor REST integration, restart and duplicate-isolation checks','합성':'Synthetic','스키마 오류를 SDT 실행 전에 차단':'Block schema errors before SDT execution','합성·호주 관측·영국 추정·EU 기준 PV 품질 파이프라인 실행':'PV quality pipelines for synthetic, Australian observed, British estimated and EU reference data','출처·시각·단위·해시·주장 경계 기록':'Record provenance, time, units, hashes and claim boundaries','국가별 데이터 검증 상태':'Data-validation status by country','호주 DKASC 관측 데이터 검증 결과':'Australian DKASC observed-data validation','호주':'Australia','미국':'United States','대한민국':'South Korea','5분 간격 정규화 슬롯':'Normalised five-minute slots','SDT 품질점수':'SDT quality score','kW 추정':'kW inferred','원본 스키마 직접 확인 대기':'Direct source-schema confirmation pending',
'PV 확장은 데이터 수집·품질·감사 호환성 데모입니다. 태양광 결과를 SECOM 모델의 외부검증이나 패널 고장진단·현장 성과로 주장하지 않습니다.':'The PV extension demonstrates ingestion, quality and audit compatibility. Solar results do not establish external SECOM validation, panel fault diagnosis or field impact.',
'확률모델 위에':'Place guardrails around','가드레일을 둡니다.':'probabilistic models.',
'위험점수는 확정 판정이 아니라 검토 순서를 만드는 신호입니다.':'A risk score orders review; it is not a definitive decision.',
'점검예산·표시형식·익명변수 한계·인간 승인을 고정합니다.':'Fix the review budget, display contract, anonymous-feature limits and human decision boundary.',
'재검사·설비점검·공정조치는 엔지니어가 결정합니다.':'Engineers decide reinspection, equipment checks and process actions.',
'Industrial AI·생산기술·생산관리·스마트제조 자료는 운영 설계에만 참고했으며 학습 데이터, 성능 증거 또는 반도체 공정 원인 근거로 사용하지 않았습니다.':'Industrial-AI and manufacturing references inform the operating design only, not training data, performance evidence or semiconductor causality.',
'측정한 것과':'Separate measured evidence','검증할 것을 분리합니다.':'from future validation.',
'스마트제조 연구에서 사용하는 성과지표를 향후 검증 항목으로 참고하되, FabGuard V1의 효과로 전용하지 않습니다.':'Manufacturing KPIs inform future validation; they are not presented as FabGuard V1 impact.',
'모델·운영 시뮬레이션':'Model and operational scenarios','PR-AUC · Top-K 포착률 · Lift · 점검 건수':'PR-AUC · Top-K capture · lift · review count','제조 운영 KPI':'Manufacturing KPIs','불량률 · 가동률 · 리드타임 · 의사결정시간':'Defect rate · availability · lead time · decision time','사업 성과':'Business outcomes','수율 · 제조원가 · 비용절감 · 매출':'Yield · manufacturing cost · savings · revenue',
'현재 측정값은 고정 공개데이터의 오프라인 실험 결과입니다. 제조·사업 KPI에는 실제 시스템 연동, 작업 기록과 전후 또는 대조 검증이 필요합니다.':'Current measurements are offline results on fixed public data. Manufacturing/business KPIs require actual integration, work records and before/after or controlled validation.',
'도입 전후가 아니라,':'Compare with a counterfactual,','반사실과 비교합니다.':'not before/after alone.',
'현장 KPI가 변해도 곧바로 FabGuard의 효과라고 결론내리지 않습니다. 실제 도입 전 처리·비교조건과 주요 지표를 먼저 고정합니다.':'A change in field KPIs does not establish FabGuard impact. Fix treatment/comparison conditions and primary metrics before deployment.',
'무작위·단계적 도입':'Randomised or phased pilot','가능하면 shift·라인·기간 블록을 배정해 FabGuard 점검 큐 제공군과 기존 절차군을 비교합니다. 전면 도입 시에는 도입 순서를 나눈 단계적 시험을 검토합니다.':'Where feasible, assign shift, line or time blocks to compare FabGuard queues with existing practice. Consider a phased trial if all sites will eventually adopt it.',
'이중차분·컷오프':'Difference-in-differences or cutoff','유사한 미도입 라인과 변화 차이를 비교하거나, 고정된 점검 cutoff가 실제 배정을 결정할 때만 경계 주변의 국소 효과를 검토합니다.':'Compare changes with similar untreated lines, or estimate a local cutoff effect only when a fixed review cutoff actually determines assignment.',
'가정·라벨·교란 기록':'Assumptions, labels and confounders','평행추세, cutoff 조작, 동시 공정 변경과 함께 점검된 건에만 결과가 남는 선택적 라벨 편향 및 인간 override를 감사합니다.':'Audit parallel trends, cutoff manipulation, concurrent process changes, selective labels observed only for reviewed records and human overrides.',
'위 내용은 향후 현장검증 계획이며 완료된 실험이 아닙니다. 현재 FabGuard가 증명한 범위는 공개데이터의 오프라인 모델·Top-K 결과뿐입니다.':'This is a proposed field-validation protocol, not a completed experiment. Current evidence covers offline model and Top-K results on public data only.',
'유사한 실패 양상,':'A similar failure pattern,','직접 비교는 아님.':'not a direct comparison.',
'최근 공개된 독립 벤치마크(Patel, 2026)에서도 SECOM 데이터에 무작위 층화 80/20 분할을 적용한 Random Forest의 F1이 0%로 보고되어, FabGuard가 시간순 25% 홀드아웃에서 관찰한 고정 임계값 분류 실패와 유사한 양상을 보였습니다.':'A public independent benchmark (Patel, 2026) reports 0% F1 for Random Forest on an 80/20 random stratified SECOM split, a pattern similar to the fixed-threshold failure in FabGuard’s temporal 25% holdout.',
'분할 방식과 평가 지표가 달라 직접 비교할 수는 없지만, 이 사례는 SECOM의 극심한 클래스 불균형에서 고정 임계값 기반 이진 분류가 실패할 수 있음을 보여주는 제한적인 외부 근거입니다.':'Different splits and metrics prevent direct comparison. This is limited external context for possible fixed-threshold classification failure under severe SECOM class imbalance.',
'독립 벤치마크 확인 ↗':'View independent benchmark ↗','독립 벤치마크 비교 근거 보기':'View external benchmark comparison limits','방법론과 운영 설계':'Methodology and operating design','방법론에서 현장 경계까지.':'From methodology to field-use boundaries.','홈에서 분리한 검증·운영 근거입니다. 공개데이터 결과와 향후 현장 설계를 구분합니다.':'Validation and operating evidence separated from the homepage. Public-data results and proposed field design remain distinct.'
}));
const patterns = [
 [/^(\d+)건 중 불량 (\d+)건 · 정상 (\d+)건\.$/,(_,a,b,c)=>`${a} reviewed: ${b} Fail and ${c} Pass records.`],
 [/^점검 범위 밖의 불량 (\d+)건까지 함께 공개합니다\.$/,(_,a)=>`${a} failures outside the review budget are also disclosed.`],
 [/^(\d+)건 우선점검 → 불량 (\d+)건$/,(_,a,b)=>`Review ${a} first → ${b} failures captured`],
 [/^전체 (\d+)건에서 정한 점검 예산의 잠정 결과입니다\.$/,(_,a)=>`Provisional result under a fixed review budget across ${a} records.`],
 [/^불량 (\d+)건 중 (\d+)건 포착, (\d+)건 누락, 정상 (\d+)건 점검\.$/,(_,a,b,c,d)=>`${b} of ${a} failures captured, ${c} missed, ${d} normal records reviewed.`],
 [/^집중도 ([\d.]+)배$/,(_,a)=>`Concentration ${a}×`],
 [/^(.*)\. 전후 개선율이나 인과효과가 아닙니다\.$/,(_,a)=>`${a}. Not a before/after improvement or causal effect.`],
 [/^우선순위 (\d+)$/,(_,a)=>`Review rank ${a}`],
 [/^(.*) · 시간순 검증구간의 생산 건$/,(_,a)=>`${a} · production record in the temporal holdout`],
 [/^(.*) 상세 점검 결과 열기$/,(_,a)=>`Open review details for ${a}`],
 [/^(.*) 국기$/,(_,a)=>`${englishCopy.get(a)||a} flag`]
];
export function englishText(value) {
 const text=value.trim(); if(englishCopy.has(text))return value.replace(text,englishCopy.get(text));
 for(const [pattern,replace] of patterns)if(pattern.test(text))return value.replace(text,text.replace(pattern,replace));
 return value;
}
export function translateEnglish(root=document.body) {
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode())if(!walker.currentNode.parentElement?.closest('script,style,textarea,[data-user-content]'))nodes.push(walker.currentNode);
 for(const node of nodes)node.nodeValue=englishText(node.nodeValue);
 for(const el of root.querySelectorAll('[aria-label],[title],[alt],[placeholder]'))for(const key of ['aria-label','title','alt','placeholder'])if(el.hasAttribute(key))el.setAttribute(key,englishText(el.getAttribute(key)));
 // These linked lab pages have no English mode yet. Do not silently advertise one.
 for(const link of root.querySelectorAll('a[href]')) {
  const url=new URL(link.href,location.href);
  if(url.origin===location.origin && /^\/(smt|secom|research|equipment|robot)(\/|$)/.test(url.pathname) && (url.pathname.endsWith('/') || url.pathname.endsWith('.html'))) {
   if(!link.querySelector('.language-note')) { const note=document.createElement('small');note.className='language-note';note.textContent=' (Korean page)';link.append(note); }
  }
 }
}
for (const [ko,en] of Object.entries({
'실버 / 다크':'Silver / Dark','실버 / 다크 테마 (눌림 상태는 다크)':'Silver / Dark theme (dark when pressed)',
'PHASE 1 / 고급 검증':'PHASE 1 / ADVANCED VALIDATION','점추정치보다':'Look beyond point estimates','변동성과 불확실성을 봅니다.':'to variability and uncertainty.',
'후기 평가 구간은 같지만, Phase1은 학습 구간의 앞 80%로 학습하고 뒤 20%로 보정합니다. 학습 구간 전체를 사용하는 V1과 조건이 다릅니다. 비용은 실제 금액이 아니라 시나리오 가정값입니다.':'The later evaluation period is shared, but Phase 1 trains on the first 80% of training data and calibrates on its last 20%. This differs from V1 training on the full training period. Costs are scenario assumptions, not actual currency.',
'확률 보정 · ECE':'Calibration · ECE','비용 시나리오 내 최저':'Lowest cost within the scenario','구간별 변동이 커서 단일 홀드아웃 수치를 대표 성능으로 볼 수 없습니다.':'Performance varies widely across periods; a single holdout score is not representative.',
'RF vs Logistic · 학습 CV paired':'RF vs Logistic · paired training CV','누출을 막고, 위험을 정렬하다.':'Prevent leakage and rank risk.',
'모든 전처리는 학습 폴드에만 적합하고 마지막 25% 구간은 시간순 홀드아웃으로 분리했습니다.':'All preprocessing is fitted within training folds. The last 25% forms a temporal holdout.',
'SECOM 입력':'SECOM input','누출 방지 전처리':'Leakage-aware preprocessing','학습 폴드 내부 적합':'Fit within training folds','위험도 산출':'Risk scoring','비교·선택·홀드아웃':'Comparison · selection · holdout','우선점검 큐':'Review queue','Top-k 의사결정 지원':'Top-K decision support','점검 범위별 Fail 포착률':'Fail capture by review budget','위험도가 높은 생산 건부터 확인했을 때의 시간순 홀드아웃 결과입니다.':'Temporal holdout results when reviewing highest-risk records first.',
'현장 요구에서 점검 큐로,':'From field needs to a review queue,','판단과 개선은 사람에게.':'with decisions and improvement left to people.',
'실제 도입 전 현장의 문제와 점검 가능 건수를 먼저 확인한 뒤 MES·FDC·검사 이력을 FabGuard의 검토 순서와 연결합니다. AI는 순서만 제안하고, 엔지니어가 맥락을 확인해 조치와 결과를 기록합니다.':'Before real adoption, define the field problem and inspection capacity, then connect MES/FDC/inspection history to the review order. AI proposes an order; engineers inspect context and record actions and outcomes.',
'현장 요구 정의':'Define field needs','어떤 판단을 도울지, 하루에 몇 건을 실제로 확인할 수 있는지 먼저 정합니다.':'First define the decision to support and the number of records that can actually be reviewed each day.',
'근거로 순서 제안':'Evidence-based ordering','생산 이력과 연속 점수를 점검 가능 건수에 맞춰 정렬합니다.':'Rank production history and continuous scores within the inspection budget.',
'엔지니어 판단':'Engineer judgment','4M·변동점·품질 이력을 대조하고 재검사·설비점검 여부를 결정합니다.':'Compare 4M, change points and quality history before deciding reinspection or equipment checks.',
'결과와 피드백 기록':'Record outcomes and feedback','조치·최종 품질·사람의 override를 다음 운영규칙을 검토할 근거로 남깁니다.':'Record actions, final quality and human overrides as evidence for reviewing future operating rules.',
'중요 익명변수는 원인이 아닌 점검 후보입니다. SECOM만으로 4M 범주, 실제 센서, 수율 개선 또는 비용 절감 효과를 규명하지 않습니다.':'Important anonymous features are review candidates, not causes. SECOM alone cannot identify 4M categories, actual sensors, yield improvement or cost savings.',
'V1은 공개 SECOM 데이터의 오프라인 위험순위화와 Top-K 점검 큐만 구현했습니다. 현장 요구 확인, 실시간 MES/FDC 연동, 생산 제어와 피드백 저장은 목표 구조이며 구현 완료 기능이 아닙니다.':'V1 implements offline SECOM risk ranking and Top-K queues. Field requirements, live MES/FDC integration, production control and factory feedback storage remain a target architecture. The separate self-declared offline review memo is not an authenticated factory system.',
'실제로 확보한 자료':'Available source evidence','어느 자료를 분석했나요?':'Which data were analysed?','저장된 분석 결과 · 실시간 연결 아님':'Saved analysis results · not a live connection',
'국가를 선택하면 확보한 기간과 검사 결과를 볼 수 있어요. 태양광·날씨 자료를 정리한 화면이며, SMT 기판의 불량을 예측하는 자료는 아닙니다. 연도와 조건이 달라 국가별 순위는 매기지 않아요.':'Select a country to inspect coverage and validation results. These solar/weather records do not predict SMT defects. Different years and conditions prevent country rankings.',
'관측값':'Observed','실제로 측정':'Measured','추정값':'Estimated','여러 자료로 추산':'Estimated from multiple inputs','기준값':'Reference','가정을 넣어 계산':'Calculated under assumptions',
'호주 · DKASC':'Australia · DKASC','영국 · PV_Live':'Great Britain · PV_Live','벨기에 · PVGIS':'Belgium · PVGIS','프랑스 · Enedis':'France · Enedis','프랑스 · RTE':'France · RTE','프랑스 · Météo':'France · Météo',
'Alice Springs 태양광 관측':'Alice Springs observed solar data','실제로 측정한 태양광 자료입니다. 비어 있는 값과 추정된 단위를 확인해야 해요.':'Measured solar data. Missing values and inferred units require attention.',
'주의 · 원본 보고서에 자료 품질 경고가 있어요. 파일 형식 검사 통과와는 별개입니다.':'Caution · the source report contains a data-quality warning, separate from passing format validation.',
'Alice Springs 현장 집계':'Alice Springs site aggregate','확보 자료의 기간':'Available period','2025년 · Australia/Darwin':'2025 · Australia/Darwin','연간 파일과 365일 정규화 행렬 기준. 원본 CSV의 첫·끝 시각은 동봉된 감사에 미기록.':'Based on an annual file and a 365-day normalised matrix. First/last original CSV timestamps are not recorded in the bundled audit.',
'검사용으로 정리한 기록':'Records prepared for validation','파일 형식 검사':'Format validation','통과':'Pass','확인 필요':'Review needed','개별 분석 보고서에 기록':'Recorded in the analysis report','웹 요약에 기록 · 개별 보고서 미동봉':'Recorded in the web summary · no individual report bundled','자료 품질 점수':'Data-quality score','분석 범위':'Analysis scope','기상 계약 검증':'Weather contract validation','SDT의 0–1 점수 · 예측 정확도나 불량률 아님':'SDT score from 0–1 · not prediction accuracy or defect rate','SDT 발전 분석 · 미래 예측 없음':'No SDT generation analysis or future prediction',
'SDT 품질 경고가 기록되어 있습니다. 구조검사 통과가 모든 관측값의 정확성을 보장하지는 않습니다.':'An SDT quality warning is recorded. Passing structural validation does not guarantee every observation is accurate.',
'품질 분석의 세부 수치 보기 · SDT':'Detailed quality diagnostics · SDT','과거 자료의 알고리즘 진단값 · 설비 이상 확정이나 국가 성능 비교에 사용하지 않음':'Algorithmic diagnostics on historical data · not confirmed equipment faults or country performance comparisons','클리핑 신호':'Clipping signal','없음':'No','용량 변화 신호':'Capacity-change signal','SDT 품질 경고':'SDT quality warning','있음':'Yes','미기록':'Not recorded','단위·검증 상태·출처 확인':'Units, validation status and provenance','kW로 추정 · 원천 스키마 직접 확인 대기':'kW inferred · direct source-schema confirmation pending','일치':'Match','불일치 · 확인 필요':'Mismatch · review needed','. 원본 CSV를 다시 해시하거나 분석을 재실행한 검증은 아닙니다.':'. This does not rehash the original CSV or rerun the analysis.','정규화 감사 ↗':'Normalisation audit ↗','수집 감사 ↗':'Collection audit ↗','원본 분석 보고서 ↗':'Source analysis report ↗','저장소 웹 요약 ↗':'Repository web summary ↗',
'SMT에 지금 연결되는 것과 추가로 필요한 것':'Current SMT connections and remaining requirements','항목':'Item','현재 연결':'Current connection','실제 SMT 적용에 필요한 자료':'Data required for real SMT use','국가별 PV·기상':'Country PV/weather','저장된 품질검사·분석 근거 열람':'View saved validation and analysis evidence','공장 위치·동일 기간·계량기·설비 부하가 있어야 에너지 분석과 연결 가능':'Energy analysis requires a factory location, aligned period, meter and equipment load data','SECOM 예측모델':'SECOM prediction model','별도 반도체 분석 화면':'Separate semiconductor analysis page','에서 과거 평가 열람':'shows historical evaluation','SMT용 모델 별도 학습·시간 분리 평가·독립 검증. SECOM의 익명 590개 변수와 SPI 값은 호환되지 않음':'SMT needs its own training, temporal evaluation and independent validation. SECOM’s 590 anonymous features are not interchangeable with SPI values',
'실제 공정 이력·센서':'Actual process history/sensors','가상 PCB·규칙 유지':'Synthetic PCBs and rules retained','board_id, 공정, 이벤트 시각, 단위가 있는 SPI·리플로우·AOI 내보내기와 Fledge 연결 계약':'SPI/reflow/AOI exports with board_id, stage, event time and units, plus a Fledge integration contract','불량·설비 고장 예측':'Defect/equipment-fault prediction','검증된 SMT 예측 없음':'No validated SMT prediction','PCB별 검사 라벨·재작업·고장 이력, 누락 처리, 시간 누수 차단, 보정·오경보 검증':'PCB inspection labels, rework/fault history, missing-data handling, temporal leakage prevention, calibration and false-alarm validation','생산량·전력비 예상':'Throughput/energy-cost estimates','실측 기반 결과 없음':'No measurement-based result','실제 사이클·정지·불량·부하·요금 자료와 명시적 시나리오 가정':'Actual cycles, stops, defects, loads, tariffs and explicit scenario assumptions',
'SMT 3D 시나리오의 가정과 계산 근거':'Assumptions and arithmetic behind synthetic SMT scenarios','고정 난수 시드 42로 가상 측정값을 만듭니다. r은 0 이상 1 미만의 의사난수이며 각 측정에 다음 난수를 사용합니다. 실제 장비 규격이나 물리 예측 모델은 포함하지 않습니다.':'Synthetic measurements use seed 42. Each measurement consumes the next pseudorandom r in [0,1). No actual equipment specifications or physical prediction model are included.',
'시나리오':'Scenario','값 생성':'Value generation','표시 규칙':'Display rule','기본 PCB':'Baseline PCB','납 round(94 + 12r)%':'Solder round(94 + 12r)%','최고 온도 round(239 + 8r)°C':'Peak temperature round(239 + 8r)°C','SPI·리플로우 측정 시점 이후 공개':'Revealed after SPI/reflow measurement','납 부족':'Insufficient solder','80% 미만이면 검토 · AOI에서 가상 NG':'Review below 80% · synthetic AOI NG','과열':'Overheating','250°C 초과이면 검토 · AOI에서 가상 NG':'Review above 250°C · synthetic AOI NG','센서 누락':'Missing sensor','SPI 값 null':'SPI value null','AOI OK여도 데이터 검토 유지':'Data review remains required even with AOI OK','배치 시간':'Batch duration','11공정 체류 합 42초 + (12−1)×4초 = 86초':'11 stage dwell times total 42 s + (12−1)×4 s = 86 s','시뮬레이션 시간 · 실제 생산성 계산 아님':'Simulation time · not actual productivity',
'AOI도 같은 규칙으로 생성되므로 독립적인 정답 검증이나 예측 정확도를 계산할 수 없습니다. 상단의 범위 표시는 데모 설정이며 구현된 이상은 납 하한·온도 상한·누락에 한정됩니다.':'AOI uses the same rules, so it cannot provide independent ground truth or prediction accuracy. Displayed ranges are demo settings; implemented scenarios cover low solder, high temperature and missing data only.',
'시나리오 계산 코드 ↗':'Scenario arithmetic code ↗','표시 근거 JSON 저장 ↓':'Download display-evidence JSON ↓','FabGuard 자료 목록 ↗':'FabGuard evidence catalog ↗','SECOM 반도체 분석 →':'SECOM analysis →',
'영국 전체 태양광 발전을 추정한 자료입니다. 개별 설비를 직접 측정한 값은 아니에요.':'Estimated solar generation across Great Britain, not direct measurements of individual equipment.','특정 위치와 설비 조건을 넣어 계산한 기준 자료입니다. 실제 발전량이나 미래 예측이 아니에요.':'Reference calculations for a specified location and system, not actual generation or a future forecast.','프랑스 배전망의 태양광 집계 추정값입니다. 에너지 값이 없는 기록 207개가 남아 있어요.':'Aggregated solar estimates for the French distribution network; 207 records retain missing energy values.','프랑스 국가 단위 태양광 추정값입니다. 연간 분석은 완료됐지만 결측과 자료 품질 경고가 남아 있어요.':'French national solar estimates. Annual analysis is complete, with missing values and quality warnings retained.','파리의 한 관측소에서 측정한 날씨 자료입니다. 태양광 발전량 자료는 아니에요.':'Weather observations at a Paris station, not solar generation data.',
'전력망 집계 추정값입니다. SDT의 클리핑·용량 변화 신호를 개별 인버터 고장으로 해석할 수 없습니다.':'Grid-aggregate estimates. SDT clipping and capacity-change signals cannot be interpreted as individual inverter faults.','Frictionless 통과는 저장소 웹 요약에 기록되어 있습니다. 동봉된 개별 감사는 자원 계약·변환·해시를 담고 있으며, 별도 SDT 보고서는 없습니다.':'The repository web summary records a Frictionless pass. The bundled resource audit records contract, transformations and hashes; no separate SDT report is included.',
'GB 전력망 태양광 추정':'GB grid solar estimates','30분 구간의 종료 시각. 2025년 발전 구간에 해당하며 마지막 종료 시각은 2026년 1월 1일.':'End timestamps of 30-minute intervals covering 2025 generation, ending on 1 January 2026.','GB 전력망 전국 집계 · GSP 0':'GB national grid aggregate · GSP 0','MW 입력 → kW 정규화':'MW input → kW normalisation','Brussels 태양광 기준 계산':'Brussels reference solar calculation','모델 기반 기준값':'Model-based reference','2020년 · UTC 시간별':'2020 · hourly UTC','요청 연도 2020, 8,784개 시간 구간. 미래 발전량 예측 결과가 아닌 과거 조건의 기준 계산.':'Requested year 2020, 8,784 hourly intervals. Historical reference calculations, not future generation forecasts.','Brussels 좌표 50.8503, 4.3517':'Brussels coordinates 50.8503, 4.3517','W 입력 → kW 정규화':'W input → kW normalisation','배전망 태양광 주입량 추정':'Estimated distribution-network solar injection','2024-01-01 00:00 ≤ 시각 < 2025-01-01 00:00 UTC':'2024-01-01 00:00 ≤ time < 2025-01-01 00:00 UTC','원천 CET/CEST 오프셋을 UTC로 변환한 30분 구간. 개별 공장 계측이 아닌 국가 배전망 집계.':'30-minute intervals with source CET/CEST offsets converted to UTC. National distribution aggregates, not factory measurements.','30분 Wh → 평균 W → kW':'30-minute Wh → average W → kW','프랑스 국가 태양광 발전 추정':'French national solar generation estimates','366일 수집 기록을 연속 UTC 30분 간격으로 정규화. 결측과 수정 상태를 보존한 국가 집계 자료.':'366 collection days normalised to continuous UTC 30-minute intervals, preserving missing values and revision states.','Paris-Montsouris 기상 관측':'Paris-Montsouris weather observations','관측값 · 기상':'Observed · weather','2024년 · 시간별':'2024 · hourly','감사에서 프랑스 본토 시간별 시각을 UTC로 해석. 발전량이나 SMT 라인 환경 센서값은 아님.':'The audit interprets mainland-France hourly timestamps as UTC. Not generation data or SMT environmental sensor measurements.','PARIS-MONTSOURIS · 관측소 75114001':'PARIS-MONTSOURIS · station 75114001','시간별 GLO J/cm² × 10000/3600 → 평균 W/m²':'Hourly GLO J/cm² × 10000/3600 → average W/m²'
})) englishCopy.set(ko,en);
patterns.push(
 [/^예측 확률과 실제 결과의 차이가 감소했습니다\. 단, (\d+)개 구간 중 표본이 존재한 구간은 (\d+)개입니다\.$/,(_,a,b)=>`Calibration error decreased. Only ${b} of ${a} bins contained observations.`],
 [/^상위 ([\d.]+%)$/,(_,a)=>`Top ${a}`],
 [/^([\d,]+)점 · 무점검 ([\d,]+)점 대비 ([\d,]+)점 감소$/,(_,a,b,c)=>`${a} cost units · ${c} below the no-review scenario (${b})`],
 [/^(\d+)구간 Walk-forward PR-AUC$/,(_,a)=>`${a}-period walk-forward PR-AUC`],
 [/^학습 CV에서 RF가 (\d+)개 repeat 중 (\d+)개에서 높았지만, 5% 기준 통계적 유의성은 확인되지 않았습니다\. 후기 평가의 RF 우위를 뜻하지 않습니다\. 25개 중첩 fold를 독립 표본으로 세지 않았습니다\.$/,(_,a,b)=>`RF scored higher in ${b} of ${a} training-CV repeats, without significance at 5%. This does not establish later-period superiority. The 25 overlapping folds were not treated as independent observations.`],
 [/^([\d.]+)% 부트스트랩 구간$/,(_,a)=>`${a}% bootstrap interval`],
 [/^상위 10% 불량 포착률은 (.*?)로 넓습니다\((.*?)회\)\. 희소 불량 표본이 작아 실제 현장 성능으로 확대 해석할 수 없습니다\.$/,(_,a,b)=>`Top-10% failure capture has a wide interval of ${a} (${b} bootstrap replicates). Few failures prevent extrapolation to field performance.`],
 [/^([\d,]+)건 · (\d+)변수$/,(_,a,b)=>`${a} records · ${b} features`],
 [/^(\d+)건 점검$/,(_,a)=>`${a} records reviewed`],[/^Fail (\d+)건 포착$/,(_,a)=>`${a} Fail records captured`],
 [/^([\d.]+)분 간격 · 원자료 전체가 아닌 저장된 감사 기준$/,(_,a)=>`${a}-minute intervals · based on the saved audit, not all raw data`],
 [/^자료를 읽을 때 주의할 점 · (\d+)개$/,(_,a)=>`Interpretation cautions · ${a}`],
 [/^정규화 전 ([\d,]+)행 → ([\d,]+)개 슬롯\. 누락 시각 (\d+)개, 남은 결측 전력 (\d+)개, SDT 전용 음수→0 변환 ([\d,]+)개\. kW 단위는 추정 상태입니다\.$/,(_,a,b,c,d,e)=>`${a} rows before normalisation → ${b} slots; ${c} missing timestamps, ${d} remaining missing power values, ${e} negative values clipped to zero for SDT only. kW remains inferred.`],
 [/^SDT (.*?)\. 집계·모델 기준 자료에서도 신호가 발생할 수 있습니다\.$/,(_,a)=>`SDT ${a}. Signals can also occur in aggregated or model-based reference data.`],
 [/^저장된 상태: (.*)$/,(_,a)=>`Saved status: ${a}`],[/^기록된 수집·분석 시점: (.*)$/,(_,a)=>`Recorded collection/analysis time: ${a}`],
 [/^감사와 (분석 보고서|웹 요약)의 행 수·SHA-256 선언:$/,(_,a)=>`Declared row counts and SHA-256 in the audit and ${a==='분석 보고서'?'analysis report':'web summary'}:`],
 [/^(.*?) 저장소 확인 · 자료 목록 갱신 (.*?)\. 자동 갱신·실 API 호출 없이 동일한 저장본을 표시합니다\.$/,(_,a,b)=>`Repository checked ${a} · catalog updated ${b}. The same saved snapshot is shown without automatic refresh or live API calls.`],
 [/^입력 가정: PVGIS-SARAH3, 설비 (.*?) kWp, 손실 (.*?)%\. 해당 좌표·과거 기상 조건의 기준 계산이며 실제 공장 발전량이나 미래 예측이 아닙니다\.$/,(_,a,b)=>`Assumptions: PVGIS-SARAH3, ${a} kWp system, ${b}% losses. Reference calculation for the coordinates and historical weather, not factory generation or a future forecast.`],
 [/^수집 감사의 품질 경고 있음: 에너지 결측 (.*?)개를 0으로 채우지 않고 보존했습니다\. SDT 자체의 품질 경고가 '(.*?)'이어도 이 수집 경고는 유지합니다\.$/,(_,a,b)=>`Collection quality warning retained: ${a} missing energy values were not filled with zero. This warning remains even if SDT's own quality warning is '${englishCopy.get(b)||b}'.`],
 [/^수집 (.*?)일 · 원본 (.*?)행\. 결측 전력 (.*?)개와 consolidated 상태 (.*?)개를 보존했습니다\. 국가 집계 추정값의 SDT 신호를 개별 설비 고장으로 해석하지 않습니다\.$/,(_,a,b,c,d)=>`${a} collection days · ${b} source rows. ${c} missing power values and ${d} consolidated states retained. SDT signals in national aggregates do not identify individual equipment faults.`]
);
englishCopy.set('결과에서 검토 요청까지의 증거 흐름','Evidence flow from result to review request');
englishCopy.set('분석 자료 선택','Select an evidence source');

englishCopy.set('저장된 생산 기록','Saved production records');
englishCopy.set('현재 표시','Currently shown');
patterns.push([/^저장 목록 전체 (\d+)건$/,(_,n)=>`${n} records in the saved list`]);
// Optional learning is a separate synthetic exercise, not a safety assessment.
englishCopy.set('선택형 학습 / Optional learning', 'Optional learning');
englishCopy.set('선택형 학습 · 근거부터 확인하기 / Optional learning →', 'Optional learning · Review the evidence first →');
englishCopy.set('합성 사례 3개로 정상·이상, 데이터 품질, 상관과 인과를 살펴봐요. 실제 안전 판정·운영 지시·능력 평가가 아닙니다. Synthetic practice, not safety advice or ability assessment.', 'Explore normal and anomalous records, data quality, correlation and causation in three synthetic cases. Not real safety decisions, operating instructions or an assessment of your ability.');
