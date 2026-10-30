// Presentation only: frozen train summaries, never raw rows or fitted transformations.
import {csvRows} from '../smt/evidence-model.mjs';
export const FEATURES = Object.freeze(['feature_059','feature_247','feature_519','feature_065','feature_475']);
export const EVIDENCE_REVISION = '86dc09f703fa83f76dc3bf36bc2665023898c24a';
export const ASSET_ROOT = '/data/session5-20261030/';
export const sourceLink = file => `https://github.com/heechan9/fabguard-ai/blob/${EVIDENCE_REVISION}/docs/${file}`;
export const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function signed(value) { return typeof value === 'number' && Number.isFinite(value) ? `${value>0?'+':''}${value.toFixed(6)}` : '계산 불가'; }
const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : '계산 불가';
const count = group => `${group.n_observed} / ${group.n_total}`;
const missing = group => `${group.n_missing} (${(group.missing_rate*100).toFixed(2)}%)`;
function checkGroup(group) {
  if(!group || !['n_total','n_observed','n_missing'].every(k=>Number.isInteger(group[k])&&group[k]>=0) || group.n_observed+group.n_missing!==group.n_total || !Number.isFinite(group.missing_rate) || group.missing_rate<0 || group.missing_rate>1) throw new Error('관측 분모 불일치');
}
export function distributionData(summary, monthlyText, sensitivity) {
  if(summary.scope!=='reused_training_data_descriptive_only' || summary.model_fit!==false || summary.test_statistics_computed!==false || summary.performance_changed!==false || summary.train_n!==1175 || summary.train_pass!==1095 || summary.train_fail!==80 || JSON.stringify(summary.feature_order)!==JSON.stringify(FEATURES) || JSON.stringify(summary.features.map(r=>r.feature))!==JSON.stringify(FEATURES)) throw new Error('학습 근거 범위 불일치');
  const monthly=csvRows(monthlyText);
  if(monthly.length!==30) throw new Error('월별 근거 누락');
  for(const row of summary.features) for(const group of ['pass','fail']) checkGroup(row.groups[group]);
  for(const feature of FEATURES) for(const month of ['2008-07','2008-08','2008-09']) for(const group of ['pass','fail']) {
    const matches=monthly.filter(r=>r.feature===feature&&r.month===month&&r.group===group);
    if(matches.length!==1) throw new Error('월별 근거 중복 또는 누락');
    checkGroup(matches[0]);
  }
  if(sensitivity.scope!=='observed_training_descriptive_sensitivity_only'||sensitivity.original_data_modified!==false||sensitivity.deletion_recommended!==false||JSON.stringify(sensitivity.baseline)!==JSON.stringify(summary.features[4]) || sensitivity.leave_one_group_maximum_out.length!==2 || sensitivity.leave_one_group_maximum_out.map(r=>r.group).join(',')!=='pass,fail') throw new Error('민감도 범위 불일치');
  for(const scenario of sensitivity.leave_one_group_maximum_out) for(const group of ['pass','fail']) checkGroup(scenario.summary.groups[group]);
  return {summary,monthly,sensitivity};
}
function table(caption,heads,rows) {return `<div class="evidence-table-wrap distribution-table" tabindex="0" role="region" aria-label="${esc(caption)} · 좌우 스크롤"><table class="evidence-table"><caption>${esc(caption)}</caption><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
export function renderFeature(data, feature) {
  if(!FEATURES.includes(feature)) throw new Error('알 수 없는 변수');
  const row=data.summary.features.find(r=>r.feature===feature);
  const groups=table(`${feature} · 전체 학습 구간의 관측값`,['그룹','관측 / 전체','결측 (비율)','평균','표본 SD'],['pass','fail'].map(g=>`<tr><th scope="row">${g==='pass'?'Pass':'Fail'}</th><td>${count(row.groups[g])}</td><td>${missing(row.groups[g])}</td><td>${number(row.groups[g].mean)}</td><td>${number(row.groups[g].std)}</td></tr>`));
  const months=['2008-07','2008-08','2008-09'].map(month=>{
    const pass=data.monthly.find(r=>r.feature===feature&&r.month===month&&r.group==='pass'),fail=data.monthly.find(r=>r.feature===feature&&r.month===month&&r.group==='fail');
    return `<tr><th scope="row">${month}</th><td>${count(pass)}<small>결측 ${pass.n_missing}</small></td><td>${count(fail)}<small>결측 ${fail.n_missing}</small></td><td>${signed(pass.fail_minus_pass_mean_difference)}</td></tr>`;
  });
  const warning=feature==='feature_065'?'월별 부호: 음 → 양 → 음.':feature==='feature_475'?'월별 부호: 양 → 음 → 양.':feature==='feature_247'||feature==='feature_519'?'9월 Fail은 전체 15건 중 관측 7건뿐입니다.':'같은 방향의 차이도 월별 크기와 표본 구성이 다릅니다.';
  return `<h3>${feature} · 관측 분포 읽기</h3>${groups}<p>Fail − Pass 평균 차이 <b>${signed(row.mean_difference)}</b> · 표준화 차이 ${number(row.standardized_mean_difference)}${row.standardized_difference_unavailable_reason?` (${esc(row.standardized_difference_unavailable_reason)})`:''}</p><p class="evidence-muted">표준화 차이는 pooled SD 단위의 설명량입니다. 인과 효과·예측 중요도가 아니며 익명 변수의 원시 평균 차이로 순위를 다시 매기지 않습니다.</p>${table(`${feature} · 학습 월별 관측 분모와 평균 차이`,['월','Pass 관측 / 전체','Fail 관측 / 전체','Fail − Pass 평균 차이'],months)}<p class="evidence-note evidence-warning">${warning} 일관된 공정 원인이 아니라 시간·표본 구성·꼬리값을 더 확인할 가설입니다.</p><details class="evidence-details"><summary>${feature} 분포 그림 · 겹침과 꼬리 확인</summary><p>원본 관측값만 사용한 공통 구간 밀도 히스토그램·상자그림. 그룹별 분포가 겹치며 결측값의 분포는 알 수 없습니다.</p><img class="distribution-plot" src="${ASSET_ROOT}${feature}.svg" alt="${feature}의 학습 Pass와 Fail 관측값 밀도 히스토그램과 상자그림. 상세 수치와 관측 분모는 위 표 참조." loading="lazy"></details>`;
}
export function renderSensitivity(sensitivity) {
  const scenarios=[{label:'원본 관측값 모두 유지',summary:sensitivity.baseline},...sensitivity.leave_one_group_maximum_out.map(row=>({label:`${row.group==='pass'?'Pass':'Fail'}군 최대 ${row.excluded_value} 한 건 제외 (별도 복사본)`,summary:row.summary}))];
  return table('feature_475 · 서로 독립적인 사후 민감도 시나리오',['설명 시나리오','Pass 관측 / 전체','Fail 관측 / 전체','Fail − Pass 평균 차이'],scenarios.map(row=>`<tr><th scope="row">${esc(row.label)}</th><td>${count(row.summary.groups.pass)}</td><td>${count(row.summary.groups.fail)}</td><td>${signed(row.summary.mean_difference)}</td></tr>`));
}
