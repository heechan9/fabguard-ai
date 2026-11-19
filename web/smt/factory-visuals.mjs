import {buildProcessHousing} from './process-housings.mjs';
import {buildMagazine} from './line-transport.mjs';
// Original schematic geometry for explaining station roles; not vendor CAD.
export const shouldAutoRevealInterior=stationIndex=>stationIndex===6;

export function detailMachine(i,group,cover,w,box,cylinder){
 if(i===2||i===6)return buildProcessHousing(i,group,cover,w);
 if(i===0||i===10)buildMagazine(i,group,cover,w,box);
 const steel=0x728996,panel=0xc4d1d6,teal=0x297f86,dark=0x213b48;
 // Low cabinet seams and ventilation, shared across the line.
 for(const x of [-w*.25,w*.25])box(group,.018,.42,.02,x,.43,.895,dark);
 for(let k=0;k<4;k++)box(group,.3,.018,.025,-w*.27,.29+k*.06,-.88,steel);
 if([1,3,4,8].includes(i)){
  // Solid side shoulders frame a front viewing window.
  for(const x of [-w/2+.16,w/2-.16])box(cover,.25,1.13,1.72,x,1.56,0,panel);
  box(cover,w,.16,1.86,0,2.27,0,i===8?teal:dark);
  box(cover,.12,.25,.04,w*.31,1.52,.89,steel);
 }
 if(i===1){ // Broad stencil frame and crossbar distinguish the printer.
  for(const z of [-.48,.48])box(group,w-.48,.06,.05,0,1.6,z,teal);
  box(group,.16,.17,1.05,0,1.77,0,dark);
 }
 if(i===8){ // Inspection hood and a schematic optical head.
  box(cover,w-.46,.47,.22,0,1.94,-.71,teal);
  const lens=cylinder(group,.16,.09,0,1.76,0,0x58b7c0);lens.material.metalness=.45;
 }
 if(i===3||i===4){ // Front feeder bank, clear of the PCB transport path.
  for(let k=0;k<(i===3?6:4);k++){
   const x=-w*.31+k*w*.62/(i===3?5:3);
   box(group,.13,.14,.48,x,1.02,1.05,steel);
   const reel=cylinder(group,.15,.07,x,.78,1.17,dark);reel.rotation.x=Math.PI/2;
  }
 }
 if([5,7,9].includes(i)){
  for(let k=0;k<7;k++){const roller=cylinder(group,.055,1.04,-w*.4+k*w*.8/6,1.0,0,steel);roller.rotation.x=Math.PI/2;}
 }
}
export function dressFloor(scene,positions,widths,box){
 const zones=[{a:0,b:2,color:0x16383e},{a:3,b:5,color:0x1d303e},{a:6,b:7,color:0x39342c},{a:8,b:10,color:0x153b36}];
 for(const {a,b,color} of zones){const left=positions[a]-widths[a]/2-.25,right=positions[b]+widths[b]/2+.25;box(scene,right-left,.012,3.45,(left+right)/2,-.038,0,color);}
 // Subtle aisle boundary and directional chevrons: no animated fake throughput.
 for(const z of [-2.1,2.1])box(scene,36,.009,.035,0,-.12,z,0x507d7b);
 for(let k=0;k<9;k++)for(const sign of [-1,1]){const stroke=box(scene,.35,.014,.045,-14+k*3.5,-.11,2.65+sign*.11,0x78aaa5);stroke.rotation.y=sign*Math.PI/4;}
}
