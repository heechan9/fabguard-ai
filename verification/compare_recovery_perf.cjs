// Loopback-only browser instrumentation for a three-revision, single-view SwiftShader benchmark.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const width=Number(process.env.WIDTH||360);
assert([360,1366].includes(width));
const out=path.resolve(process.env.QA_OUT||'recovery-perf-'+width);
const versions={prior:8774,handoff:8775,candidate:8776};
const warmup=14,count=32;
const runs=[],diagnostics=[],calibration={},modules={};
const startTime=79;
const save=(name,data)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');
const hash=body=>createHash('sha256').update(body).digest('hex');
const nextOrder=[['prior','handoff','candidate'],['handoff','candidate','prior'],['candidate','prior','handoff'],
  ['candidate','handoff','prior'],['handoff','prior','candidate'],['prior','candidate','handoff']];
const criteria={reference:'handoff (c8e5db2)',minMeanImprovementPercent:5,minBlockWins:5,
  maxP90RegressionPercent:0,maxOtherViewRegressionPercent:5,
  rule:'Both views must keep pooled mean and p90 within +5% versus c8e5db2. A view shows evidence of improvement only if its pooled mean falls at least 5%, its p90 does not increase, and at least five of six paired block means improve. Four or more slower line-view block means constitute a repeated whole-line regression. No pooled cross-width inference.'};

function instrument(){
  const advance=sim.advance.bind(sim),render=renderer.render.bind(renderer);
  let ticking=false,mask=false;
  const next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  sim.advance=()=>{if(ticking)advance(1/60);};
  let lastSample;
  renderer.render=function(s,c){
    const hidden=[];
    if(mask)for(const b of sim.boards){
      const mesh=boardMeshes.get(b.id);
      if(b.done && mesh?.visible){hidden.push(mesh);mesh.visible=false;}
    }
    const begin=performance.now();
    try{return render(s,c);}
    finally{
      lastSample={submissionMs:performance.now()-begin,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        time:sim.time,masked:hidden.length};
      for(const mesh of hidden)mesh.visible=true;
    }
  };
  function cameraState(){
    camera.updateMatrixWorld();
    return {target:[targetX,targetY,targetZ],angles:[azimuth,elevation,zoom],position:camera.position.toArray(),
      quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),size:[renderer.domElement.width,renderer.domElement.height]};
  }
  function info(){
    const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      dpr:devicePixelRatio,chrome:navigator.userAgent,landingCamera:cameraState(),mode:document.querySelector('#teaching-mode').value};
  }
  async function bench({scenario,view,seconds,warmup,count,hide}){
    document.querySelector('#reset').click();sim.running=true;
    sim.arm('paste');advance(4);sim.arm('missing');advance(4);advance(seconds-8);
    floorAgv.update(sim.time);updateUI();
    document.querySelector('#camera-reset').click();
    if(scenario==='recovery'){
      targetX=(positions[9]+positions[10])/2;targetY=1.15;targetZ=0;azimuth=.2;elevation=.98;
      zoom=stationZoom(6.5,viewport.clientWidth/Math.max(1,viewport.clientHeight));
    }
    if(view){[targetX,targetY,targetZ]=view.target;[azimuth,elevation,zoom]=view.angles;}
    cameraUpdate();draw();
    const initial=sim.snapshot(),cameraBefore=cameraState();
    const data=[];
    mask=hide;
    try{
      await next();ticking=true;
      for(let i=0;i<warmup;i++)await next();
      let previous=await next(),start=sim.time;
      for(let i=0;i<count;i++){
        const now=await next();
        data.push({intervalMs:now-previous,...lastSample});previous=now;
      }
      return {initial,final:sim.snapshot(),start,data,cameraBefore,cameraAfter:cameraState()};
    }finally{ticking=false;mask=false;}
  }
  window.addEventListener('recovery-perf-local',e=>{
    e.detail.result=e.detail.method==='info'?info():bench(e.detail.args);
  });
  document.documentElement.dataset.recoveryPerf='ready';
}
const call=(page,method,args)=>page.evaluate(({method,args})=>{
  const detail={method,args};window.dispatchEvent(new CustomEvent('recovery-perf-local',{detail}));return detail.result;
},{method,args});
function stats(a){
  const v=[...a].sort((x,y)=>x-y);
  return {n:v.length,mean:v.reduce((s,n)=>s+n,0)/v.length,p90:v[Math.ceil(.9*v.length)-1]};
}
function metrics(rows){
  return Object.fromEntries(['intervalMs','submissionMs','calls','triangles','masked'].map(k=>[k,stats(rows.map(r=>r[k]))]));
}
async function session(browser,version,run){
  const origin='http://127.0.0.1:'+versions[version],errors=[];
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,
    serviceWorkers:'block',colorScheme:'dark',reducedMotion:'no-preference'});
  try{
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      if(url.pathname!=='/smt/app.mjs')return route.continue();
      const response=await route.fetch({maxRedirects:0});assert.equal(response.status(),200);
      const body=await response.text(),digest=hash(body);
      assert.equal(modules[version]??digest,digest);modules[version]=digest;
      return route.fulfill({response,body:body+'\n;('+instrument.toString()+')();'});
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',e=>{if(/THREE.WebGLProgram|Shader Error/i.test(e.text()))errors.push(e.text());});
    await page.goto(origin+'/smt/');await page.waitForSelector('html[data-recovery-perf="ready"]');
    assert.equal(await page.locator('#view-error').isVisible(),false);
    await page.evaluate(()=>document.fonts.ready);await page.locator('#viewport canvas').first().scrollIntoViewIfNeeded();
    const info=await call(page,'info');
    assert.match(info.renderer,/swiftshader/i);assert.equal(info.dpr,1);assert.equal(info.mode,'normal');
    if(calibration.renderer)assert.equal(info.renderer,calibration.renderer);
    calibration.renderer=info.renderer;
    if(calibration.landingCamera)assert.deepEqual(info.landingCamera,calibration.landingCamera);
    calibration.landingCamera=info.landingCamera;
    await run(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
}
async function measure(page,version,scenario,block,hide=false){
  const sample=await call(page,'bench',{scenario,view:calibration[scenario],seconds:startTime,warmup,count,hide});
  assert.deepEqual(sample.cameraBefore,sample.cameraAfter);
  if(calibration[scenario])assert.deepEqual(sample.cameraBefore,calibration[scenario]);
  calibration[scenario]=sample.cameraBefore;
  assert.equal(sample.initial.simulation_seconds,startTime);
  assert.equal(sample.initial.boards.length,12);
  assert.equal(sample.initial.boards.filter(b=>b.aoi==='OK'&&b.fault===null).length,10);
  assert.equal(sample.initial.boards[1].aoi,'NG');assert.equal(sample.initial.boards[1].fault,'paste');
  assert.equal(sample.initial.boards[2].volume,null);assert.equal(sample.initial.boards[2].fault,'missing');
  const initialHash=hash(JSON.stringify(sample.initial)),finalHash=hash(JSON.stringify(sample.final));
  if(calibration.initialHash)assert.equal(initialHash,calibration.initialHash);
  if(calibration.finalHash)assert.equal(finalHash,calibration.finalHash);
  calibration.initialHash=initialHash;calibration.finalHash=finalHash;
  assert(Math.abs(sample.start-(startTime+(warmup+1)/60))<1e-8);
  let previous=sample.start;
  for(const row of sample.data){
    assert(Math.abs(row.time-previous-1/60)<1e-8);previous=row.time;
    assert(row.intervalMs>0&&row.calls>0&&row.triangles>0&&row.submissionMs>=0);
    assert(hide?row.masked>0:row.masked===0);
  }
  return {version,scenario,block,hide,initialHash,finalHash,start:sample.start,end:previous,
    camera:sample.cameraAfter,completedAtStart:sample.initial.boards.filter(b=>b.done).length,
    metrics:metrics(sample.data),frames:sample.data};
}
function summarize(){
  const groups={},comparison={};
  for(const scenario of ['line','recovery']){
    groups[scenario]={};
    for(const version of Object.keys(versions)){
      const selected=runs.filter(r=>r.scenario===scenario&&r.version===version);
      assert.equal(selected.length,6);
      groups[scenario][version]={metrics:metrics(selected.flatMap(r=>r.frames)),
        runMeans:selected.map(r=>r.metrics.intervalMs.mean),runP90:selected.map(r=>r.metrics.intervalMs.p90)};
    }
    const a=groups[scenario].handoff,b=groups[scenario].candidate;
    const delta=(v,ref)=>(v/ref-1)*100;
    const meanChange=delta(b.metrics.intervalMs.mean,a.metrics.intervalMs.mean),p90Change=delta(b.metrics.intervalMs.p90,a.metrics.intervalMs.p90);
    const wins=b.runMeans.filter((v,i)=>v<a.runMeans[i]).length;
    comparison[scenario]={meanChangePercent:meanChange,p90ChangePercent:p90Change,fasterBlocks:wins,
      improvementEvidence:meanChange<=-criteria.minMeanImprovementPercent&&wins>=criteria.minBlockWins&&p90Change<=criteria.maxP90RegressionPercent,
      slowerBlocks:b.runMeans.filter((v,i)=>v>a.runMeans[i]).length,
      withinGuardrail:meanChange<=criteria.maxOtherViewRegressionPercent&&p90Change<=criteria.maxOtherViewRegressionPercent&&
        (scenario!=='line'||b.runMeans.filter((v,i)=>v>a.runMeans[i]).length<4)};
  }
  return {groups,comparison,withinBothViewGuardrails:Object.values(comparison).every(r=>r.withinGuardrail)};
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const plan={width,height:900,dpr:1,versions,order:nextOrder,startTime,warmup,count,criteria,
    method:'One Chromium process, one foreground page, six independent page contexts per version. Scenarios run in alternating order by block. Each begins at synthetic 79 s with PCB-002 paste NG and PCB-003 missing SPI HOLD; fixed 1/60 s progress per RAF. Render counters are Three.js reported counters; submissionMs measures main-thread elapsed time around renderer.render, including any driver stalls, not a GPU timer. Diagnostic hides all completed board roots immediately before render and restores them immediately afterward. A software renderer with a mobile-sized viewport does not measure physical phone FPS.'};
  save('protocol',plan);
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium'),
    headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  try{
    await session(browser,'handoff',async page=>{
      for(const scenario of ['line','recovery']){
        for(const [i,hide] of [false,true,true,false].entries()){
          diagnostics.push(await measure(page,'handoff',scenario,i,hide));save('diagnostic-runs',diagnostics);
        }
      }
    });
    const diagnosticSummary={};
    for(const scenario of ['line','recovery'])for(const hide of [false,true]){
      const rows=diagnostics.filter(r=>r.scenario===scenario&&r.hide===hide);
      diagnosticSummary[scenario+'-'+(hide?'hidden':'visible')]=metrics(rows.flatMap(r=>r.frames));
    }
    save('diagnostic-summary',diagnosticSummary);
    if(process.env.PROFILE_ONLY==='1')return;
    for(const [block,order] of nextOrder.entries()){
      for(const version of order)await session(browser,version,async page=>{
        const scenarios=block%2?['recovery','line']:['line','recovery'];
        for(const scenario of scenarios){
          runs.push(await measure(page,version,scenario,block));save('performance-runs',runs);
        }
      });
      console.log('Completed three-revision block '+(block+1)+' / 6');
    }
    const result={...plan,chrome:browser.version(),modules,calibration,diagnosticSummary,...summarize()};
    save('summary',result);console.log(JSON.stringify(result.comparison));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
