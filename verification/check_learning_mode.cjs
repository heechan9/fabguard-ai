// Optional-learning browser verification. Requires an already-installed Playwright
// and Chromium; does not install, publish, train, infer or deploy anything.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.FABGUARD_LOCAL_URL||'http://127.0.0.1:8764';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Loopback only');
const out=process.env.FABGUARD_LEARNING_OUTPUT||'/tmp/fabguard-learning-browser';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FABGUARD_BROWSER_PATH?{executablePath:process.env.FABGUARD_BROWSER_PATH}:{})});
 const report={browser:await browser.version(),checks:[],screenshots:[],limitations:['Loopback only; not production verification','Mobile viewport emulation, not physical phones','No screen-reader testing','Reflow only; not actual browser 200% zoom'],externalAfterOpen:[],errors:[]};
 for(const width of [1366,390,360])for(const language of ['ko','en'])for(const theme of ['dark','silver']){
  const tag=`${width}-${language}-${theme}`;
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(value=>localStorage.setItem('fabguard-theme',value),theme);
  const page=await context.newPage();let opened=false;
  page.on('pageerror',error=>report.errors.push({tag,error:String(error)}));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin===new URL(base).origin)return route.continue();if(opened)report.externalAfterOpen.push({tag,url:route.request().url()});return route.abort();});
  await page.goto(base+'/?lang='+language+'#summary');
  await page.waitForLoadState('networkidle');opened=true;await page.locator('#open-learning').click();
  const dialog=page.locator('#learning-dialog');await dialog.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-learning-v1')),null);
  assert.equal(await page.locator('#fabguard-learning-host').getAttribute('lang'),language);
  await page.locator('[data-action="skip-probe"]').click();
  for(let i=0;i<3;i++){
   await page.locator(`[data-action="lesson-${i}"]`).click();
   await page.locator('[data-action="check"]').click();
   assert.equal(await page.locator('input[name="choice"]').first().evaluate(el=>el===el.getRootNode().activeElement),true);
   await page.locator('[data-action="hint"]').click();await page.locator('[data-action="hint"]').click();await page.locator('[data-action="hint"]').click();
   assert.equal(await page.locator('#hints p').count(),2);
   await page.locator('input[name="choice"]').nth(i?1:0).check();await page.locator('input[name="reason"]').nth(i?1:0).check();
   await page.locator('[data-action="check"]').click();assert.equal(await page.locator('#explanation-title').isVisible(),true);
   await page.locator('input[name="transfer"]').nth(i===1?0:1).check();await page.locator('[data-action="transfer"]').click();await page.locator('[data-action="confirm"]').click();
   const geometry=await dialog.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,rect:el.getBoundingClientRect().width,viewport:innerWidth}));
   assert.ok(geometry.scroll<=geometry.client+1,JSON.stringify(geometry));assert.ok(geometry.rect<=geometry.viewport,JSON.stringify(geometry));
   if(i===0){const filename=tag+'.png';await page.screenshot({path:path.join(out,filename),fullPage:false});report.screenshots.push(filename);}
   await page.locator('[data-action="back-map"]').click();
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-learning-v1')),null);
  await page.locator('#save').click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fabguard-learning-v1')));
  assert.equal(saved.records.length,3);assert.ok(saved.records.every(row=>row.checked));
  for(const row of saved.records)assert.deepEqual(Object.keys(row).sort(),['checked','concept','evidence','misconception','source']);
  await page.locator('#reset').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#reset-dialog').isVisible(),false);assert.equal(await dialog.isVisible(),true);
  assert.equal(await page.locator('#reset').evaluate(el=>el===el.getRootNode().activeElement),true);
  await page.locator('#exit').click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#open-learning').evaluate(el=>el===document.activeElement),true);
  await page.locator('#open-learning').click();await page.locator('#language').click();await page.locator('#language').click();
  await page.locator('#reset').click();await page.locator('#confirm-reset').click();assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-learning-v1')),null);
  assert.equal(await page.locator('#stage input[type="radio"]').count(),6);
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  await page.locator('#open-learning').click();await page.locator('[data-action="skip-probe"]').click();await page.locator('[data-action="lesson-0"]').click();await page.locator('[data-action="reveal"]').click();
  await page.locator(`#stage a[href="/?lang=${language}#limitations"]`).click();await page.waitForURL(`**/?lang=${language}#limitations`);assert.equal(await dialog.isVisible(),false);
  await page.goBack();assert.equal(await dialog.isVisible(),false);await page.goForward();assert.equal(await dialog.isVisible(),false);
  report.checks.push({tag,status:'pass',flows:'3 cases, prediction/reason, 2 bounded hints, reveal, transfer, self-check, save, reset cancel/confirm, close/reopen, language, internal navigation, back/forward, no horizontal overflow'});
  await context.close();
 }
 assert.equal(report.externalAfterOpen.length,0);assert.equal(report.errors.length,0);
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:report.checks.length,report:path.join(out,'receipt.json')}));
})().catch(error=>{fs.writeFileSync(path.join(out,'blocked-or-failed.json'),JSON.stringify({error:String(error),status:'blocked_or_failed',complete:false},null,2)+'\n');console.error(error);process.exitCode=1});
