// Test-only: preinstalled CI Chromium, loopback sources and synthetic inputs only.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const output=process.env.FABGUARD_UI_OUTPUT;fs.mkdirSync(output,{recursive:true});const checks=[],errors=[];let activePage;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader']});
 for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,390,360]){
  console.log('VIEWPORT',width);fs.writeFileSync(path.join(output,'checkpoint.txt'),'viewport '+width+' context');
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();activePage=page;page.setDefaultTimeout(45000);await page.clock.install({time:new Date('2026-10-24T00:00:00Z')});
  const advance=async ms=>{for(let t=0;t<ms;t+=100)await page.clock.fastForward(Math.min(100,ms-t));};
  const capture=async (locator,name)=>{await page.clock.resume();await locator.screenshot({path:path.join(output,name),timeout:20000});await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));};
  page.on('pageerror',e=>errors.push({width,message:e.message}));await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8764'?r.continue():r.abort());
  fs.writeFileSync(path.join(output,'checkpoint.txt'),'navigation '+width);await page.goto('http://127.0.0.1:8764/smt/');await page.locator('#robot-phase').waitFor();
  assert.equal(await page.locator('#view-error').isVisible(),false,'WebGL must render, not fallback');assert.equal(await page.locator('#viewport canvas').count(),1);
  assert.match(await page.locator('#run-status').innerText(),/일시정지/);
  await page.locator('#robot-select').press('Enter');assert.equal(await page.locator('#robot-select').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#station-info').innerText(),/기판 집기.*이송/);assert.equal(await page.locator('.robot-cell-info a').getAttribute('href'),'/robot/');
  const d=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,cls:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,client:e.clientWidth})).filter(e=>e.right>innerWidth+1||e.left< -1).slice(0,30)}));assert.ok(d.doc<=width,JSON.stringify(d));
  fs.writeFileSync(path.join(output,'checkpoint.txt'),'initial screenshot '+width);await page.locator('#viewport').screenshot({path:path.join(output,width+'-robot-initial.png')});fs.writeFileSync(path.join(output,'checkpoint.txt'),'initial captured '+width);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
  await page.locator('#robot-select').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'A');
  await page.locator('[data-fault=paste]').press('Enter');await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');
  fs.writeFileSync(path.join(output,'checkpoint.txt'),'advancing to pick '+width);await advance(9100);fs.writeFileSync(path.join(output,'checkpoint.txt'),'pick '+width+' '+await page.locator('#robot-phase').innerText());await page.locator('#board-select').selectOption('PCB-001');assert.match(await page.locator('#robot-phase').innerText(),/집기/);
  await page.locator('#play').press('Enter');await page.locator('#speed').selectOption('1');
  const frozen=await page.locator('#robot-phase').innerText();await advance(400);assert.equal(await page.locator('#robot-phase').innerText(),frozen);
  await capture(page.locator('#viewport'),width+'-robot-pick.png');
  await page.locator('#play').press('Enter');await advance(700);assert.match(await page.locator('#robot-phase').innerText(),/이송 →/);await page.locator('#play').press('Enter');
  await capture(page.locator('#viewport'),width+'-robot-transfer.png');
  await page.locator('#play').press('Enter');await advance(1800);assert.match(await page.locator('#robot-phase').innerText(),/내려놓기 완료/);await page.locator('#play').press('Enter');
  assert.match(await page.locator('#robot-phase').innerText(),/가상 정상 위치/);
  await capture(page.locator('#viewport'),width+'-robot-place.png');
  await page.locator('#board-select').selectOption('PCB-002');await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');
  await advance(1400);assert.match(await page.locator('#robot-phase').innerText(),/내려놓기 완료/);await page.locator('#play').press('Enter');assert.match(await page.locator('#robot-phase').innerText(),/가상 불량 위치/);
  await capture(page.locator('#viewport'),width+'-robot-ng.png');
  await page.locator('#play').press('Enter');await advance(13000);assert.equal(await page.locator('#completed').innerText(),'12');assert.equal(await page.locator('#export-review').isEnabled(),true);
  await page.locator('#reset').press('Enter');assert.match(await page.locator('#run-status').innerText(),/일시정지/);assert.match(await page.locator('#robot-phase').innerText(),/最|최종 검사 대기/);assert.equal(await page.locator('#completed').innerText(),'0');
  await page.locator('#robot-select').press('Enter');await capture(page.locator('.robot-cell-info'),width+'-robot-description.png');
  // Existing camera and separate inspection/intro paths must remain usable.
  await page.locator('#top-view').press('Enter');await page.locator('#camera-reset').press('Enter');await page.locator('#intro-open').press('Enter');assert.equal(await page.locator('#intro-dialog').isVisible(),true);await page.locator('#intro-close').press('Enter');assert.ok(await page.locator('#inspection-lab button').count()>0);
  await page.clock.resume();await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#reset').press('Enter');assert.match(await page.locator('#run-status').innerText(),/실행 중/);await page.emulateMedia({reducedMotion:'reduce'});assert.match(await page.locator('#run-status').innerText(),/일시정지/);
  checks.push({width,status:'pass',assertions:'WebGL; reduced motion initial/reset; robot Enter/Tab/link; pick/transfer/place; normal/NG; pause; 12 complete/export; reset; camera; intro; inspection; no document overflow'});
  await context.close();
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),checks,errors,scope:'synthetic robot cell UI only; no detection performance or equipment control'},null,2));await browser.close();if(errors.length)process.exitCode=1;
})().catch(async e=>{if(activePage){await activePage.clock.resume().catch(()=>{});await activePage.screenshot({path:path.join(output,'failure-screen.png'),timeout:10000}).catch(()=>{});fs.writeFileSync(path.join(output,'failure-state.txt'),await activePage.locator('body').innerText().catch(()=>''));}fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,checks,errors},null,2));console.error(e);process.exit(1)});
