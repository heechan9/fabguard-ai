// Demonstration grouping only: four consecutive boards per lot, scoped to one run.
export const lotId=index=>`LOT-${String(Math.floor(index/4)+1).padStart(3,'0')}`;
export function lotSummary(boards){const groups=new Map();boards.forEach((b,i)=>{const id=lotId(i);if(!groups.has(id))groups.set(id,{lot_id:id,inserted:0,completed:0,virtual_ng:0,missing_measurement:0});const g=groups.get(id);g.inserted++;g.completed+=Number(b.done);g.virtual_ng+=Number(b.aoi==='NG');g.missing_measurement+=Number(b.stage>=2&&b.volume===null);});return [...groups.values()];}
