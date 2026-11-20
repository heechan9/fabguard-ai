import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { STATIONS } from '../../web/smt/simulation.mjs';
import { stationZoom } from '../../web/smt/camera-model.mjs';
import { activeTransferBoard, transferPose, TRANSFER_STAGE } from '../../web/smt/transfer-robot-model.mjs';
import { robotPose } from '../../web/smt/robot-cell-model.mjs';
import { FloorAgv } from '../../web/smt/floor-agv-model.mjs';

const source = readFileSync(new URL('../../web/smt/app.mjs', import.meta.url), 'utf8');
const widths = [1.7, 2.25, 2.25, 2.25, 2.25, 1.45, 4.4, 1.45, 2.25, 1.45, 1.7];

function extract(begin, end) {
  const at = source.indexOf(begin);
  const stop = source.indexOf(end, at + begin.length);
  assert.ok(at >= 0 && stop > at, `current integration boundary changed: ${begin}`);
  return source.slice(at, stop);
}

// Execute selected coordinate-producing parts of the real browser entry point in-memory.
// Rendering sinks only capture supplied coordinates. No app or helper code gets edited on disk.
function snapshot(gap, translation, viewportWidth) {
  const layout = extract('const widths=', 'let targetX=');
  const gapToken = 'offset+=widths[i]+.65;';
  assert.equal(layout.split(gapToken).length, 2, 'update the injection seam if layout changes');
  const floorFocus = extract('function selectFloorAgv(){', "\n$('floor-agv-select').addEventListener");
  const camera = extract('function focusStation(i){', '\nlet azimuth=');
  const mounts = extract(' robotCell=mountRobotCell(scene,', '\n selectionRing=new THREE.Mesh');
  const boardWorld = extract('const transferBoard=activeTransferBoard(source.boards);', '\n mesh.visible');
  const agvFrame = extract(' floorAgvView?.update(floorAgv.pose);', '\n for(const {head,stage}');
  const scoped = `
    ${layout.replace(gapToken, 'offset+=widths[i]+gap;')}
    for(let i=0;i<positions.length;i++) positions[i]+=translation;
    let targetX=0,targetY=0,targetZ=0,insideView=false,azimuth,elevation,zoom;
    let robotCell,transferRobot,floorAgvView;
    const scene={}, cylinder=undefined,label=undefined,color={};
    const boxes=[], mounts={}, cameraSamples=[], agvFrames=[], boardWorldSamples={};
    const viewport={clientWidth:viewportWidth,clientHeight:600}, stationButtons=[];
    const floorAgv=new FloorAgv();
    function cameraUpdate(){cameraSamples.push({x:targetX,y:targetY,z:targetZ,zoom});}
    const $=()=>({setAttribute(){}}),clearPartSelection=()=>{},updateInterior=()=>{};
    const mountRobotCell=(_,x)=>{mounts.sort=x;};
    const mountTransferRobot=(_,x)=>{mounts.transfer=x;};
    const mountFloorAgv=()=>({update(pose){agvFrames.push({x:pose.x,z:pose.z});}});
    const box=(_,w,h,d,x,y,z)=>boxes.push({w,h,d,x,y,z});
    ${floorFocus}
    ${camera}
    ${mounts}
    for(let i=0;i<widths.length;i++)focusStation(i);
    selectFloorAgv();
    const normalBoards=STATIONS.map((_,stage)=>({id:'plain-'+stage,stage,progress:.2,aoi:null}));
    const cases = [...normalBoards, {id:'cooled',stage:TRANSFER_STAGE,progress:.5,aoi:null},
                   {id:'sorted',stage:9,progress:.5,aoi:'NG'}, {id:'PCB-005',stage:10,progress:1,done:true,aoi:null}];
    for(const board of cases){
      const source={boards:[board]},boardMeshes=new Map();
      const makeBoard=b=>({position:{set(x,y,z){boardWorldSamples[b.id]={x,y,z};}}});
      ${boardWorld}
      }
    }
    for(const when of [0,12,16,24]){floorAgv.update(when);${agvFrame}}
    ({positions,boxes,mounts,cameraSamples,boardWorldSamples,agvFrames});
  `;
  return runInNewContext(scoped, {gap,translation,viewportWidth,STATIONS,stationZoom,TRANSFER_STAGE,
    activeTransferBoard,transferPose,robotPose,FloorAgv,AGV_NAME: 'synthetic-floor'});
}

function equal(a, b, label) {
  assert.ok(Math.abs(a-b)<1e-10,`${label}: observed ${a}, expected ${b}`);
}

// Independent edge representation: start at left edge, then sum widths and count
// gaps. The current renderer centers width + one gap per machine, including the end.
function expectedLeft(index, gap, translation) {
  const lineSpan=widths.reduce((sum,w)=>sum+w,0)+widths.length*gap;
  return translation-lineSpan/2+widths.slice(0,index).reduce((sum,w)=>sum+w,0)+index*gap;
}

for (const [gap, origin, vw] of [[.65,0,1366],[.2,-3.25,390],[1.7,4.8,360]]) {
  test(`SMT station-bound sinks use one layout: gap=${gap}, offset=${origin}, viewport=${vw}`, () => {
    const got=snapshot(gap,origin,vw);
    for(let i=0;i<widths.length;i++){
      const left=expectedLeft(i,gap,origin);
      const cx=left+widths[i]/2;
      equal(got.positions[i],cx,`station ${i}`);
      equal(got.cameraSamples[i].x,cx,`camera ${i}`);
      const aspect=vw/600;
      const targetSpan=widths[i]+1.5>4.5?widths[i]+1.5:4.5;
      const frustum=Math.tan(7*Math.PI/60)*2*(aspect<1?aspect:1);
      const expectedZoom=Math.max(.035,Math.min(1.8,targetSpan/frustum/(aspect<1.35?47:36)));
      equal(got.cameraSamples[i].zoom,expectedZoom,`camera framing ${i}`);
      if(i!==7)equal(got.boardWorldSamples['plain-'+i].x,left-.24+.2*(widths[i]+.48),`PCB ${i}`);
      if(i<widths.length-1) equal(got.boxes[i].x,left+widths[i]+gap/2,`conveyor ${i} midpoint`);
    }
    equal(got.boxes.length,10,'conveyor count');
    const transfer=expectedLeft(7,gap,origin)+widths[7]/2;
    const sort=expectedLeft(9,gap,origin)+widths[9]/2;
    equal(got.mounts.transfer,transfer,'transfer base');
    equal(got.mounts.sort,sort,'sort base');
    equal(got.boardWorldSamples.cooled.x,transfer,'transfer carried PCB midpoint');
    equal(got.boardWorldSamples.sorted.x,sort,'sort carried PCB local x');
    equal(got.boardWorldSamples.sorted.z,-1.4,'sort carried PCB local z');
    equal(got.boardWorldSamples['PCB-005'].x,expectedLeft(10,gap,origin)+widths[10]/2+1.3,'finished PCB exit');
    equal(got.cameraSamples.at(-1).x,0,'independent AGV camera global x');
    equal(got.cameraSamples.at(-1).z,5.5,'independent AGV camera global z');
    [[-8,4],[8,7],[8,7],[-4,7]].forEach(([x,z],i)=>{
      equal(got.agvFrames[i].x,x,`independent AGV pose ${i} x`);
      equal(got.agvFrames[i].z,z,`independent AGV pose ${i} z`);
    });
  });
}
