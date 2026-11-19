// Run both served revisions with the same Chromium, GPU backend, DPR and instrumented app entry point.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const width = Number(process.env.WIDTH || 360);
assert([360,1366].includes(width),'WIDTH must be 360 or 1366');
const out = path.resolve('line-qa-'+width);
const servers = {base:'http://127.0.0.1:8774',candidate:'http://127.0.0.1:8775'};
const save = (name,value) => fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const digest = data => createHash('sha256').update(data).digest('hex');
const stamp = b => b.map(({id,stage,progress,done})=>({id,stage,progress,done}));
const shots = {}, canonical = {}, initial = {}, modules = {}, runs = [], teaching = {};
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
  async function bench() {
    const next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    // Align the first simulation advancement with an actual RAF boundary.
    await next();seek(.001);measured=true;sim.running=true;
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
      return {start,measuredStart,end:sim.time,startBoards,endBoards:sim.boards.length,
        intervals,calls,triangles,camera:cameraRead()};
    } finally {measured=false;sim.running=false;}
  }
  const methods={read:info,write:cameraWrite,seek,bench};
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
    await call(page,'seek',22.25);
    for(const [i,label] of [[2,'spi'],[6,'reflow']]) {
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
    for(const scenario of scenarios){
      const view=scenario==='matched-line'?canonical.line:initial[version];
      matchView(await call(page,'write',view),view,scenario);
      const sample=await call(page,'bench');matchView(sample.camera,view,scenario);
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
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  try{
    await visual(browser,'candidate');await visual(browser,'base');
    for(const name of ['line','spi-closed','spi-open','reflow-closed','reflow-open','flow-22p25','flow-23p5']){
      const a=shots.base[name],b=shots.candidate[name];matchView(a.camera,b.camera,name);
      assert.deepEqual(stamp(a.boards),stamp(b.boards));assert.equal(a.simulationSeconds,b.simulationSeconds);
    }
    assert.notDeepEqual(shots.base['flow-22p25'].boards,shots.base['flow-23p5'].boards);
    save('captures.json',{width,initial,canonical,shots,teaching,modules,
      note:'Camera is the live factory camera. The assembly, temperature and stress screenshots use their own teaching camera.'});
    // Two ABBA blocks, a single active page, and four independent runs per version and scenario.
    const order=['base','candidate','candidate','base','base','candidate','candidate','base'];
    for(const [i,version] of order.entries())await timed(browser,version,i);
    const groups={};
    for(const run of runs){const key=run.version+'/'+run.scenario;(groups[key]??=[]).push(run);}
    const summary=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{runs:v.length,
      pooledFrameMs:stats(v.flatMap(r=>r.intervals)),runMeansMs:v.map(r=>r.frameMs.mean),
      drawCalls:stats(v.flatMap(r=>r.calls)),triangles:stats(v.flatMap(r=>r.triangles))}]));
    const report={width,chrome:browser.version(),renderer:runs[0].renderer,deviceScaleFactor:1,order,modules,
      method:'One Chromium instance, one live page at a time; native real-time RAF, static camera, 14 warm-up frames, 32 measured intervals, moving simulation at 1/60 synthetic second per rendered frame. Each actual-initial uses its native initial lens/pose; matched-line shares candidate optics and pose. Counts are Three renderer.info.render counters, not hardware GPU times.',summary};
    save('summary.json',report);console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
