import {lessons} from './content.mjs';
import {pick,suggestedOrder,blankRecord,saveRecords,loadRecords,clearRecords,mergeRecords} from './core.mjs';
export function mountLearning(root, initialLanguage='ko') {
const $=id=>root.getElementById(id);
let lang=initialLanguage==='en'?'en':'ko';
let screen='probe',answers={},order=lessons.map(x=>x.id),current=0,records=[];
let exercise={choice:null,reason:null,hint:0,revealed:false,transfer:null,transferRevealed:false};
const t=(ko,en)=>lang==='en'?en:ko;
const p=value=>pick(value,lang);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label)=>`<button type="button" data-action="${action}">${escape(label)}</button>`;
function radios(name,options,value){return options.map((option,i)=>`<label><input type="radio" name="${name}" value="${i}" ${value===i?'checked':''}> <span>${escape(p(option))}</span></label>`).join('');}
function heading(value){return `<h2 id="stage-title" tabindex="-1">${escape(value)}</h2>`;}
function renderShell(){
 root.host.lang=lang;
 $('language').textContent=t('English','한국어');
 $('language').setAttribute('aria-label',t('Switch to English','한국어로 전환'));
 $('learning-dialog').setAttribute('aria-label',t('FabGuard 선택형 근거 학습','FabGuard optional evidence learning'));
 $('exit').textContent=t('← FabGuard · 닫기','← FabGuard · Close');
 $('skip-learning').textContent=t('본문으로 건너뛰기','Skip to main content');
 $('intro').innerHTML=`<p class="eyebrow">OPTIONAL · SYNTHETIC · NO AI CONNECTION</p><h1>${t('알람보다 먼저, 근거를 확인해요','Check the evidence before the alarm')}</h1><p>${t('3개 질문으로 시작할 곳을 고르고, 합성 사례에서 예측·이유·해설을 비교합니다. 기본 데모는 그대로이며 언제든 나갈 수 있어요.','Choose a starting point with three questions, then compare a prediction, reason and explanation in synthetic examples. The default demo stays unchanged; leave at any time.')}</p><p class="boundary">${t('실제 공정 안전조치나 운영 결정을 연습 점수로 다루지 않습니다. 자동 성적·능력 평가가 아니며, 새 모델 학습·추론·실제 자료 분석은 하지 않습니다.','No scores for real safety or operational decisions. This is not grading or ability assessment. No model training, inference or real-data analysis is performed.')}</p>`;
 $('record-title').textContent=t('이번 세션의 개념·근거 연결','Concept–evidence links in this session');
 $('privacy').textContent=t('기본은 이 탭의 임시 기록입니다. 개념·합성 근거·오개념 주제·출처·직접 확인 여부만 보관하며 답변 이력, 개인정보, 자유서술 사고과정은 수집하지 않습니다. 오개념은 사례의 주제이며 사용자에 대한 판정이 아닙니다. “이 기기에 저장”을 누를 때만 현재 기록을 저장합니다. 이후 변경은 다시 눌러야 저장됩니다. 공용 기기에서는 저장하지 마세요.','Records are temporary in this tab by default. Only concept, synthetic evidence, misconception topic, source and your confirmation are kept. No answer history, personal information or free-text reasoning is collected. Misconceptions are case topics, not diagnoses of the user. “Save on this device” saves one snapshot only; later changes need another save. Do not save on a shared device.');
 $('save').textContent=t('이 기기에 저장','Save on this device');$('load').textContent=t('저장 기록 불러오기','Load saved records');$('reset').textContent=t('전체 초기화','Reset everything');
 $('sources-title').textContent=t('원칙의 출처와 적용 한계','Principle sources and boundaries');
 $('sources-copy').textContent=t('LearnHarness의 진단·최소 개념 지도·예측 후 해설·단계별 힌트라는 원칙을 참고한 독립 구현입니다. AGPL-3.0 코드를 복사하거나 의존성으로 가져오지 않았습니다.','An independent implementation inspired by LearnHarness principles: probes, a minimal concept map, prediction before explanation and staged hints. No AGPL-3.0 code was copied or added as a dependency.');
 $('source-boundary').textContent=t('사례와 전이 문제는 모두 이 체험을 위해 만든 합성 예시입니다. 링크는 일반 원칙의 출처이지 사례 수치나 학습효과의 검증 근거가 아닙니다. 저장 기록은 검증된 전문지식이 아닙니다. 외부 링크는 직접 눌렀을 때만 열리며 이 페이지에는 외부 AI·분석·텔레메트리가 없습니다.','All cases and transfer questions are synthetic examples created for this exercise. Sources explain general principles; they do not validate these numbers or learning effects. Saved records are not verified expertise. External links open only when clicked. This page has no external AI, analytics or telemetry.');
 $('reset-title').textContent=t('임시·저장 기록을 초기화할까요?','Reset temporary and saved records?');
 $('reset-copy').textContent=t('이 학습 체험의 기록만 지우고 첫 질문으로 돌아갑니다. FabGuard의 다른 기록은 바꾸지 않습니다.','Clear this learning exercise only and return to the first questions. Other FabGuard records are unchanged.');
 $('cancel-reset').textContent=t('취소','Cancel');$('confirm-reset').textContent=t('초기화','Reset');
}
function renderRecords(){
 $('records').innerHTML=records.length?records.map(row=>{const l=lessons.find(x=>x.id===row.concept);return `<div class="record"><b>${escape(p(l.title))}</b><p>${t('근거','Evidence')}: ${escape(p(l.observation))}<br>${t('경계할 오개념','Misconception to examine')}: ${escape(p(l.misconception))}<br><a href="${l.sourceUrl}" rel="noreferrer">${t('FabGuard 고정 버전의 공개 설명·한계','FabGuard public explanation and limits at a fixed revision')}</a> · ${row.checked?t('직접 확인함 (자기 표시)','Self-marked as checked'):t('직접 확인 전','Not yet self-checked')}</p></div>`;}).join(''):`<p class="muted">${t('아직 기록이 없어요. 해설을 열면 개념 연결이 생깁니다.','No records yet. Opening an explanation creates a concept link.')}</p>`;
}
function renderStage(focus=true){
 const l=lessons.find(x=>x.id===order[current]);
 if(screen==='probe'){
  $('stage').innerHTML=heading(t('01 · 어디서 시작할까요?','01 · Where shall we start?'))+`<p>${t('맞힌 개수를 세지 않습니다. 선택은 이번 세션의 시작 순서에만 쓰며 저장하지 않습니다. 모르면 건너뛰어도 됩니다.','There is no score. Choices only suggest a starting order for this session and are not saved. Skip if you prefer.')}</p>`+lessons.map((item,i)=>`<fieldset><legend>${i+1}. ${escape(p(item.probe))}</legend>${radios('probe-'+item.id,item.probeOptions,answers[item.id])}</fieldset>`).join('')+`<div class="actions">${button('map',t('개념 지도 보기','View concept map'))}${button('skip-probe',t('질문 건너뛰기','Skip questions'))}</div>`;
 }else if(screen==='map'){
  $('stage').innerHTML=heading(t('02 · 최소 선행개념 지도','02 · Minimal prerequisite map'))+`<p>${t('확인할 만한 개념을 먼저 배치했습니다. 능력 등급이 아니며 순서는 직접 선택할 수 있어요. 각 항목은 관측 → 해석의 한계 → 다음 확인으로 연결됩니다.','Concepts worth revisiting come first. This is not an ability level; choose any order. Each path connects observation → interpretation limits → next check.')}</p><ol class="map">${order.map((id,i)=>{const item=lessons.find(x=>x.id===id);return `<li><b>${escape(p(item.title))}</b><br>${escape(p(item.prerequisite))}${button('lesson-'+i,t('이 사례 시작','Start this case'))}</li>`;}).join('')}</ol>`;
 }else{
  $('stage').innerHTML=heading(`${t('03 · 합성 사례','03 · Synthetic case')} ${current+1} / 3: ${p(l.title)}`)+`<article class="lesson"><p>${escape(p(l.scene))}</p><fieldset><legend>${escape(p(l.question))}</legend>${radios('choice',l.options,exercise.choice)}</fieldset><fieldset><legend>${t('그 이유는 무엇인가요?','Why?')}</legend>${radios('reason',l.reasons,exercise.reason)}</fieldset><div class="actions">${button('check',t('예측·이유 비교하기','Compare prediction and reason'))}${button('hint',t('작은 힌트','Small hint'))}${button('reveal',t('해설 바로 보기','Show explanation now'))}${button('skip-case',t('이 사례 건너뛰기','Skip this case'))}${button('back-map',t('개념 지도로','Back to concept map'))}</div><p id="exercise-status" role="status"></p><div id="hints">${l.hints.slice(0,exercise.hint).map((hint,i)=>`<p>${t('힌트','Hint')} ${i+1}: ${escape(p(hint))}</p>`).join('')}</div>${exercise.revealed?explanation(l):''}</article>`;
 }
 renderRecords();if(focus)$('stage-title').focus();
}
function explanation(l){
 const compared=exercise.choice!==null&&exercise.reason!==null;
 return `<section class="feedback" aria-labelledby="explanation-title"><h3 id="explanation-title" tabindex="-1">${t('관측·한계·다음 확인','Observation, limits, next check')}</h3>${compared?`<p>${exercise.choice===l.correct&&exercise.reason===l.correct?t('선택과 이유가 이 사례의 근거에 맞습니다. 아래 한계도 함께 확인하세요.','Your choice and reason match this case’s evidence. Check the limits below too.'):t('선택한 항목 또는 이유를 아래 근거와 다시 비교해 보세요. 능력 평가는 하지 않습니다.','Compare your selected item or reason with the evidence below. This is not an ability assessment.')}</p>`:''}<p><b>${t('관측','Observation')}</b>: ${escape(p(l.observation))}</p><p><b>${t('한계','Limits')}</b>: ${escape(p(l.limit))}</p><p><b>${t('다음 확인','Next check')}</b>: ${escape(p(l.next))}</p><p><a href="${l.link}">${t('기존 공개 설명·한계와 연결','Connect to the existing public explanation and limits')}</a> · <a href="${l.sourceUrl}" rel="noreferrer">${t('고정 버전 근거','Fixed-revision source')}</a></p><fieldset><legend>${escape(p(l.transfer))}</legend>${radios('transfer',l.transferOptions,exercise.transfer)}</fieldset>${button('transfer',t('새 사례 해설 확인','Check the new case explanation'))}${exercise.transferRevealed?`<div id="transfer-explanation" tabindex="-1">${exercise.transfer!==null?`<p>${exercise.transfer===l.transferCorrect?t('새 사례에서도 관측과 한계를 구분했습니다.','You distinguished observation from limits in the new case.'):t('선택한 설명을 아래 근거와 비교해 보세요.','Compare your selected explanation with the evidence below.')}</p>`:''}<p>${escape(p(l.transferOptions[l.transferCorrect]))}. ${escape(p(l.limit))}</p><p>${t('설명을 비교했는지 직접 표시할 수 있어요. 전문성 인증이나 학습효과 증거가 아닙니다.','You may mark that you checked the explanation. This is not certification or evidence of learning effectiveness.')}</p>${button('confirm',t('근거와 한계를 직접 확인했어요','I checked the evidence and limits'))}</div>`:''}</section>`;
}
function openLesson(index){current=index;screen='lesson';exercise={choice:null,reason:null,hint:0,revealed:false,transfer:null,transferRevealed:false};renderStage();}
function reveal(){
 const l=lessons.find(x=>x.id===order[current]);exercise.revealed=true;
 if(!records.some(x=>x.concept===l.id))records.push(blankRecord(l));
 renderStage(false);$('explanation-title').focus();
}
$('stage').addEventListener('change',e=>{
 const {name,value}=e.target;if(!name)return;
 if(name.startsWith('probe-'))answers[name.slice(6)]=Number(value);
 else if(['choice','reason','transfer'].includes(name)){exercise[name]=Number(value);if(exercise.revealed){renderStage(false);root.querySelector(`input[name="${name}"][value="${value}"]`)?.focus();}}
});
$('stage').addEventListener('click',e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
 if(action==='map'||action==='skip-probe'){if(action==='skip-probe')answers={};order=suggestedOrder(answers);answers={};screen='map';renderStage();}
 else if(action.startsWith('lesson-'))openLesson(Number(action.slice(7)));
 else if(action==='back-map'){screen='map';renderStage();}
 else if(action==='skip-case'){if(current<2)openLesson(current+1);else{screen='map';renderStage();}}
 else if(action==='hint'){exercise.hint=Math.min(2,exercise.hint+1);renderStage(false);$('exercise-status').textContent=t(`힌트 ${exercise.hint}개를 열었습니다.`,`Opened ${exercise.hint} hint(s).`);root.querySelector('[data-action="hint"]').focus();}
 else if(action==='reveal')reveal();
 else if(action==='check'){
  if(exercise.choice===null||exercise.reason===null){$('exercise-status').textContent=t('점검 항목과 이유를 각각 선택하거나 해설 바로 보기를 누르세요.','Choose an item and a reason, or use Show explanation now.');root.querySelector(`input[name="${exercise.choice===null?'choice':'reason'}"]`).focus();}else reveal();
 }else if(action==='transfer'){exercise.transferRevealed=true;renderStage(false);$('transfer-explanation').focus();}
 else if(action==='confirm'){
  let row=records.find(x=>x.concept===order[current]);if(!row){row=blankRecord(lessons.find(x=>x.id===order[current]));records.push(row);}row.checked=true;renderRecords();$('exercise-status').textContent=t('직접 확인 표시를 추가했습니다. 이 기기 저장은 별도 선택입니다.','Added your self-check mark. Saving on this device is a separate choice.');
 }
});
$('language').addEventListener('click',()=>{lang=lang==='ko'?'en':'ko';renderShell();renderStage(false);$('language').focus();$('storage-status').textContent='';});
$('save').addEventListener('click',()=>{try{saveRecords(localStorage,records);$('storage-status').textContent=t('현재 개념 연결만 이 기기에 저장했습니다. 이후 변경은 자동 저장되지 않습니다.','Saved the current concept links on this device. Later changes are not saved automatically.');}catch{$('storage-status').textContent=t('이 기기에 저장하지 못했습니다. 현재 탭의 임시 기록은 유지됩니다.','Could not save on this device. Temporary records remain in this tab.');}});
 $('load').addEventListener('click',()=>{try{const restored=loadRecords(localStorage);records=mergeRecords(records,restored);renderRecords();$('storage-status').textContent=restored.length?t('저장된 연결을 현재 기록과 합쳤습니다. 현재의 직접 확인 표시는 유지하며 자동 저장하지 않습니다. 질문 답변이나 진행 상태는 저장되지 않습니다.','Merged saved links with this session. Current self-check marks are preserved; nothing is auto-saved. Answers and exercise progress are not stored.'):t('저장된 개념 연결이 없습니다. 현재 임시 기록은 유지했습니다.','No saved concept links. Current temporary records were preserved.');}catch{$('storage-status').textContent=t('저장 기록을 읽을 수 없거나 형식이 맞지 않습니다. 임시 기록은 그대로입니다.','Saved records are unavailable or invalid. Temporary records are unchanged.');}});
$('reset').addEventListener('click',()=>$('reset-dialog').showModal());
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('reset-dialog').addEventListener('close',()=>$('reset').focus());
$('confirm-reset').addEventListener('click',()=>{
 let cleared=true;try{clearRecords(localStorage);}catch{cleared=false;}
 records=[];answers={};screen='probe';order=lessons.map(x=>x.id);current=0;
 $('reset-dialog').close();renderStage(false);$('storage-status').textContent=cleared?t('이 학습 체험의 임시·저장 기록을 초기화했습니다.','Cleared temporary and saved records for this learning exercise.'):t('임시 기록은 초기화했지만 기기 저장 기록은 지우지 못했습니다. 브라우저 저장소 설정을 확인하세요.','Temporary records were reset, but saved device records could not be removed. Check browser storage settings.');
});
renderShell();renderStage(false);

}
