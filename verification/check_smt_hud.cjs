// Local/CI only. Reads the synthetic scene and operates its visible controls.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',origin=new URL(base).origin;
const output=path.join(process.env.FABGUARD_UI_OUTPUT||'/tmp/fabguard-ui','smt-hud');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader']});
 const checks=[];let activePage;
 try {
  for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,390,360]){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   activePage=page;page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await page.clock.install({time:new Date('2026-11-10T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-10T00:01:00Z'));
   const advance=async ms=>{for(let n=0;n<ms;n+=100)await page.clock.fastForward(Math.min(100,ms-n));};
   const hud=page.locator('#spi-hud');
   await page.goto(new URL('/smt/',base).href);await page.locator('#hud-focus').waitFor();await advance(150);
   assert.equal(await page.locator('#view-error').isVisible(),false,'WebGL must render');
   assert.match(await page.locator('#run-status').innerText(),/일시정지/);
   assert.equal(await hud.getAttribute('data-state'),'waiting');
   assert.equal(await hud.locator('[data-hud="value"]').innerText(),'—');
   for(const theme of ['silver','dark']){
    if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').press('Enter');
    await page.locator('#hud-focus').press('Enter');await advance(150);
    assert.equal(await hud.isVisible(),true);
    const marker=page.locator('.hud-overlay');assert.equal(await marker.isVisible(),true);
    assert.equal(await marker.getAttribute('aria-hidden'),'true');
    const rects=await page.evaluate(()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return {x:x.x,y:x.y,right:x.right,bottom:x.bottom,width:x.width};};return {hud:r('#spi-hud'),view:r('#viewport'),scroll:document.documentElement.scrollWidth,inner:innerWidth};});
    assert.ok(rects.scroll<=width+1,'no horizontal overflow');
    if(rects.view.width<760){assert.ok(rects.hud.y>=rects.view.bottom-1,'mobile card below 3D');assert.equal(await page.locator('.hud-leader').isVisible(),false);}
    else assert.ok(rects.hud.x>=rects.view.x && rects.hud.right<=rects.view.right,'desktop card inside viewport');
    await page.locator('#hud-language').press('Enter');assert.match(await hud.innerText(),/SYNTHETIC/);assert.equal(await hud.getAttribute('lang'),'en');
    await page.locator('#hud-language').press('Enter');assert.match(await hud.innerText(),/가상 데이터/);
    // Exercise the left-docked mobile cascade even when this camera initially docks right.
    await hud.evaluate(el=>{el.dataset.side='left';});
    await page.locator('#hud-toggle').press('Enter');assert.equal(await hud.isVisible(),false);
    await page.locator('#hud-toggle').press('Enter');assert.equal(await hud.isVisible(),true);
    await page.locator('#station-strip button').nth(3).press('Enter');assert.equal(await hud.isVisible(),false);
    await page.locator('#hud-focus').press('Enter');await advance(150);assert.equal(await hud.isVisible(),true);
    for(const selector of ['#floor-agv-select','#transfer-robot-select','#robot-select']){await page.locator(selector).press('Enter');assert.equal(await hud.isVisible(),false);await page.locator('#hud-focus').press('Enter');await advance(150);assert.equal(await hud.isVisible(),true);}
    await page.locator('#top-view').press('Enter');await page.locator('#camera-reset').press('Enter');await page.locator('#hud-focus').press('Enter');await advance(150);
    await page.locator('.hud-stage').screenshot({path:path.join(output,`${width}-${theme}-waiting.png`)});
    await page.locator('#intro-open').press('Enter');await page.locator('#intro-preview').press('Enter');
    await page.locator('#intro-status').filter({hasText:'10초 미리보기 중'}).waitFor();
    await advance(200);assert.equal(await hud.isVisible(),false);
    await page.locator('#intro-close').press('Enter');
    // Native dialog close dispatch is asynchronous; virtual RAF advancement is not its completion signal.
    await page.locator('#intro-status').filter({hasText:'중단했어요'}).waitFor({state:'attached'});
    await advance(150);await hud.waitFor({state:'visible'});assert.equal(await hud.isVisible(),true);
    // A missing result must never show the precomputed raw volume.
    await page.locator('#reset').press('Enter');await page.locator('[data-fault="missing"]').press('Enter');await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');await advance(3500);await page.locator('#play').press('Enter');await advance(150);
    assert.equal(await page.locator('#board-select').inputValue(),'PCB-002');
    assert.equal(await hud.getAttribute('data-state'),'missing');assert.equal(await hud.locator('[data-hud="value"]').innerText(),'—');
    const frozen=await hud.innerText();await advance(700);assert.equal(await hud.innerText(),frozen,'pause keeps the record fixed');
    await page.locator('.hud-stage').screenshot({path:path.join(output,`${width}-${theme}-missing.png`)});
    await page.locator('#reset').press('Enter');await page.locator('#reset').press('Enter');await advance(150);assert.equal(await hud.getAttribute('data-state'),'waiting');assert.equal(await page.locator('#completed').innerText(),'0');
    checks.push({width,theme,selection:true,toggle:true,hudLanguages:true,reducedMotion:true,missing:true,pause:true,repeatedReset:true,introInterrupted:true});
   }
   assert.deepEqual(errors,[]);
   await page.route('**/smt/hud.mjs',r=>r.fulfill({status:404,body:'HUD deliberately unavailable'}));
   await page.reload();await page.locator('#context-review h3').first().waitFor();await advance(150);
   assert.equal(await page.locator('#viewport canvas').count(),1);
   await page.locator('#play').press('Enter');await advance(1500);await page.locator('#play').press('Enter');
   assert.notEqual(await page.locator('#clock').innerText(),'00:00','optional HUD failure must not stop simulation');
   assert.deepEqual(errors,[]);await context.close();
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(checks,null,2));
 } catch(error) {
  if(activePage && !activePage.isClosed()){
   await activePage.screenshot({path:path.join(output,'failure.png'),timeout:10000}).catch(()=>{});
   const state=await activePage.evaluate(()=>({status:document.querySelector('#intro-status')?.textContent,dialogOpen:document.querySelector('#intro-dialog')?.open,hudHidden:document.querySelector('#spi-hud')?.hidden,hudState:document.querySelector('#spi-hud')?.dataset,clock:document.querySelector('#clock')?.textContent})).catch(()=>null);
   fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,checks,state},null,2));
  }
  throw error;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
