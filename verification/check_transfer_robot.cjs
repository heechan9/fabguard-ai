// CI only: existing Chromium, loopback synthetic scene; no external site/browser access.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',origin=new URL(base).origin;
const output=path.join(process.env.FABGUARD_UI_OUTPUT,'transfer-robot');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[];let activePage;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader']});
 for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,390,360]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();activePage=page;
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.clock.install({time:new Date('2026-10-30T00:00:00Z')});
  // install() keeps time running. Freeze before navigation so CDP/render latency
  // cannot skip the first 0.75 s synthetic pickup window at 4x playback.
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
  const advance=async ms=>{for(let t=0;t<ms;t+=100)await page.clock.fastForward(Math.min(100,ms-t));};
  const capture=async name=>{
   await page.clock.resume();const view=page.locator('#viewport');await view.scrollIntoViewIfNeeded();
   const bytes=await view.screenshot({path:path.join(output,`${width}-${name}.png`)});
   await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));return crypto.createHash('sha256').update(bytes).digest('hex');
  };
  await page.goto(new URL('/smt/',base).href);assert.equal(await page.locator('#view-error').isVisible(),false);
  assert.equal(await page.locator('#viewport canvas').count(),1);assert.match(await page.locator('#transfer-robot-title').innerText(),/가상 이송 로봇 R-02/);
  assert.match(await page.locator('#robot-cell-title').innerText(),/R-01/);
  for(const theme of ['silver','dark']){
   // Use the public theme control when included in the bundled theme change.
   const toggle=page.locator('#theme-toggle');
   if(await toggle.count()){
    if(await page.locator('html').getAttribute('data-theme')!==theme)await toggle.click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   }else assert.equal(theme,'silver','Both-theme capture requires the bundled theme control');
   await page.locator('#reset').press('Enter');assert.match(await page.locator('#run-status').innerText(),/일시정지/);
   await page.locator('#transfer-robot-select').press('Enter');assert.equal(await page.locator('#transfer-robot-select').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#station-info').innerText(),/실제 장비.*검증 아님/);
   const hashes=[];await page.locator('#speed').selectOption('4');
   for(const [name,pattern] of [['pick',/PCB-001 · 집기$/],['transfer',/PCB-001 · 이송$/],['place',/PCB-001 · 내려놓기$/]]){
    await page.locator('#play').press('Enter');let found=false;
    for(let n=0;n<350;n++){await advance(100);if(pattern.test(await page.locator('#transfer-robot-active').innerText())){found=true;break;}}
    assert.ok(found,`R02 ${theme} ${name}`);await page.locator('#play').press('Enter');await page.locator('#speed').selectOption('1');
    const frozen=await page.locator('#transfer-robot-active').innerText();await advance(500);assert.equal(await page.locator('#transfer-robot-active').innerText(),frozen);
    hashes.push(await capture(`${theme}-${name}`));
   }
   assert.equal(new Set(hashes).size,3,'The rendered viewport must change across pick/transfer/place');
   await page.locator('#board-select').selectOption('PCB-002');assert.match(await page.locator('#transfer-robot-phase').innerText(),/PCB-002 · 냉각 구간 대기/);
   assert.match(await page.locator('#transfer-robot-active').innerText(),/PCB-001/,'selection must not steal active gripper');
   await page.locator('#robot-select').press('Enter');assert.equal(await page.locator('#transfer-robot-select').getAttribute('aria-pressed'),'false');
   await page.locator('#transfer-robot-select').press('Enter');assert.equal(await page.locator('#robot-select').getAttribute('aria-pressed'),'false');
   await page.locator('#top-view').press('Enter');await page.locator('#camera-reset').press('Enter');
   // Cancel the separate intro during a paused transfer; the live board must survive.
   await page.locator('#intro-open').press('Enter');await page.locator('#intro-preview').press('Enter');await advance(800);await page.locator('#intro-close').press('Enter');
   assert.equal(await page.locator('#intro-dialog').isVisible(),false);assert.match(await page.locator('#transfer-robot-active').innerText(),/PCB-001/);
   await page.locator('#transfer-robot-select').press('Enter');
   const returnHashes=[];
   for(const [name,pattern] of [['empty-lift',/없음 · 빈 그리퍼 올리기$/],['empty-return',/없음 · 빈 그리퍼 복귀$/],['ready',/없음 · 다음 집기 준비$/],['next-pick',/PCB-002 · 집기$/]]){
    await page.locator('#play').press('Enter');let found=false;
    for(let n=0;n<50;n++){await advance(100);if(pattern.test(await page.locator('#transfer-robot-active').innerText())){found=true;break;}}
    assert.ok(found,`R02 ${theme} ${name}`);await page.locator('#play').press('Enter');
    const frozen=await page.locator('#transfer-robot-active').innerText();await advance(500);assert.equal(await page.locator('#transfer-robot-active').innerText(),frozen);
    returnHashes.push(await capture(`${theme}-${name}`));
   }
   assert.equal(new Set(returnHashes).size,4,'Empty return and next pickup must visibly move');
   await page.locator('#reset').press('Enter');await page.locator('#reset').press('Enter');assert.match(await page.locator('#transfer-robot-active').innerText(),/없음/);assert.match(await page.locator('#transfer-robot-phase').innerText(),/냉각 구간 대기/);
   assert.equal(await page.locator('#completed').innerText(),'0');assert.equal(await page.locator('#board-select option').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   checks.push({width,theme,phases:['pick','transfer','place'],pause:true,reset:true,selection:true,introInterrupted:true,emptyReturn:true,nextPickup:true,renderHashes:hashes,emptyReturnHashes:returnHashes});
  }
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,errors,scope:'Synthetic R02 geometry and UI, not real kinematics or safety validation'},null,2));assert.deepEqual(errors,[]);
})().catch(async e=>{if(activePage){await activePage.clock.resume().catch(()=>{});await activePage.screenshot({path:path.join(output,'failure.png'),timeout:10000}).catch(()=>{});}fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,checks,errors},null,2));console.error(e);process.exit(1);});
