// Local/CI browser validation of public UI and exported synthetic state. Not safety validation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8775',out=process.env.FABGUARD_UI_OUTPUT||'/tmp/fabguard-interactive-browser';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
try{for(const width of [1366,390,360])for(const theme of ['dark','silver']){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|Shader Error/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await page.clock.install({time:new Date('2026-11-11T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-11T00:01:00Z'));
 const advance=async(ms)=>{for(let i=0;i<ms;i+=100)await page.clock.fastForward(Math.min(100,ms-i));};
 let n=0;const snapshot=async()=>{const download=page.waitForEvent('download');await page.locator('#export').press('Enter');const d=await download,file=path.join(out,`${width}-${theme}-${n++}.json`);await d.saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));};
 await page.goto(base+'/smt/');await advance(200);assert.equal(await page.locator('#view-error').isVisible(),false);
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').press('Enter');
 await page.locator('#viewport').scrollIntoViewIfNeeded();
 await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-initial-machine.png`)});
 assert.equal(await page.locator('#station-strip button').nth(3).getAttribute('aria-pressed'),'true');
 const guideBox=await page.locator('.scene-reading-guide').boundingBox(),initialViewBox=await page.locator('#viewport').boundingBox();assert.ok(guideBox.y>=initialViewBox.y+initialViewBox.height,'Legends stay outside the detailed machine view');
 const guideContrasts=await page.locator('.scene-reading-guide').evaluate(guide=>{
  const channels=c=>c.match(/[\d.]+/g).map(Number);
  const luminance=rgb=>{const linear=rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;};
  const parent=channels(getComputedStyle(guide).backgroundColor);
  return ['.gesture','#selected-station-caption','.scene-caption'].map(selector=>{
   const style=getComputedStyle(guide.querySelector(selector)),bg=channels(style.backgroundColor),alpha=bg[3]??1;
   const background=bg.slice(0,3).map((c,i)=>c*alpha+parent[i]*(1-alpha));
   const a=luminance(channels(style.color)),b=luminance(background);
   return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
 });for(const {selector,ratio} of guideContrasts)assert.ok(ratio>=4.5,`${selector} guide contrast ${ratio}`);
 await page.locator('.scene-reading-guide').screenshot({path:path.join(out,`${width}-${theme}-reading-guide.png`)});
 await page.locator('#camera-reset').press('Enter');await advance(100);
 await page.locator('#placement-focus').press('Enter');await advance(100);
 assert.equal(await page.locator('#inside-view').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#station-strip button').nth(3).getAttribute('aria-pressed'),'true');
 await page.locator('#reset').press('Enter');await advance(200);assert.match(await page.locator('#run-status').innerText(),/일시정지/);
 await page.locator('#peak-assumption').press('End');for(let step=0;step<20;step++)await page.locator('#peak-assumption').press('ArrowLeft');await page.locator('#apply-peak').press('Enter');assert.equal((await snapshot()).pending_peak_celsius,260);
 await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');await advance(3600);
 const mid=await snapshot();assert.equal(mid.boards[1].peak,null);assert.equal(mid.boards[1].rawPeak,260);
 await page.locator('#simulation-stop').press('Enter');const frozen=await snapshot();await advance(1000);assert.deepEqual((await snapshot()).boards,frozen.boards);assert.equal(await page.locator('#play').isDisabled(),true);
 await page.locator('#release-stop').press('Enter');await advance(1000);assert.equal((await snapshot()).simulation_seconds,frozen.simulation_seconds);
 await page.locator('#play').press('Enter');await advance(6000);await page.locator('#play').press('Enter');await advance(200);
 const observed=await snapshot();assert.equal(observed.boards[1].peak,260);assert.equal(observed.boards[1].aoi,'NG');assert.match(await page.locator('#lot-mission').innerText(),/가상 NG 1/);
 await page.locator('#lot-mission button').first().press('Enter');assert.equal(await page.locator('#lot-mission button').first().getAttribute('aria-pressed'),'true');
 // R3 part selection is presentation-only. Exercise exact public controls in WebGL.
 const beforeParts=await snapshot();
 for(const station of [3,4]){
  await page.locator('#station-strip button').nth(station).press('Enter');await advance(100);
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-station${station+1}-closed.png`)});
 }
 await page.locator('#station-strip button').nth(3).press('Enter');await advance(100);
 for(const part of ['nozzle','rail','feeder','pcb']){
  const button=page.locator(`[data-placement-part="${part}"]`);
  await button.press('Space');await advance(100);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-placement-part][aria-pressed="true"]').count(),1);
  assert.equal(await page.locator('#inside-view').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#placement-part-note').innerText(),/실제 측정값 아님/);
  assert.equal(await page.locator('#inside-note').isVisible(),true);
  const noteBox=await page.locator('#inside-note').boundingBox(),viewBox=await page.locator('#viewport').boundingBox();
  assert.ok(noteBox.y>=viewBox.y+viewBox.height,'Interior note stays outside the 3D viewport');
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-part-${part}.png`)});
  await button.press('Escape');
  assert.equal(await page.locator('[data-placement-part][aria-pressed="true"]').count(),0);
 }
 await page.locator('#station-strip button').nth(4).press('Enter');
 await page.locator('[data-placement-part="feeder"]').press('Enter');await advance(100);
 assert.equal(await page.locator('[data-placement-part="feeder"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-placement-part][aria-pressed="true"]').count(),1);
 assert.equal(await page.locator('#station-strip button').nth(4).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#station-strip button').nth(3).getAttribute('aria-pressed'),'false');
 await page.locator('#viewport').scrollIntoViewIfNeeded();
 await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-station5-feeder.png`)});
 await page.locator('[data-placement-part="feeder"]').press('Escape');
 const afterParts=await snapshot();assert.deepEqual(afterParts.boards,beforeParts.boards);assert.equal(afterParts.simulation_seconds,beforeParts.simulation_seconds);
 await page.locator('[data-placement-part="rail"]').press('Enter');await page.locator('#placement-clear').press('Enter');
 assert.equal(await page.locator('[data-placement-part][aria-pressed="true"]').count(),0);
 await page.locator('[data-placement-part="nozzle"]').press('Enter');await page.locator('#board-select').selectOption({index:0});
 assert.equal(await page.locator('[data-placement-part][aria-pressed="true"]').count(),0);
 await page.locator('[data-placement-part="feeder"]').press('Enter');await page.locator('#camera-reset').press('Enter');
 assert.equal(await page.locator('[data-placement-part][aria-pressed="true"]').count(),0);
 await page.locator('.mission-controls').scrollIntoViewIfNeeded();await page.locator('.mission-controls').screenshot({path:path.join(out,`${width}-${theme}-controls.png`)});
 await page.locator('#viewport').scrollIntoViewIfNeeded();await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-scene.png`)});
 const stripes=await page.locator('#lot-mission button').evaluateAll(nodes=>nodes.map(node=>({width:getComputedStyle(node).borderTopWidth,color:getComputedStyle(node).borderTopColor})));assert.ok(stripes.every(s=>s.width==='5px'),'LOT identity strips stay visible');assert.equal(new Set(stripes.map(s=>s.color)).size,stripes.length,'LOT identities use distinct colors');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'Horizontal document overflow');
 await page.locator('#reset').press('Enter');await page.locator('[data-fault="missing"]').press('Enter');await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');await advance(4000);await page.locator('#simulation-stop').press('Enter');assert.match(await page.locator('#lot-mission').innerText(),/HOLD 1/);await page.locator('#release-stop').press('Enter');assert.match(await page.locator('#lot-mission').innerText(),/HOLD 1/);
 await page.locator('#reset').press('Enter');const reset=await snapshot();assert.equal(reset.control_events.length,0);assert.equal(reset.emergency_stopped,false);assert.equal(reset.boards.length,1);assert.equal(reset.pending_peak_celsius,null);assert.equal(errors.length,0,errors.join('\n'));
 // Inspect the real rendered head at both previously intersecting side-wall positions.
 // Drive only public controls and validate the exported stage/progress at each sample.
 await page.locator('#reset').press('Enter');await page.locator('#speed').selectOption('1');
 let previousSampleTime=0;
 for(const [stage,progress] of [[3,.185],[3,.83],[4,.185],[4,.83]]){
  const targetTime=(stage===3?11:15)+4*progress;
  await page.locator('#play').press('Enter');await advance(Math.round((targetTime-previousSampleTime)*1000));
  await page.locator('#play').press('Enter');await advance(100);
  const state=await snapshot(),board=state.boards[0];assert.equal(board.stage,stage);assert.ok(Math.abs(board.progress-progress)<.025,`Sweep capture progress ${board.progress}`);
  previousSampleTime=state.simulation_seconds;
  await page.locator('#station-strip button').nth(stage).press('Enter');await advance(100);
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-sweep-${stage}-${progress}.png`)});
 }
 await page.locator('#reset').press('Enter');await advance(100);
 // Check the opt-in station illustration through its public settings, using a paused run.
 await page.locator('#station-strip button').nth(width===390 ? 4 : 3).press('Enter');await advance(120);
 await page.locator('[data-placement-part="rail"]').press('Enter');await advance(100);
 const guideState=await snapshot(),guideMode=page.locator('#teaching-mode');
 assert.equal(await guideMode.inputValue(),'normal');assert.equal(await page.locator('#teaching-legend').isVisible(),false);
 await page.locator('#teaching-settings summary').press('Enter');
 const captureGuide=async name=>{
  await advance(160);await page.locator('#viewport').scrollIntoViewIfNeeded();
  return page.locator('#viewport canvas').first().screenshot({path:path.join(out,`${width}-${theme}-teaching-${name}.png`)});
 };
 await captureGuide('normal');
 const readRendered=async()=>{await page.locator('#viewport canvas').first().evaluate(canvas=>{
   // Capture the WebGL attachment inside the app's render frame, excluding native focus and fractional CSS edges.
   window.teachingPixelCheck=new Promise(resolve=>requestAnimationFrame(()=>{
     const gl=canvas.getContext('webgl2'),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,bytes=new Uint8Array(w*h*4);
     gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
     let hash=2166136261,nonzero=0;for(let i=0;i<bytes.length;i+=4){nonzero+=bytes[i]+bytes[i+1]+bytes[i+2]>0;for(let j=0;j<3;j++)hash=Math.imul(hash^bytes[i+j],16777619);}
     resolve({w,h,hash:hash>>>0,nonzero});
   }));
 });
 await advance(100);return page.evaluate(()=>window.teachingPixelCheck);};
 const normalPixels=await readRendered();assert.ok(normalPixels.nonzero>normalPixels.w*normalPixels.h*.5);
 const normalScene=await captureGuide('baseline');
 await guideMode.selectOption('cutaway');const cutaway=await captureGuide('cutaway');
 await page.locator('#teaching-focus').selectOption('nozzle');const closeNozzle=await captureGuide('nozzle');
 assert.equal(cutaway.equals(closeNozzle),false);
 await page.locator('#teaching-focus').selectOption('feeder');await captureGuide('feeder');
 await page.locator('#teaching-focus').selectOption('all');
 await guideMode.selectOption('temperature');
 const thermalScene=await captureGuide('temperature');
 assert.equal(normalScene.equals(thermalScene),false);
 assert.match(await page.locator('#teaching-field-note').innerText(),/합성 온도/);
 assert.equal(await page.locator('#teaching-scale span').count(),3);
 assert.match(await page.locator('#teaching-caption').innerText(),width===390?/05번/:/04번/);
 await guideMode.selectOption('stress');const stressScene=await captureGuide('stress');
 assert.equal(stressScene.equals(thermalScene),false);
 assert.match(await page.locator('#teaching-field-note').innerText(),/합성 응력/);
 await guideMode.selectOption('compare');await captureGuide('comparison');
 assert.equal(await page.locator('#teaching-pair').isVisible(),true);
 assert.equal(await page.locator('#teaching-scale span').count(),6);
 const panels=await page.locator('#teaching-pair span').evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop})));
 if(width===1366)assert.ok(panels[1].x>panels[0].x);else assert.ok(panels[1].y>panels[0].y);
 await guideMode.selectOption('assembly');const baseScene=await captureGuide('base');assert.equal(await page.locator('#inside-note').isVisible(),false);
 assert.equal(await page.locator('#teaching-legend').isVisible(),false);
 assert.equal(await page.locator('#teaching-back').isDisabled(),true);
 await page.locator('#teaching-next').press('Enter');
 assert.match(await page.locator('#teaching-description').innerText(),/카세트/);
 await page.locator('#teaching-step').selectOption('4');const joinedScene=await captureGuide('joined');
 assert.equal(baseScene.equals(joinedScene),false);assert.equal(await page.locator('#teaching-next').isDisabled(),true);
 await page.locator('#teaching-back').press('Enter');await advance(100);
 assert.equal(await page.locator('#teaching-step').inputValue(),'3');
 await page.locator('#viewport').press('ArrowLeft');await advance(100);
 await page.locator('#teaching-step').press('Escape');assert.equal(await page.locator('#teaching-mode').evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('[data-placement-part="rail"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#inside-note').isVisible(),true);await captureGuide('restored');
 assert.equal(await guideMode.inputValue(),'normal');assert.equal(await page.locator('#teaching-caption').isVisible(),false);
 assert.deepEqual(await readRendered(),normalPixels,'Original WebGL pixels, camera and selection should be restored');
 assert.deepEqual(await snapshot(),guideState);
 await guideMode.selectOption('stress');await advance(100);
 await page.locator('#teaching-settings summary').press('Enter');await advance(100);
 assert.equal(await guideMode.inputValue(),'normal');assert.equal(await page.locator('#teaching-legend').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 assert.deepEqual(errors,[]);
 rows.push({width,theme,webgl:true,partControls:true,partEscape:true,partSelectionNonInterference:true,temperatureNextBoard:true,stopLatch:true,holdPreserved:true,reset:true,horizontalOverflow:false});await ctx.close();
 }
 // Deliberately disabled WebGL: the same public controls and exports must still work.
 const b=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH||'/usr/bin/chromium',args:['--disable-webgl']});try{const p=await b.newPage({reducedMotion:'no-preference'});await p.goto(base+'/smt/');assert.equal(await p.locator('#view-error').isVisible(),true);assert.equal(await p.locator('#teaching-mode').isDisabled(),true);assert.equal(await p.locator('[data-placement-part]:disabled').count(),4);assert.equal(await p.locator('[data-placement-part][aria-pressed="true"]').count(),0);assert.equal(await p.locator('#placement-clear').isDisabled(),true);assert.match(await p.locator('#placement-part-note').innerText(),/비활성화/);await p.locator('#apply-peak').click();assert.match(await p.locator('#mission-status').innerText(),/260/);await p.locator('#simulation-stop').click();assert.equal(await p.locator('#play').isDisabled(),true);await p.locator('#release-stop').click();assert.equal(await p.locator('#play').isDisabled(),false);await p.locator('#simulation-stop').click();await p.locator('#reset').click();assert.match(await p.locator('#run-status').innerText(),/일시정지/);assert.equal(await p.locator('#play').isDisabled(),false);assert.match(await p.locator('#placement-part-note').innerText(),/비활성화/);rows.push({webgl:false,controls:true,latchedResetPaused:true});}finally{await b.close();}
 await require('./compare_placement_teaching.cjs')(browser,base,out);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
