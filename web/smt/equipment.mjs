// Transcribed from the user-provided school archive, not a live inventory.
export const EQUIPMENT_SOURCE = {
  url: 'https://amic.tukorea.ac.kr/equ/equInfo/equInfo.hs',
  archiveSha256: '680a10eb6dbe107bfd792d262d91c9d1143623b0eb3c9d2e1785ff402e0310a3',
  reviewedOn: '2026-09-14',
};
export const EQUIPMENT = [
  ['loader','Loader','STML-100Y','SJ이노테크','440 x 330'],
  ['printer','Screen Printer','HP-520S','SJ이노테크','520 x 420'],
  ['spi','SPI','MS-11E','MIR-TEC','510 x 460'],
  ['mounter_chip','Mount Chip','YSM-10','YAHAMA','510 x 460'],
  ['mounter_multi','Mount Multi','YSM-10','YAHAMA','510 x 460'],
  ['work_table','Work Table','SWT-900L','SJ이노테크','440 x 330'],
  ['reflow','Reflow','MKV-E1810','HELLER','560'],
  ['cooling','Cooling Conveyor','SCL-900Y','SJ이노테크','440 x 330'],
  ['aoi','AOI(3D)','MV-6e OMNI','MIR-TEC','510 x 460'],
  ['ng_buffer','NG-Buffer','SSB-200Y','SJ이노테크','440 x 330'],
  ['unloader','UN_Loader','STMU-110Y','SJ이노테크','440 x 330'],
].map(([id,name,model,maker,pcbSize])=>({id,name,model,maker,pcbSize}));

export function showEquipment(root,index){
  const equipment=EQUIPMENT[index];
  root.querySelector('summary').textContent=`선택한 장비의 참고 모델 · ${equipment.model}`;
  const facts=[['자료의 장비명',equipment.name],['모델',equipment.model],
    ['제조사 표기',equipment.maker==='YAHAMA'?'YAHAMA (원문 표기 · 확인 필요)':equipment.maker],
    ['대응 기판 크기 (mm)',equipment.pcbSize+(equipment.id==='reflow'?' (원문 단일 수치 · 치수 방향 미확인)':'')]];
  root.querySelector('dl').replaceChildren(...facts.map(([label,value])=>{
    const group=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label;dd.textContent=value;group.append(dt,dd);return group;
  }));
}
