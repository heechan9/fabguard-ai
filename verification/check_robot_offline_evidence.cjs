// Run only with an installed, permitted browser. No browser download or external URL creation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764';
const output=process.env.FABGUARD_UI_OUTPUT;
if(!output)throw Error('FABGUARD_UI_OUTPUT required');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 try{for(const width of [1366,360,390]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base+'/robot/');await page.locator('#offline-results[data-status=verified]').waitFor();
  assert.equal(await page.locator('#offline-results tbody tr').count(),7);
  assert.match(await page.locator('#offline-results').innerText(),/9 · 0 · 3/);
  assert.match(await page.locator('#offline-results').innerText(),/null/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const wrap=page.locator('#offline-results .table-wrap');await wrap.focus();
  assert.equal(await wrap.evaluate(e=>e===document.activeElement),true);
  if(width<650){await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#offline-results .table-wrap').scrollLeft>0);}
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('download')),true);
  await page.locator('#offline-title').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`offline-${width}.png`),fullPage:true});
  // Corrupt only the test response, keeping application code unchanged: hash mismatch must withhold.
  await page.route('**/offline-report-data.mjs',r=>r.fulfill({contentType:'text/javascript',body:'export const REPORT_TEXT="{}";'}));
  await page.reload();await page.locator('#offline-results[data-status=withheld]').waitFor();
  assert.equal(await page.locator('#offline-results table').count(),0);
  assert.equal(errors.length,0,JSON.stringify(errors));await context.close();
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'pass',widths:[1366,360,390],browser:browser.version(),checks:['report byte hash','7 file rows','null performance','overflow','keyboard table/scroll/download focus','reduced motion','corrupt report withheld'],scope:'stored exploratory report display only'},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
