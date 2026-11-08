// Plain-text view of the existing verified packet. No new decision or schema.
import {parsePacket} from './handoff-model.mjs';
import {serializeDocument} from './model.mjs';

const copy={
 ko:{title:'FabGuard 사례 검토 요약',boundary:'자기기재·미인증·미검증 자료. 원인 확정, 현장 승인, 조치 수행 또는 효과 확인이 아닙니다.',
  saved:'고정된 공개 저장값',sample:'사례',rank:'저장 순위',score:'저장 점수',prediction:'저장 0.5 임계값 예측',label:'사후 라벨',time:'측정 시각 (원본 문자열·시간대 미확정)',
  scoreBoundary:'점수는 보정된 불량 확률이 아니며, 사후 라벨은 예측 때 알고 있던 값이라는 뜻이 아닙니다.',
  note:'사용자 최신 기록 (미검증)',noNote:'기록된 메모 없음',revision:'기록 버전',reviewer:'역할 선언 (권한 인증 아님)',reviewed:'선언한 검토 시각',recorded:'기록 시각',
  rationale:'해석·판단 근거 (사용자 기재)',available:'있다고 적은 근거',missing:'부족하다고 적은 근거',action:'다음 행동 제안 (실행 아님)',outcome:'검토 상태 선언',
  checklist:'추가 확인 요청 (담당자 배정 아님)',unresolved:'근거 위치가 기록되지 않은 항목 수',prepared:'패킷 작성 시각',
  history:'이 요약은 최신 메모만 표시합니다. 전체 이력·원형 보존에는 JSON 인계 패킷을 저장하세요.',
  items:['측정/공정 매핑','LOT·장비·Recipe 맥락','시각·라벨 확정 시점','측정 품질','변경 이력'],
  states:{unknown:'미확인',requested:'근거 요청 필요',declared_present:'근거 위치 기록 (미검증)'},
  roles:{unknown:'역할 미정',process:'공정 담당에게 질문',equipment:'설비 담당에게 질문',test_quality:'검사·품질 담당에게 질문',data:'데이터 담당에게 질문'},
  actions:{hold:'보류 제안',request_evidence:'추가 근거 요청 제안',reinspect:'재검사 제안',reference_only:'참고만 제안'},
  outcomes:{insufficient_evidence:'근거 부족 기록',documented_observation:'관측 내용 기록'}},
 en:{title:'FabGuard case review summary',boundary:'Self-declared, unauthenticated and unvalidated. Not causal confirmation, field approval, completed action or verified effect.',
  saved:'Pinned public saved evidence',sample:'Case',rank:'Saved rank',score:'Saved score',prediction:'Saved prediction at the 0.5 threshold',label:'Retrospective label',time:'Measurement time (original string; timezone unverified)',
  scoreBoundary:'The score is not a calibrated failure probability. A retrospective label does not imply it was known at prediction time.',
  note:'Latest user record (unverified)',noNote:'No recorded review note',revision:'Revision',reviewer:'Declared role (not authenticated authority)',reviewed:'Declared review time',recorded:'Record time',
  rationale:'Interpretation/rationale (user-entered)',available:'Declared available evidence',missing:'Declared missing evidence',action:'Proposed next action (not executed)',outcome:'Declared review state',
  checklist:'Further evidence requests (not owner assignments)',unresolved:'Items without a recorded evidence location',prepared:'Packet preparation time',
  history:'This summary shows only the latest note. Save the JSON handoff packet to preserve all revisions and original structure.',
  items:['Measurement/process mapping','LOT/equipment/recipe context','Time and label finalisation','Measurement quality','Change history'],
  states:{unknown:'Unknown',requested:'Evidence request needed',declared_present:'Evidence location recorded (unverified)'},
  roles:{unknown:'Role unknown',process:'Ask process engineering',equipment:'Ask equipment engineering',test_quality:'Ask test/quality engineering',data:'Ask data owner'},
  actions:{hold:'Propose hold',request_evidence:'Propose evidence request',reinspect:'Propose reinspection',reference_only:'Propose reference only'},
  outcomes:{insufficient_evidence:'Insufficient evidence recorded',documented_observation:'Observation recorded'}}
};

export function summarizeHandoff(packet,source,sampleId,{language='ko',now=new Date().toISOString()}={}){
 if(!Object.hasOwn(copy,language))throw Error('Unsupported summary language');
 const p=parsePacket(serializeDocument(packet),source,sampleId,{now}),c=copy[language],s=p.review.source;
 const quoted=value=>JSON.stringify(value); // Newlines in user text cannot impersonate report sections.
 const lines=[c.title,c.boundary,'',`[${c.saved}]`,`${c.sample}: ${s.sample_id}`,`${c.rank}: ${s.rank}`,`${c.score}: ${s.risk_score}`,`${c.prediction}: ${s.prediction}`,`${c.label}: ${s.retrospective_label}`,`${c.time}: ${s.measurement_timestamp}`,c.scoreBoundary,`source_repo_sha: ${s.source_repo_sha}`,`priority_table_sha256: ${s.priority_table_sha256}`,'',`[${c.note}]`];
 const latest=p.review.history.at(-1);
 if(!latest)lines.push(c.noNote);
 else lines.push(`${c.revision}: ${latest.revision} / ${p.review.history.length}`,`${c.reviewer}: ${quoted(latest.reviewer_role)}`,`${c.reviewed}: ${latest.reviewed_at}`,`${c.recorded}: ${latest.recorded_at}`,`${c.outcome}: ${c.outcomes[latest.outcome]}`,`${c.rationale}: ${quoted(latest.rationale)}`,`${c.available}: ${quoted(latest.available_evidence)}`,`${c.missing}: ${quoted(latest.missing_evidence)}`,`${c.action}: ${c.actions[latest.proposed_action]}`);
 lines.push('',`[${c.checklist}]`);
 p.checklist.forEach((row,i)=>lines.push(`${c.items[i]}: ${c.states[row.state]} | ${c.roles[row.requested_role]} | ${quoted(row.note)}`));
 lines.push(`${c.unresolved}: ${p.unresolved.length}`,`${c.prepared}: ${p.prepared_at}`,'',c.history,c.boundary);
 return lines.join('\n')+'\n';
}
