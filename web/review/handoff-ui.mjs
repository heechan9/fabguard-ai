import {ITEMS,emptyChecklist,buildPacket,parsePacket,HANDOFF_URL} from './handoff-model.mjs';
import {serializeDocument} from './model.mjs';
import {summarizeHandoff} from './handoff-summary.mjs';
const copy={ko:{title:'추가 확인·기술 인계',lead:'같은 SECOM 사례에서 추가로 필요한 근거를 정리합니다. 항목의 상태·역할·위치는 사용자 선언이며 실제 자료 확인이나 담당자 배정을 인증하지 않습니다.',items:['익명 변수의 실제 측정·공정 매핑','LOT·장비·Recipe 등 공정 맥락','시간대·라벨 확정 시점','단위·교정·누락 등 측정 품질','정비·조건 변경 이력'],states:['미확인','근거 요청 필요','근거 위치 기록 (미검증)'],roles:['요청 역할 미정','공정 담당에게 질문','설비 담당에게 질문','검사·품질 담당에게 질문','데이터 담당에게 질문'],state:'근거 상태',role:'확인 요청 역할 (배정 아님)',note:'근거 위치·부족 사유 (최대 500자)',summary:'읽기용 검토 요약 TXT 내려받기',summarized:'TXT 요약 다운로드를 요청했습니다. 전체 이력 보존에는 JSON도 저장하세요.',export:'인계 패킷 JSON 내려받기',import:'같은 사례 인계 패킷 열기 (최대 1 MiB)',link:'고정 버전 영문 기술 인계서 열기',boundary:'체크리스트 현재 입력과 이미 기록한 메모 이력만 묶습니다. 기록하지 않은 기존 메모 입력은 포함하지 않습니다. 모든 항목의 위치를 적어도 현장 검증·원인 확정·승인·실제 조치 완료가 아닙니다. 서버 전송·자동 저장이 없고 새로고침하면 체크리스트도 사라집니다. 비공개 자료나 개인정보는 입력하지 마세요.',ready:'항상 미검증 · 자기기재 인계 자료',error:'인계 처리 보류: ',exported:'다운로드를 요청했습니다. 실제 파일을 확인하세요.',imported:'같은 근거·사례의 패킷을 불러왔습니다. 근거의 진실성·권한은 인증하지 않습니다.',dirty:'현재 체크리스트 입력을 먼저 내보내거나 페이지를 다시 열어 주세요.',draft:'기존 메모 입력을 먼저 새 버전으로 기록하세요. 기록 전 입력은 패킷에 포함되지 않습니다.'},en:{title:'Additional evidence and technical handoff',lead:'List evidence still needed for this same SECOM case. Status, role and location are self-declared, not verified evidence or an assigned owner.',items:['Physical measurement/process mapping of anonymous features','Process context: LOT, equipment and recipe','Timezone and label finalisation time','Measurement quality: units, calibration and gaps','Maintenance and condition-change history'],states:['Unknown','Evidence request needed','Evidence location recorded (unverified)'],roles:['Requested role unknown','Ask process engineering','Ask equipment engineering','Ask test/quality engineering','Ask data owner'],state:'Evidence status',role:'Requested role (not an assignment)',note:'Evidence location or missing-information reason (maximum 500 characters)',summary:'Download readable review summary TXT',summarized:'TXT summary requested. Also save JSON to preserve the full history.',export:'Download handoff packet JSON',import:'Open handoff packet for this same case (maximum 1 MiB)',link:'Open pinned English technical handoff',boundary:'Includes current checklist inputs and recorded note history only, excluding unrecorded review-form inputs. Even all locations recorded does not mean field validation, causal confirmation, approval or completed action. No server upload or autosave; reload loses the checklist. Do not enter private data or personal information.',ready:'Always unvalidated · self-declared handoff',error:'Handoff withheld: ',exported:'Download requested. Check the actual file.',imported:'Packet for the same evidence and case loaded. Truthfulness and authority are not authenticated.',dirty:'Export the current checklist or reopen the page before importing.',draft:'Append existing review-form inputs as a revision first. Unrecorded inputs are excluded from the packet.'}};
// Keep the outcome separate from its rendered language. Known validation reasons
// are translated without changing validators or interpreting imported text as HTML.
const errorKo={
 'File exceeds 1 MiB':'파일이 1 MiB를 초과합니다.',
 'JSON exceeds 1 MiB':'JSON이 1 MiB를 초과합니다.',
 'Exported JSON would exceed 1 MiB':'내보낼 JSON이 1 MiB를 초과합니다.',
 'Unterminated JSON string':'JSON 문자열이 끝나지 않았습니다.',
 'JSON nesting too deep':'JSON 중첩이 너무 깊습니다.',
 'Expected JSON key':'JSON 항목 이름이 필요합니다.',
 'Duplicate JSON key':'중복된 JSON 항목 이름이 있습니다.',
 'Expected colon':'JSON 항목 이름 뒤에 콜론이 필요합니다.',
 'Expected object delimiter':'JSON 객체 구분자가 올바르지 않습니다.',
 'Expected array delimiter':'JSON 배열 구분자가 올바르지 않습니다.',
 'Too many array items':'JSON 배열 항목이 너무 많습니다.',
 'Invalid JSON value':'JSON 값이 올바르지 않습니다.',
 'Nonfinite JSON number':'JSON 숫자가 유한하지 않습니다.',
 'Trailing JSON data':'JSON 뒤에 불필요한 데이터가 있습니다.',
 'Unexpected handoff fields':'인계 패킷 항목이 누락되었거나 예상과 다릅니다.',
 'Incomplete checklist':'체크리스트 항목이 완전하지 않습니다.',
 'Checklist identity/order mismatch':'체크리스트 항목 또는 순서가 다릅니다.',
 'Unsupported checklist state':'지원하지 않는 체크리스트 상태입니다.',
 'Unsupported requested role':'지원하지 않는 요청 역할입니다.',
 'Invalid checklist note':'체크리스트 메모가 올바르지 않습니다.',
 'Declared evidence requires a location or explanation':'근거 위치 기록에는 위치나 설명이 필요합니다.',
 'Invalid preparation time':'준비 시각이 올바르지 않습니다.',
 'Invalid/future preparation time':'준비 시각이 올바르지 않거나 미래 시각입니다.',
 'Unsupported handoff or authority claim':'지원하지 않는 인계 형식 또는 권한 주장입니다.',
 'Unresolved checklist mismatch':'미확인 체크리스트 항목이 일치하지 않습니다.',
 'Expected a plain object':'일반 JSON 객체가 필요합니다.',
 'Unexpected or missing fields':'항목이 누락되었거나 예상과 다릅니다.',
 'Use canonical UTC ISO time with milliseconds':'밀리초를 포함한 표준 UTC ISO 시각이 필요합니다.',
 'Invalid calendar time':'달력 시각이 올바르지 않습니다.',
 'Missing, oversized or invalid text':'텍스트가 누락되었거나 너무 길거나 올바르지 않습니다.',
 'Load and verify bundled source first':'포함된 근거를 먼저 불러와 검증해야 합니다.',
 'Unknown sample ID':'알 수 없는 사례 ID입니다.',
 'Unsupported review version':'지원하지 않는 검토 버전입니다.',
 'Review evidence mismatch':'검토 근거 또는 사례가 일치하지 않습니다.',
 'Invalid revision history':'메모 이력이 올바르지 않습니다.',
 'Revision order mismatch':'메모 버전 순서가 일치하지 않습니다.',
 'Review time ordering/future time violation':'검토 시각 순서가 올바르지 않거나 미래 시각입니다.',
 'Unsupported outcome':'지원하지 않는 검토 결과입니다.',
 'Unsupported proposed action':'지원하지 않는 제안 조치입니다.',
 'Insufficient evidence cannot clear a hold':'근거 부족 상태에서는 보류를 해제할 수 없습니다.',
 'Import would truncate local history':'가져오면 현재 메모 이력이 줄어듭니다.',
 'Import would replace local history':'가져오면 현재 메모 이력이 바뀝니다.'
};
const formatError=(error,language)=>{
 if(error.handoffKey)return copy[language][error.handoffKey];
 if(error instanceof SyntaxError)return language==='ko'?'JSON 문법이 올바르지 않습니다.':'Invalid JSON syntax.';
 return (language==='ko'&&Object.hasOwn(errorKo,error.message))?errorKo[error.message]:error.message;
};
const guardError=key=>Object.assign(new Error(key),{handoffKey:key});
copy.ko.encoding='파일이 올바른 UTF-8 텍스트가 아닙니다.';
copy.en.encoding='File is not valid UTF-8 text.';
export function mountHandoff({getState,acceptReview,markDirty}){
 const host=document.querySelector('#handoff-host');if(!host)return;
 let rows=emptyChecklist(),dirty=false,operation=0,statusState={key:'ready',error:null};const controls=[];
 const lang=()=>getState().language;const t=()=>copy[lang()];
 function renderStatus(){status.textContent=t()[statusState.key]+(statusState.error?formatError(statusState.error,lang()):'');}
 function setStatus(key,error=null){statusState={key,error};renderStatus();}
 const title=document.createElement('h2'),lead=document.createElement('p'),boundary=document.createElement('p'),list=document.createElement('div'),out=document.createElement('button'),summary=document.createElement('button'),label=document.createElement('label'),file=document.createElement('input'),link=document.createElement('a'),status=document.createElement('p');
 title.id='handoff-title';host.setAttribute('aria-labelledby',title.id);file.type='file';file.accept='.json,application/json';file.id='import-handoff';label.htmlFor=file.id;out.type='button';out.id='export-handoff';summary.type='button';summary.id='export-handoff-summary';link.href=HANDOFF_URL;link.target='_blank';link.rel='noopener';status.id='handoff-status';status.setAttribute('role','status');host.append(title,lead,boundary,list,out,summary,label,file,link,status);
 for(const [i,id] of ITEMS.entries()){
  const group=document.createElement('fieldset'),legend=document.createElement('legend'),slabel=document.createElement('label'),select=document.createElement('select'),rlabel=document.createElement('label'),role=document.createElement('select'),nlabel=document.createElement('label'),note=document.createElement('textarea');
  select.id=`handoff-${id}`;slabel.htmlFor=select.id;role.id=`handoff-role-${id}`;rlabel.htmlFor=role.id;note.id=`handoff-note-${id}`;nlabel.htmlFor=note.id;note.maxLength=500;note.rows=2;
  for(const v of ['unknown','requested','declared_present'])select.add(new Option('',v));for(const v of ['unknown','process','equipment','test_quality','data'])role.add(new Option('',v));
  const update=()=>{rows[i]={id,state:select.value,requested_role:role.value,note:note.value};dirty=true;++operation;markDirty(true);setStatus('ready');};select.addEventListener('change',update);role.addEventListener('change',update);note.addEventListener('input',update);group.append(legend,slabel,select,rlabel,role,nlabel,note);list.append(group);controls.push({legend,slabel,select,rlabel,role,nlabel,note});
 }
 function translate(){const c=t();title.textContent=c.title;lead.textContent=c.lead;boundary.textContent=c.boundary;out.textContent=c.export;summary.textContent=c.summary;label.textContent=c.import;link.textContent=c.link;renderStatus();controls.forEach((x,i)=>{x.legend.textContent=c.items[i];x.slabel.textContent=c.state;x.rlabel.textContent=c.role;x.nlabel.textContent=c.note;[...x.select.options].forEach((o,j)=>o.textContent=c.states[j]);[...x.role.options].forEach((o,j)=>o.textContent=c.roles[j]);});}
 document.addEventListener('fabguard-review-language',translate);translate();
 out.addEventListener('click',()=>{try{const state=getState();if(state.draftDirty)throw guardError('draft');const packet=buildPacket(state.current,rows,state.source,state.sampleId);const url=URL.createObjectURL(new Blob([serializeDocument(packet)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`fabguard-${state.sampleId}-handoff.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);dirty=false;++operation;markDirty(false);setStatus('exported');}catch(e){setStatus('error',e);}});
 summary.addEventListener('click',()=>{try{const state=getState();if(state.draftDirty)throw guardError('draft');const packet=buildPacket(state.current,rows,state.source,state.sampleId);const text=summarizeHandoff(packet,state.source,state.sampleId,{language:lang()});const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`fabguard-${state.sampleId}-review-summary.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);++operation;setStatus('summarized');}catch(e){setStatus('error',e);}});
 file.addEventListener('change',async()=>{const f=file.files?.[0],token=++operation;file.value='';if(!f)return;try{if(dirty)throw guardError('dirty');if(f.size>1048576)throw Error('File exceeds 1 MiB');const bytes=await f.arrayBuffer();let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw guardError('encoding');}if(token!==operation||dirty)return;const state=getState();if(state.draftDirty)throw guardError('draft');const packet=parsePacket(text,state.source,state.sampleId,{current:state.current});acceptReview(packet.review);rows=packet.checklist;controls.forEach((x,i)=>{x.select.value=rows[i].state;x.role.value=rows[i].requested_role;x.note.value=rows[i].note;});dirty=false;markDirty(false);setStatus('imported');}catch(e){if(token===operation)setStatus('error',e);}});
}
