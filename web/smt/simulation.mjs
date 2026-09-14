export const STATIONS=[
 {name:'Loader',label:'투입',duration:3,description:'PCB 투입. 각 보드에 고유 ID를 부여합니다.'},
 {name:'Printer',label:'납 인쇄',duration:4,description:'스크린 프린터. PCB 패드에 솔더 페이스트를 도포합니다.'},
 {name:'3D SPI',label:'납 검사',duration:4,description:'납 도포량 검사. 데모에서는 80–120%를 정상 범위로 설정했습니다.'},
 {name:'Mounter 1',label:'칩 실장',duration:4,description:'칩 부품 실장. 실제 위치 오차 모델은 이 버전에 포함되지 않습니다.'},
 {name:'Mounter 2',label:'이형 실장',duration:4,description:'다른 형태의 부품 실장. 단순화한 공정 흐름입니다.'},
 {name:'Work table',label:'육안 검사',duration:3,description:'중간 육안 검사 위치. 실제 작업자 판단은 모델링하지 않았습니다.'},
 {name:'Reflow',label:'리플로우',duration:7,description:'납땜 가열 구간. 데모 최고 온도 범위는 235–250°C입니다. 실물 레시피가 아닙니다.'},
 {name:'Cooling',label:'냉각',duration:3,description:'냉각 구간. 열전달 물리는 계산하지 않습니다.'},
 {name:'3D AOI',label:'최종 검사',duration:4,description:'합성 AOI 결과. 납 부족 또는 과열 시 NG가 되도록 정한 가상 규칙입니다.'},
 {name:'NG buffer',label:'검사 버퍼',duration:3,description:'검사 후 대기. NG는 붉은색으로 표시하며 실제 분기 장치는 구현하지 않았습니다.'},
 {name:'Unloader',label:'배출',duration:3,description:'PCB 배출. 전체 12장 완료 시 시뮬레이션이 정지합니다.'}
];
export const FAULTS={paste:'납 도포량 부족',heat:'리플로우 과열',missing:'SPI 센서 데이터 누락'};
export const TOTAL=STATIONS.reduce((sum,s)=>sum+s.duration,0);
const starts=STATIONS.map((_,i)=>STATIONS.slice(0,i).reduce((sum,s)=>sum+s.duration,0));
export function assess(b){
 if(b.stage<2)return {status:'측정 대기',level:'normal',reason:'SPI 측정을 기다리는 중입니다.'};
 if(b.aoi==='NG')return {status:'가상 AOI NG',level:'danger',reason:b.volume<80?'도포량 부족 규칙으로 생성된 NG입니다. 실제 불량 판정이 아닙니다.':'과열 규칙으로 생성된 NG입니다. 실제 불량 판정이 아닙니다.'};
 if(b.volume===null)return {status:'데이터 검토 필요',level:'warn',reason:'SPI 값이 누락되어 정상 판정을 보류합니다. 가상 AOI가 OK여도 이 경보는 남습니다.'};
 if(b.volume<80)return {status:'납 도포량 검토',level:'warn',reason:'가상 SPI 도포량이 설정 하한 80% 미만입니다.'};
 if(b.peak!==null&&b.peak>250)return {status:'리플로우 온도 검토',level:'warn',reason:'가상 최고 온도가 설정 상한 250°C를 초과했습니다.'};
 return {status:b.aoi==='OK'?'가상 AOI OK':'관측값 정상 범위',level:'normal',reason:b.peak===null?'SPI 측정은 설정 범위 안입니다. 리플로우 결과는 아직 도착하지 않았습니다.':'현재까지 관측된 값이 데모 규칙 범위 안입니다. 실제 품질 보증은 아닙니다.'};
}
export class Simulation{
 constructor(){this.reset();}
 reset(){this.time=0;this.boards=[];this.pending=null;this.running=true;this.speed=1;this.randomState=42;this.spawn();}
 random(){this.randomState=(1664525*this.randomState+1013904223)>>>0;return this.randomState/4294967296;}
 arm(fault){if(!Object.hasOwn(FAULTS,fault))throw new Error('지원하지 않는 시나리오');if(this.boards.length>=12)throw new Error('모든 PCB가 투입되었습니다. 처음부터 다시 실행하세요.');this.pending=fault;}
 spawn(){let fault=this.pending;this.pending=null;const index=this.boards.length;this.boards.push({id:`PCB-${String(index+1).padStart(3,'0')}`,born:index*4,fault,stage:-1,progress:0,volume:null,peak:null,aoi:null,done:false,rawVolume:Math.round((fault==='paste'?58:94)+this.random()*(fault==='paste'?9:12)),rawPeak:Math.round((fault==='heat'?264:239)+this.random()*8),history:[]});}
 advance(dt){if(!this.running||!Number.isFinite(dt)||dt<=0)return;this.time=Math.min(44+TOTAL,this.time+dt);while(this.boards.length<12&&this.time>=this.boards.length*4)this.spawn();
  for(const b of this.boards){const age=this.time-b.born;let stage=starts.findIndex((start,i)=>age>=start&&age<start+STATIONS[i].duration);if(age>=TOTAL)stage=STATIONS.length;
   for(let i=b.stage+1;i<=stage;i++){const time=b.born+(starts[i]??TOTAL);if(i===2){b.volume=b.fault==='missing'?null:b.rawVolume;}if(i===7)b.peak=b.rawPeak;if(i===8)b.aoi=(b.rawVolume<80||b.rawPeak>250)?'NG':'OK';b.history.push({time,stage:i,text:i===11?'배출 완료':STATIONS[i].name+(i===2?` · SPI ${b.volume===null?'누락':b.volume+'%'}`:i===7?` · 최고 ${b.peak}°C`:i===8?` · 가상 ${b.aoi}`:'')});}
   b.stage=stage;b.done=stage===11;b.progress=b.done?1:Math.max(0,(age-starts[stage])/STATIONS[stage].duration);
  }if(this.boards.length===12&&this.boards.every(b=>b.done))this.running=false;
 }
 snapshot(){return {schema_version:'fabguard-smt-synthetic/v1',data_source:'synthetic',decision_engine:'demo-rules-not-fabguard-model',seed:42,simulation_seconds:this.time,thresholds:{paste_percent:[80,120],peak_celsius:[235,250]},pending_fault:this.pending,boards:this.boards.map(b=>({...b,assessment:assess(b)}))};}
}
