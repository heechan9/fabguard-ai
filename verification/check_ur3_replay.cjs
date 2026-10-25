const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',output=process.env.FABGUARD_UI_OUTPUT,width=Number(process.env.FABGUARD_UI_WIDTH);
if(!output||![1366,360,390].includes(width))throw Error('output and supported width required');
fs.mkdirSync(output,{recursive:true});let browser,page;const errors=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await page.goto(base+'/robot/ur3/');await page.locator('#load-status[data-status=ready]').waitFor();
 assert.match(await page.locator('#quality-summary').innerText(),/7,409행.*24열/);
 assert.equal(await page.locator('#sensor option').count(),19);assert.equal(await page.locator('#sensor-values tr').count(),19);
 assert.match(await page.locator('#play-status').innerText(),/일시정지/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#position').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#position').inputValue(),'1');
 await page.locator('#reset').press('Enter');await page.locator('#play').press('Enter');await page.waitForFunction(()=>Number(document.querySelector('#position').value)>0);await page.locator('#pause').press('Enter');
 const paused=await page.locator('#position').inputValue();await page.waitForTimeout(1100);assert.equal(await page.locator('#position').inputValue(),paused);
 await page.locator('#reset').press('Enter');await page.locator('[data-jump=missing]').press('Enter');assert.match(await page.locator('#current-quality').innerText(),/결측/);
 assert.match(await page.locator('#sensor-values').innerText(),/결측 \(null\)/);await page.screenshot({path:path.join(output,'missing-sensor.png'),fullPage:true});
 await page.locator('#position').evaluate(e=>{e.value='1093';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#play').press('Enter');await page.waitForFunction(()=>document.querySelector('#play-status').textContent.includes('시간 공백 직후 자동 일시정지'));
 assert.equal(await page.locator('#position').inputValue(),'1094');assert.match(await page.locator('#current-quality').innerText(),/9.039초/);
 await page.screenshot({path:path.join(output,'gap-paused.png'),fullPage:true});
 await page.locator('#reset').press('Enter');await page.locator('[data-jump=stop]').press('Enter');assert.match(await page.locator('#recorded-events').innerText(),/Robot_ProtectiveStop: True · 원본/);
 await page.locator('#reset').press('Enter');await page.locator('[data-jump=grip]').press('Enter');assert.match(await page.locator('#recorded-events').innerText(),/grip_lost: True · 원본/);
 await page.locator('#sensor').selectOption('20');assert.equal(await page.locator('#sensor').inputValue(),'20');
 // Media-query changes are delivered asynchronously; observe both transitions
 // instead of asserting immediately after the emulation command returns.
 await page.evaluate(()=>{
  window.ur3MotionObserved=null;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{window.ur3MotionObserved=event.matches;});
 });
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(()=>window.ur3MotionObserved===false);
 const motionStart=Number(await page.locator('#position').inputValue());
 await page.locator('#play').press('Enter');
 assert.match(await page.locator('#play-status').innerText(),/기록 재생 중/);
 await page.waitForFunction(start=>Number(document.querySelector('#position').value)>start,motionStart);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>window.ur3MotionObserved===true&&/동작 줄이기.*일시정지/.test(document.querySelector('#play-status').textContent));
 assert.match(await page.locator('#play-status').innerText(),/동작 줄이기.*일시정지/);
 const motionPaused=await page.locator('#position').inputValue();
 await page.waitForTimeout(1100);
 assert.equal(await page.locator('#position').inputValue(),motionPaused);
 await page.locator('#reset').press('Enter');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'overview.png'),fullPage:true});
 for(const kind of ['missing-file','corrupt-json']){
  await page.route('**/ur3/data.json',r=>kind==='missing-file'?r.fulfill({status:404,body:'missing'}):r.fulfill({contentType:'application/json',body:'{bad json'}));
  await page.reload();await page.locator('#load-status[data-status=withheld]').waitFor();
  assert.equal(await page.locator('#play').isDisabled(),true);assert.equal(await page.locator('#sensor-values tr').count(),0);assert.equal(await page.locator('#chart svg').count(),0);
  assert.match(await page.locator('#load-error').innerText(),/파일 누락·손상·형식 오류/);await page.screenshot({path:path.join(output,kind+'.png'),fullPage:true});
  await page.unroute('**/ur3/data.json');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'pass',head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),width,height:900,browser:browser.version(),errors,checks:['7409 records/24 columns','19 sensor channels; labels separate','keyboard slider and controls','play/pause/reset','missing sensor null preserved','time gap auto pause; no interpolation','original protective stop/grip flags','reduced motion pauses playback','data 404/corrupt JSON withhold and disable controls','no document overflow']},null,2));
 await browser.close();
})().catch(async e=>{console.error(e);if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,errors},null,2));if(browser)await browser.close();process.exitCode=1;});
