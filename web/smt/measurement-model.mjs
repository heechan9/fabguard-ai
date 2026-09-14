// Educational comparison of disclosed synthetic measurements, not a quality model.
export const LIMITS={paste:[80,120],peak:[235,250]};
function compare(label,value,ready,range,unit,check){
 const base={label,range:`${range[0]}–${range[1]}${unit}`};
 if(!ready)return {...base,state:'waiting',measurement:'측정 전',difference:'아직 비교할 수 없어요',next:'해당 공정의 측정이 끝날 때까지 기다려 주세요.'};
 if(!Number.isFinite(value))return {...base,state:'missing',measurement:'누락 · 판단 보류',difference:'측정값이 없어 비교할 수 없어요',next:'센서 연결과 측정 기록 수집 상태를 확인하세요.'};
 const delta=value<range[0]?range[0]-value:value>range[1]?value-range[1]:0;
 const gap=Number(delta.toFixed(2));
 return {...base,state:delta?'outside':'within',measurement:`${value}${unit}`,difference:delta?`${value<range[0]?'하한보다':'상한보다'} ${gap}${unit==='%'?'%p':unit} ${value<range[0]?'낮아요':'높아요'}`:'데모 기준 범위 안이에요',next:delta?check:'다음 공정의 결과와 함께 확인하세요. 이 값만으로 품질을 보증하지 않아요.'};
}
export function measurementEvidence(board){return [
 compare('납 도포량',board.volume,board.stage>=2,LIMITS.paste,'%','납 인쇄 상태와 납 검사(SPI) 측정 기록을 확인하세요. 원인이 확정된 것은 아니에요.'),
 compare('가열 최고 온도',board.peak,board.stage>=7,LIMITS.peak,'°C','가열 설정과 온도 측정 기록을 확인하세요. 실제 장비의 설정 변경 지침은 아니에요.')
];}
