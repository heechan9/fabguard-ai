// Run both served revisions with the same Chromium, GPU backend, DPR and instrumented app entry point.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const width = Number(process.env.WIDTH || 360);
assert([360,1366].includes(width),'WIDTH must be 360 or 1366');
const out = path.resolve(process.env.QA_OUT || 'line-qa-'+width);
const recoveryRegression=process.env.RECOVERY_REGRESSION==='1';
const servers=recoveryRegression
  ? {base:'http://127.0.0.1:8775',candidate:'http://127.0.0.1:8776'}
  : {base:'http://127.0.0.1:8774',candidate:'http://127.0.0.1:8775'};
const hasRecovery=version=>recoveryRegression || version==='candidate';
const save = (name,value) => fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const digest = data => createHash('sha256').update(data).digest('hex');
const stamp = b => b.map(({id,stage,progress,done})=>({id,stage,progress,done}));
const shots = {}, canonical = {}, initial = {}, modules = {}, runs = [], teaching = {};
const traces = {};
const frames = page => page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const call = (page,method,arg) => page.evaluate(({method,arg})=>{
  const detail={method,arg};window.dispatchEvent(new CustomEvent('line-qa-runtime',{detail}));
  if (!Object.hasOwn(detail,'result')) throw Error('App instrumentation unavailable');
  return detail.result;
},{method,arg});

// Appended only in the intercepted loopback response. The real RAF, WebGL renderer, UI and
// simulation updates are retained. Deterministic simulated time is independent of RAF timing.
function runtime() {
  const advance=sim.advance.bind(sim);
  let measured=false;
  // The ordinary landing UI still reports its actual running state during the initial capture.
  sim.advance=()=>{if(measured)advance(1/60);};
  function cameraRead() {
    camera.updateMatrixWorld();
    return {target:[targetX,targetY,targetZ],azimuth,elevation,zoom,position:camera.position.toArray(),
      quaternion:camera.quaternion.toArray(),fov:camera.fov,near:camera.near,far:camera.far,
      opticalZoom:camera.zoom,aspect:camera.aspect,projection:camera.projectionMatrix.toArray(),
      buffer:[renderer.domElement.width,renderer.domElement.height]};
  }
  function cameraWrite(c) {
    [targetX,targetY,targetZ]=c.target;azimuth=c.azimuth;elevation=c.elevation;zoom=c.zoom;
    camera.fov=c.fov;camera.near=c.near;camera.far=c.far;camera.zoom=c.opticalZoom;
    cameraUpdate();
    // The equality check outside the page checks both the resulting view and projection.
    // Keep the public camera model responsible for deriving the actual transform.
    return cameraRead();
  }
  function seek(t) {
    document.getElementById('reset').click();
    sim.reset();floorAgv.reset(0);sim.running=true;advance(t);sim.running=false;
    floorAgv.update(sim.time);updateUI();draw();
    return sim.time;
  }
  function info() {
    const gl=renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      dpr:devicePixelRatio,time:sim.time,boards:sim.snapshot().boards.map(({id,stage,progress,done})=>({id,stage,progress,done})),
      activeStation,insideView,teachingMode:document.getElementById('teaching-mode').value,
      camera:cameraRead(),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
  }
  async function bench(scenario) {
    const next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    // Align the first simulation advancement with an actual RAF boundary.
    await next();seek(.001);
    if(scenario==='late-recovery'){
      // Stage the same mixed lot with the last board approaching the sorter.
      sim.running=true;sim.arm('paste');advance(4);sim.arm('missing');advance(75);
      floorAgv.update(sim.time);updateUI();draw();
    }
    const startCompleted=sim.boards.filter(b=>b.done).length;
    measured=true;sim.running=true;
    try {
      for(let i=0;i<14;i++) await next();
      const start=sim.time, startBoards=sim.boards.length, intervals=[],calls=[],triangles=[];
      let previous=await next();
      const measuredStart=sim.time;
      for(let i=0;i<32;i++) {
        const now=await next();
        intervals.push(now-previous);previous=now;
        calls.push(renderer.info.render.calls);triangles.push(renderer.info.render.triangles);
      }
      return {start,measuredStart,end:sim.time,startCompleted,startBoards,endBoards:sim.boards.length,
        intervals,calls,triangles,camera:cameraRead()};
    } finally {measured=false;sim.running=false;}
  }

  let tracked, trackedMesh;
  const objectIds=new WeakMap();
  function beginTrace() {
    if(tracked) throw Error('A continuous board trace may be initialized only once');
    // One public reset supplies both the original simulation object and a fresh scene mesh.
    document.getElementById('reset').click();
    sim.running=true;advance(.001);floorAgv.update(sim.time);updateUI();draw();
    tracked=sim.boards[0];trackedMesh=boardMeshes.get(tracked.id);
    if(tracked.id!=='PCB-001'||trackedMesh.userData.boardId!==tracked.id)throw Error('Unexpected tracked PCB');
    objectIds.set(tracked,crypto.randomUUID());
    return STATIONS.map(({name,duration})=>({name,duration}));
  }
  function traceTo(t) {
    if(!tracked || t<sim.time)throw Error('Trace must advance in chronological order');
    const boardNow=()=>sim.boards.find(b=>b.id===tracked.id);
    function verifyIdentity() {
      if(boardNow()!==tracked||boardMeshes.get(tracked.id)!==trackedMesh||selected!==tracked.id)
        throw Error('The tracked board object, selected ID, or mesh changed');
    }
    const recoveryPath=[];let steps=0;
    while(sim.time<t){
      const dt=Math.min(.1,t-sim.time);advance(dt);floorAgv.update(sim.time);
      // Use the original draw path for all intervening poses; present the requested checkpoints.
      draw(sim,false);verifyIdentity();steps++;
      if(tracked.stage===10)recoveryPath.push({t:sim.time,xyz:trackedMesh.getWorldPosition(new THREE.Vector3()).toArray()});
    }
    updateUI();draw();verifyIdentity();
    const n=tracked.stage,station=STATIONS[n],p=trackedMesh.getWorldPosition(new THREE.Vector3());
    const ndc=p.clone().project(camera);
    let visible=true;
    for(let o=trackedMesh;o;o=o.parent)visible=visible&&o.visible;
    const transfer=n===TRANSFER_STAGE&&activeTransferBoard(sim.boards)===tracked?transferPose(tracked):null;
    const robot=robotPose(tracked);
    const destination=robot.route?DESTINATIONS[robot.route]:null;
    const unloader=machines[10].getWorldPosition(new THREE.Vector3());
    const buffer=machines[9].getWorldPosition(new THREE.Vector3());
    const endpoint=destination?{x:buffer.x+destination.x,z:buffer.z+destination.z}:null;
    const local=machines[10].worldToLocal(p.clone()),withinUnloaderFootprint=
      Math.abs(local.x)<=widths[10]/2 && Math.abs(local.z)<=.95;
    return {time:sim.time,steps,recoveryPath,stage:n,number:station?n+1:null,
      name:station?.name??'배출 완료',uiLocation:document.getElementById('board-location').textContent,
      uiClock:document.getElementById('clock').textContent,selected,uiSelected:document.getElementById('board-select').value,
      boardId:tracked.id,objectReferenceToken:objectIds.get(boardNow()),meshUuid:trackedMesh.uuid,
      meshBoardId:trackedMesh.userData.boardId,visible,progress:tracked.progress,done:tracked.done,
      position:p.toArray(),unloaderCenterXZ:[unloader.x,unloader.z],unloaderBodyWidth:widths[10],
      withinUnloaderFootprint,robotDestinationXZ:endpoint?[endpoint.x,endpoint.z]:null,
      atRobotDestinationXZ:endpoint?Math.abs(p.x-endpoint.x)<1e-7 && Math.abs(p.z-endpoint.z)<1e-7:false,
      screenNdc:ndc.toArray(),camera:cameraRead(),mode:document.getElementById('teaching-mode').value,
      viewportInside:insideView,visibleMeshCountForId:scene.children.filter(c=>c.userData.boardId===tracked.id&&c.visible).length,
      history:tracked.history.map(({stage,time})=>({stage,time})),
      motion:robot.position?{source:'robotPose',phase:robot.phase,route:robot.route,carrying:robot.carrying}:
        transfer?.position?{source:'transferPose',phase:transfer.phase,carrying:transfer.carrying}:{source:'conveyor'}};
  }
  const retained=new Map();
  function probeBoards() {
    const boards={};
    for(const b of sim.boards) {
      const m=boardMeshes.get(b.id);
      if(!retained.has(b.id)) retained.set(b.id,[b,m]);
      const [original,mesh]=retained.get(b.id);
      if(b!==original||mesh!==m)throw Error('Board identity changed '+b.id);
      const p=m.getWorldPosition(new THREE.Vector3()), ndc=p.clone().project(camera);
      let visible=true;for(let o=m;o;o=o.parent) visible=visible&&o.visible;
      boards[b.id]={uuid:m.uuid,position:p.toArray(),ndc:ndc.toArray(),visible,
        count:scene.children.filter(c=>c.userData.boardId===b.id&&c.visible).length};
    }
    const trays={};
    for(const [key,hex] of Object.entries({ok:0x43b998,ng:0xd75948,review:0xe8aa4e})){
      const tray=robotCell.root.children.find(o=>o.isMesh&&o.material.color.getHex()===hex&&Math.abs(o.position.y-.94)<1e-6);
      if(!tray)throw Error('Physical tray not found: '+key);
      trays[key]=tray.getWorldPosition(new THREE.Vector3()).toArray();
    }
    return {boards,trays,station11:machines[10].getWorldPosition(new THREE.Vector3()).toArray(),snapshot:sim.snapshot()};
  }
  function terminalView(){
    const c=cameraRead();c.target=[(positions[9]+positions[10])/2,1.15,0];c.azimuth=.2;c.elevation=.98;
    c.zoom=stationZoom(6.5,c.aspect);return cameraWrite(c);
  }
  const methods={read:info,write:cameraWrite,seek,bench,beginTrace,traceTo,probeBoards,terminalView,arm:f=>sim.arm(f)};
  window.addEventListener('line-qa-runtime',e=>{
    const {method,arg}=e.detail;
    if (Object.hasOwn(methods,method)) e.detail.result=methods[method](arg);
  });
  document.documentElement.dataset.lineQaReady='true';
}

async function open(browser,version) {
  const origin=servers[version],errors=[];
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,
    reducedMotion:'no-preference',serviceWorkers:'block',colorScheme:'dark'});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error' && /THREE.WebGLProgram|Shader Error/i.test(e.text()))errors.push(e.text());});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin) return route.abort();
    if(url.pathname!=='/smt/app.mjs')return route.continue();
    const source=await route.fetch({maxRedirects:0});
    assert.equal(source.status(),200);
    const body=await source.text();modules[version]=digest(body);
    return route.fulfill({response:source,body:body+'\n;('+runtime.toString()+')();\n'});
  });
  await page.goto(origin+'/smt/',{waitUntil:'load'});
  await page.waitForSelector('html[data-line-qa-ready="true"]');
  assert.equal(await page.locator('#view-error').isVisible(),false);
  await page.evaluate(()=>document.fonts.ready);await frames(page);
  const state=await call(page,'read');
  assert.match(state.gpu,/swiftshader/i);assert.equal(state.dpr,1);assert.equal(state.horizontalOverflow,false);
  return {page,context,errors};
}

function matchView(a,b,label) {
  for(const key of ['target','position','quaternion','projection','buffer','azimuth','elevation','zoom','aspect','near','far','fov','opticalZoom']) {
    const l=[].concat(a[key]),r=[].concat(b[key]);
    assert(l.length===r.length && l.every((v,i)=>Number.isFinite(v)&&Math.abs(v-r[i])<1e-7),label+' camera mismatch: '+key);
  }
}

async function imageOf(page,version,name,matched=false) {
  const canvas=page.locator('#viewport canvas').first();
  await canvas.scrollIntoViewIfNeeded();await frames(page);
  const state=await call(page,'read');
  assert.equal(state.horizontalOverflow,false);
  if(matched){
    if(version==='candidate')canonical[name]=state.camera;
    else matchView(state.camera,canonical[name],name);
  }
  const file=version+'-'+name+'.png';
  const png=await canvas.screenshot({path:path.join(out,file)});
  shots[version][name]={file,sha256:digest(png),camera:state.camera,simulationSeconds:state.time,
    boards:state.boards,activeStation:state.activeStation,inside:state.insideView,mode:state.teachingMode};
  return shots[version][name];
}
async function matchBeforeCapture(page,version,name) {
  if(version==='base')matchView(await call(page,'write',canonical[name]),canonical[name],name);
  return imageOf(page,version,name,true);
}


async function boardTrace(page,version) {
  // Set the camera before beginning. No station or board selection is performed during the trace.
  matchView(await call(page,'write',canonical.line),canonical.line,'trace overview');
  const stations=await call(page,'beginTrace');assert.equal(stations.length,11);
  let end=0;
  await call(page,'arm','paste');
  const samples=[{key:'initial',time:.001,stage:0,photo:true}];
  for(const [stage,station] of stations.entries()){
    samples.push({key:'stage-'+String(stage+1).padStart(2,'0'),stage,time:end+station.duration/2,
      photo:[2,6,8,10].includes(stage)});
    end+=station.duration;
  }
  samples.push({key:'discharged',stage:stations.length,time:end+.25,photo:true});
  const start11=end-stations[10].duration;
  for(const [key,time] of [['ok-pickup',start11],['ok-quarter',start11+.75],['ok-three-quarter',start11+2.25],
      ['ng-sort',start11+4],['ng-mid',start11+5.5],['ng-discharged',end+4.25],
      ['hold-discharged',end+8.25],['multiple-ok',end+20.25],['lot-complete',end+44]]) {
    samples.push({key,time,stage:time>=end?11:10,terminal:true});
  }
  samples.sort((a,b)=>a.time-b.time);
  const rows=[];
  for(const sample of samples){
    const row=await call(page,'traceTo',sample.time);
    if(sample.time>=4&&sample.time<8&&!rows.some(r=>r.armedHold)){await call(page,'arm','missing');row.armedHold=true;}
    const probe=await call(page,'probeBoards');rows.push({key:sample.key,...row,probe});
    for(const board of probe.snapshot.boards){
      const m=probe.boards[board.id],expected=hasRecovery(version)||!board.done||board.id==='PCB-001';
      assert.equal(m.visible,expected,version+' '+sample.key+' '+board.id+' visibility');
      assert.equal(m.count,Number(expected));assert(m.position.every(Number.isFinite));
    }
    if(sample.terminal || sample.key==='stage-11'){
      await call(page,'terminalView');
      const target=sample.key.startsWith('ng-')?'PCB-002':sample.key.startsWith('hold-')?'PCB-003':'PCB-001';
      const board=(await call(page,'probeBoards')).boards[target];assert(board.ndc.every(v=>Math.abs(v)<=1),'outside terminal camera '+target);
      await matchBeforeCapture(page,version,'terminal-'+sample.key);
      await call(page,'write',canonical.line);
    }
    assert.equal(row.stage,sample.stage);assert.equal(row.mode,'normal');assert.equal(row.viewportInside,false);
    for(const id of [row.boardId,row.meshBoardId,row.selected,row.uiSelected])assert.equal(id,'PCB-001');
    assert.equal(row.meshUuid,rows[0].meshUuid);assert.equal(row.objectReferenceToken,rows[0].objectReferenceToken);
    assert(row.visible && row.visibleMeshCountForId===1 && row.position.every(Number.isFinite));
    assert(Math.abs(row.time-sample.time)<1e-8);
    assert.equal(row.done,sample.stage===stations.length);
    if(sample.stage<stations.length){assert.equal(row.name,stations[sample.stage].name);assert.equal(row.number,sample.stage+1);}
    matchView(row.camera,canonical.line,'trace '+sample.key);
    if(sample.photo)await imageOf(page,version,'pcb-001-'+sample.key,true);
  }
  const final=rows.at(-1);
  assert.equal(final.uiLocation,'배출 완료');
  assert.deepEqual(final.history.map(h=>h.stage),[...stations.keys(),stations.length]);
  const transfer=rows.find(r=>r.number===8),robot=rows.find(r=>r.number===10);
  assert.equal(transfer.motion.source,'transferPose');assert.equal(robot.motion.source,'robotPose');
  assert(transfer.motion.carrying && robot.motion.carrying);
  const endpointObservations=[rows.find(r=>r.number===11),final].map(r=>({
    sample:r.key,simulationSeconds:r.time,uiLocation:r.uiLocation,meshVisible:r.visible,
    meshWorldXYZ:r.position,unloaderCenterXZ:r.unloaderCenterXZ,unloaderBodyWidth:r.unloaderBodyWidth,
    withinUnloaderFootprint:r.withinUnloaderFootprint,robotDestinationXZ:r.robotDestinationXZ,
    atRobotDestinationXZ:r.atRobotDestinationXZ,units:'model scene units'
  }));
  const trace={version,board:'PCB-001',width,endpointObservations,totalStations:stations.length,totalDuration:end,stations,rows,
    note:'Explanatory simulation timeline and scene-unit coordinates. A test-only WeakMap token identifies the original plain board object; meshUuid is Three.js identity. Visibility means the mesh and its ancestors are visible. Covers may occlude it. Read the final robot pose alongside the UI stage.'};
  traces[version]=trace;save(version+'-pcb-001-trace.json',trace);
  console.log(version+' PCB-001 stage 11 and discharge (model units): '+JSON.stringify(endpointObservations));
  console.log(version+' PCB-001: '+stations.length+' ordered stages, '+final.time.toFixed(3)+' synthetic seconds, '+final.uiLocation+'; final mesh position '+final.position.join(', '));
}

async function visual(browser,version) {
  const {page,context,errors}=await open(browser,version);
  try {
    shots[version]={};teaching[version]=[];
    // Capture the first landing viewport before scrolling or touching any UI.
    await page.screenshot({path:path.join(out,version+'-landing.png')});
    initial[version]=(await call(page,'read')).camera;
    await imageOf(page,version,'initial');
    await page.locator('#camera-reset').click();await frames(page);
    if(version==='base')await call(page,'write',canonical.line);
    await imageOf(page,version,'line',true);
    await boardTrace(page,version);
    if(recoveryRegression){
      // Check real pointer picking on the two hold trays and the top two normal boards.
      await call(page,'terminalView');
      const probe=await call(page,'probeBoards'),canvas=page.locator('#viewport canvas').first();
      const bounds=await canvas.boundingBox();assert(bounds);
      const picked=[];
      for(const id of ['PCB-002','PCB-003','PCB-011','PCB-012']){
        const [x,y]=probe.boards[id].ndc;
        await canvas.click({position:{x:(x+1)*bounds.width/2,y:(1-y)*bounds.height/2}});
        assert.equal(await page.locator('#board-select').inputValue(),id,'pointer pick '+id);
        picked.push(id);
      }
      save(version+'-recovery-picks.json',picked);
    }
    await call(page,'seek',22.25);
    for(const i of [0,1,5,7,8,9,10]) {
      await page.locator('#station-strip button').nth(i).click();
      const button=page.locator('#inside-view');
      if(await button.getAttribute('aria-pressed')==='true')await button.click();
      const shot=await matchBeforeCapture(page,version,'station-'+String(i+1).padStart(2,'0')+'-closed');
      assert.equal(shot.mode,'normal');assert.equal(shot.inside,false);assert.equal(shot.activeStation,i);assert.equal(shot.simulationSeconds,22.25);
    }
    for(const [i,label] of [[1,'printer'],[2,'spi'],[6,'reflow'],[8,'aoi']]) {
      await page.locator('#station-strip button').nth(i).click();
      for(const inside of [false,true]) {
        const button=page.locator('#inside-view');
        if((await button.getAttribute('aria-pressed')==='true')!==inside) await button.click();
        assert.equal(await button.getAttribute('aria-pressed'),String(inside));
        const photo=await matchBeforeCapture(page,version,label+(inside?'-open':'-closed'));
        assert.equal(photo.inside,inside);
      }
    }
    for(const t of [22.25,23.5]) {
      await page.locator('#camera-reset').click();await call(page,'seek',t);
      await call(page,'write',canonical.line);
      const shot=await imageOf(page,version,'flow-'+String(t).replace('.','p'),true);
      assert.equal(shot.simulationSeconds,t);
      assert(shot.boards.some(b=>!b.done && b.progress>0 && b.progress<1));
    }
    for(const i of [3,4]) {
      const label='placement-'+(i+1),mode=page.locator('#teaching-mode');
      await page.locator('#station-strip button').nth(i).click();
      assert.equal(await mode.inputValue(),'normal');assert.equal(await page.locator('#teaching-legend').isVisible(),false);
      const before=await call(page,'read');
      if(!await page.locator('#teaching-settings').evaluate(el=>el.open))await page.locator('#teaching-settings summary').click();
      await mode.selectOption('assembly');const step=page.locator('#teaching-step');
      assert.equal(await step.inputValue(),'0');
      await page.locator('#teaching-next').click();assert.equal(await step.inputValue(),'1');
      await step.selectOption('4');assert.equal(await page.locator('#teaching-next').isDisabled(),true);
      // Assembly interpolation uses real wall time and is bounded to one second.
      await page.waitForTimeout(1030);
      await imageOf(page,version,label+'-assembly');
      await page.locator('#teaching-back').click();assert.equal(await step.inputValue(),'3');
      const records=[];
      for(const [field,word] of [['temperature','온도'],['stress','응력']]) {
        await mode.selectOption(field);
        const note=await page.locator('#teaching-field-note').innerText();
        assert(note.includes('합성')&&note.includes(word));
        assert.equal(await page.locator('#teaching-scale span').count(),3);
        const caption=await page.locator('#teaching-caption').innerText();assert(caption.includes('0'+(i+1)+'번'));
        await imageOf(page,version,label+'-'+field);records.push({field,note,caption});
      }
      assert.notEqual(shots[version][label+'-temperature'].sha256,shots[version][label+'-stress'].sha256);
      await mode.press('Escape');assert.equal(await mode.inputValue(),'normal');
      const after=await call(page,'read');assert.deepEqual(after.boards,before.boards);matchView(after.camera,before.camera,label+' return');
      teaching[version].push({station:i+1,assemblySteps:[0,1,4,3],records,normalRestored:true});
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}

function stats(values){
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return {count:n,mean:values.reduce((s,v)=>s+v,0)/n,median:(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2,p90:sorted[Math.ceil(n*.9)-1]};
}

async function timed(browser,version,ordinal){
  const {page,context,errors}=await open(browser,version);
  try{
    const state=await call(page,'read');matchView(state.camera,initial[version],'fresh initial');
    await page.locator('#viewport canvas').first().scrollIntoViewIfNeeded();
    const scenarios=ordinal%2?['matched-line','actual-initial']:['actual-initial','matched-line'];
    scenarios.splice(ordinal%2?0:scenarios.length,0,'late-recovery');
    for(const scenario of scenarios){
      const view=scenario==='late-recovery'?canonical['terminal-lot-complete']:scenario==='matched-line'?canonical.line:initial[version];
      matchView(await call(page,'write',view),view,scenario);
      const sample=await call(page,'bench',scenario);
      if(scenario==='late-recovery')assert(sample.startBoards===12 && sample.startCompleted>=9);
      matchView(sample.camera,view,scenario);
      assert(Math.abs((sample.end-sample.measuredStart)-32/60)<1e-8,'Simulation must advance once per measured frame');
      const result={ordinal,version,scenario,renderer:state.gpu,dpr:1,...sample,
        frameMs:stats(sample.intervals),drawCalls:stats(sample.calls),trianglesPerFrame:stats(sample.triangles)};
      assert(result.drawCalls.mean>0);runs.push(result);save('performance-runs.json',runs);
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || (fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium'),headless:true,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  try{
    await visual(browser,'candidate');await visual(browser,'base');
    for(const name of Object.keys(canonical)){
      const a=shots.base[name],b=shots.candidate[name];matchView(a.camera,b.camera,name);
      assert.deepEqual(stamp(a.boards),stamp(b.boards));assert.equal(a.simulationSeconds,b.simulationSeconds);
    }
    for(const [i,a] of traces.base.rows.entries()){
      const b=traces.candidate.rows[i];
      for(const key of ['key','stage','number','name','selected','uiLocation','uiClock','progress','done','visible','motion','history','time'])
        assert.deepEqual(a[key],b[key],'PCB-001 '+a.key+' '+key);
      assert.deepEqual(a.probe.snapshot,b.probe.snapshot,'all board and event records at '+a.key);
      if(recoveryRegression){
        assert.deepEqual(a.recoveryPath,b.recoveryPath);
        for(const id of Object.keys(a.probe.boards)){
          const before=a.probe.boards[id],after=b.probe.boards[id];
          for(const field of ['position','visible','count','ndc'])assert.deepEqual(before[field],after[field],id+' '+field+' '+a.key);
        }
      }
      for(const board of a.probe.snapshot.boards){
        const p=a.probe.boards[board.id].position,q=b.probe.boards[board.id].position;
        if(board.stage<9||(board.stage===9&&board.progress<.9)){
          assert(p.every((v,j)=>Math.abs(v-q[j])<1e-7),board.id+' upstream '+a.key);
        }else if(board.aoi==='NG'||board.fault==='missing'){
          assert.deepEqual([p[0],p[2]],[q[0],q[2]],board.id+' sorter tray XZ '+a.key);
        }
      }
    }
    const observations={};
    const xzDistance=(p,q)=>Math.hypot(p[0]-q[0],p[2]-q[2]);
    for(const version of ['base','candidate']){
      const rows=traces[version].rows;
      const at=k=>rows.find(r=>r.key===k).probe;
      const point=(k,id)=>at(k).boards[id].position;
      const terminal=at('lot-complete'),trays=terminal.trays;
      const first=point('ok-pickup','PCB-001'),last=point('discharged','PCB-001');
      assert(xzDistance(first,trays.ok)<1e-5);
      const samples=['ok-pickup','ok-quarter','stage-11','ok-three-quarter','discharged'];
      const distances=samples.map(k=>xzDistance(trays.ok,point(k,'PCB-001')));
      if(hasRecovery(version)){
        assert(distances.slice(1).every((v,i)=>v>distances[i]+.01),'forward handoff positions');
        assert(Math.abs(last[0]-(terminal.station11[0]-.38))<1e-5&&Math.abs(last[2]-terminal.station11[2])<1e-5,'normal board in first recovery slot');
        const path=rows.flatMap(r=>r.recoveryPath);
        assert(path.length>=29,'stage 11 at most 0.1s between observations');
        assert(path.some(({xyz})=>Math.abs(xyz[2]-1.91)<1e-5 && xyz[0]>first[0]+.1 && xyz[0]<last[0]-.1),'crossing front corridor');
        for(const [i,r] of path.entries())if(i){
          const prev=path[i-1];assert(r.t-prev.t<=.100001);
          assert(Math.hypot(...r.xyz.map((v,j)=>v-prev.xyz[j]))<.6,'unexpected teleport during handoff');
        }
      }else assert(distances.every(n=>n<1e-5),'previous draft keeps OK on sorter');
      for(const [id,route,keys] of [['PCB-002','ng',['ng-sort','ng-mid','ng-discharged','lot-complete']],['PCB-003','review',['hold-discharged','lot-complete']]]){
        assert(keys.every(k=>xzDistance(point(k,id),trays[route])<1e-6),id+' missed actual tray');
        assert(keys.every(k=>JSON.stringify(point(k,id))===JSON.stringify(point(keys[0],id))),id+' moved after deposit');
      }
      const boards=terminal.snapshot.boards;
      assert.equal(boards[1].aoi,'NG');assert.equal(boards[1].fault,'paste');assert(boards[1].volume<80);
      assert.equal(boards[2].aoi,'OK');assert.equal(boards[2].fault,'missing');assert.equal(boards[2].volume,null);
      const normal=boards.filter(b=>b.aoi==='OK'&&!b.fault).map(b=>terminal.boards[b.id]);
      assert.equal(normal.length,10);
      if(hasRecovery(version))for(const [i,m] of normal.entries()){
        const expected=[terminal.station11[0]+(i%2?.38:-.38),1.11+Math.floor(i/2)*.15,terminal.station11[2]];
        assert(m.visible&&m.count===1&&m.position.every((v,j)=>Math.abs(v-expected[j])<1e-5),'completed board in recovery slot '+i);
      }
      if(hasRecovery(version))for(const [i,m] of normal.entries())for(const n of normal.slice(i+1)){
        assert(Math.abs(m.position[0]-n.position[0])>=.67||Math.abs(m.position[2]-n.position[2])>=.79||Math.abs(m.position[1]-n.position[1])>=.07,'overlapping board substrates');
      }
      observations[version]={trays,completedMeshVisibility:Object.fromEntries(Object.entries(terminal.boards).map(([id,m])=>[id,m.visible])),station11:terminal.station11,normalHandoff:samples.map((k,i)=>({key:k,xyz:point(k,'PCB-001'),distanceFromTray:distances[i]})),ng:point('ng-discharged','PCB-002'),hold:point('hold-discharged','PCB-003'),normalStack:normal.map(n=>n.position)};
    }
    save('terminal-route-comparison.json',{width,identicalSnapshots:true,observations,
      files:['base-pcb-001-trace.json','candidate-pcb-001-trace.json']});
    assert.notDeepEqual(shots.base['flow-22p25'].boards,shots.base['flow-23p5'].boards);
    save('captures.json',{width,initial,canonical,shots,teaching,modules,
      note:'Camera is the live factory camera. The assembly, temperature and stress screenshots use their own teaching camera.'});
    if(recoveryRegression)return;
    // Two ABBA blocks, a single active page, and four independent runs per version and scenario.
    const order=['base','candidate','candidate','base','base','candidate','candidate','base'];
    for(const [i,version] of order.entries())await timed(browser,version,i);
    const groups={};
    for(const run of runs){const key=run.version+'/'+run.scenario;(groups[key]??=[]).push(run);}
    const summary=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{runs:v.length,
      pooledFrameMs:stats(v.flatMap(r=>r.intervals)),runMeansMs:v.map(r=>r.frameMs.mean),
      drawCalls:stats(v.flatMap(r=>r.calls)),triangles:stats(v.flatMap(r=>r.triangles))}]));
    const report={width,chrome:browser.version(),renderer:runs[0].renderer,deviceScaleFactor:1,order,modules,
      method:'One Chromium instance, one live page at a time; native real-time RAF, static camera, 14 warm-up frames, 32 measured intervals, moving simulation at 1/60 synthetic second per rendered frame. Each actual-initial uses its native initial lens/pose; matched-line shares candidate optics and pose. Late-recovery uses the common sorter camera at 79 synthetic seconds with 12 boards and at least 9 already complete. Counts are Three renderer.info.render counters, not hardware GPU times.',summary};
    save('summary.json',report);console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
