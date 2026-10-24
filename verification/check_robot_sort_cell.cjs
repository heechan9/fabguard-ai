// Test-only: preinstalled CI Chromium, loopback sources and synthetic inputs only.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const output=process.env.FABGUARD_UI_OUTPUT;fs.mkdirSync(output,{recursive:true});const checks=[],errors=[];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader']});
 for(const width of [1366,390,360]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push({width,message:e.message}));await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8764'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8764/smt/');await page.locator('#robot-phase').waitFor();
  assert.equal(await page.locator('#view-error').isVisible(),false,'WebGL must render, not fallback');assert.equal(await page.locator('#viewport canvas').count(),1);
  assert.match(await page.locator('#run-status').innerText(),/일시정지/);
  await page.locator('#robot-select').press('Enter');assert.equal(await page.locator('#robot-select').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#station-info').innerText(),/기판 집기.*이송/);assert.equal(await page.locator('.robot-cell-info a').getAttribute('href'),'/robot/');
  const d=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));assert.ok(d.doc<=width,JSON.stringify(d));
  await page.locator('#viewport').screenshot({path:path.join(output,width+'-robot-initial.png')});
  await page.locator('#robot-select').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'A');
  await page.locator('[data-fault=paste]').click();await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#robot-phase').textContent.includes('집기'));
  await page.locator('#play').click();await page.locator('#speed').selectOption('1');
  const frozen=await page.locator('#robot-phase').innerText();await page.waitForTimeout(400);assert.equal(await page.locator('#robot-phase').innerText(),frozen);
  await page.locator('#viewport').screenshot({path:path.join(output,width+'-robot-pick.png')});
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#robot-phase').textContent.includes('이송 →'));await page.locator('#play').click();
  await page.locator('#viewport').screenshot({path:path.join(output,width+'-robot-transfer.png')});
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#robot-phase').textContent.includes('내려놓기 완료'));await page.locator('#play').click();
  assert.match(await page.locator('#robot-phase').innerText(),/가상 정상 위치/);
  await page.locator('#viewport').screenshot({path:path.join(output,width+'-robot-place.png')});
  await page.locator('#board-select').selectOption('PCB-002');await page.locator('#speed').selectOption('4');await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#robot-phase').textContent.includes('내려놓기 완료'));await page.locator('#play').click();assert.match(await page.locator('#robot-phase').innerText(),/가상 불량 위치/);
  await page.locator('#viewport').screenshot({path:path.join(output,width+'-robot-ng.png')});
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#completed').textContent==='12');assert.equal(await page.locator('#export-review').isEnabled(),true);
  await page.locator('#reset').click();assert.match(await page.locator('#run-status').innerText(),/일시정지/);assert.match(await page.locator('#robot-phase').innerText(),/最|최종 검사 대기/);assert.equal(await page.locator('#completed').innerText(),'0');
  await page.locator('#robot-select').click();await page.locator('.robot-cell-info').screenshot({path:path.join(output,width+'-robot-description.png')});
  // Existing camera and separate inspection/intro paths must remain usable.
  await page.locator('#top-view').click();await page.locator('#camera-reset').click();await page.locator('#intro-open').click();assert.equal(await page.locator('#intro-dialog').isVisible(),true);await page.locator('#intro-close').click();assert.ok(await page.locator('#inspection-lab button').count()>0);
  checks.push({width,status:'pass',assertions:'WebGL; reduced motion initial/reset; robot Enter/Tab/link; pick/transfer/place; normal/NG; pause; 12 complete/export; reset; camera; intro; inspection; no document overflow'});
  await context.close();
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),checks,errors,scope:'synthetic robot cell UI only; no detection performance or equipment control'},null,2));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,checks,errors},null,2));console.error(e);process.exitCode=1});
