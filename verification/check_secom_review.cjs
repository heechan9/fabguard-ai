const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8769';
const output=process.env.FABGUARD_UI_OUTPUT||'/tmp/secom-review-browser';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.FABGUARD_BROWSER_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}); const checks=[];
 try {
  for(const width of [1366,390,360]) {
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(base+'/review/?sample=secom_1397');await page.waitForSelector('#workspace:not([hidden])');
   assert.match(await page.locator('#history-status').textContent(),/pending/);assert.match(await page.locator('#retrospective-label').textContent(),/정상/);
   for(const [id,value] of Object.entries({'reviewer-role':'Self-declared reader',rationale:'<img src=x onerror=alert(1)>','available-evidence':'Saved CSV and score','missing-evidence':'Sensor dictionary and actual process log'}))await page.locator('#'+id).fill(value);
   await page.locator('#set-now').click();await page.locator('#add-record').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('#history-list>li').length===1);
   assert.equal(await page.locator('#history-list img').count(),0);assert.match(await page.locator('#history-list').textContent(),/<img/);
   const downloaded=page.waitForEvent('download');await page.locator('#export-record').click();const file=await downloaded;const saved=path.join(output,`${width}-record.json`);await file.saveAs(saved);const first=JSON.parse(fs.readFileSync(saved));assert.equal(first.history.length,1);
   await page.locator('#rationale').fill('Unappended draft preserved');await page.locator('#language-toggle').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#rationale').inputValue(),'Unappended draft preserved');assert.equal(await page.locator('#history-list>li').count(),1);await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   const corrupt=structuredClone(first);corrupt.source.risk_score=0.99;
   await page.locator('#import-record').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupt))});await page.waitForSelector('#error:not([hidden])');assert.equal(await page.locator('#history-list>li').count(),1);assert.equal(await page.locator('#rationale').inputValue(),'Unappended draft preserved');assert.equal(await page.evaluate(()=>document.activeElement.id),'error');
   await page.locator('#import-record').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#file-status').textContent.includes('Validated'));assert.equal(await page.locator('#rationale').inputValue(),'Unappended draft preserved');
   await page.locator('#rationale').fill('hold');await page.locator('#reviewer-role').fill('reference_only');await page.locator('#set-now').click();await page.locator('#add-record').click();await page.waitForFunction(()=>document.querySelectorAll('#history-list>li').length===2);assert.match(await page.locator('#history-list>li').last().textContent(),/Rationale: hold/);assert.match(await page.locator('#history-list>li').last().textContent(),/reference_only/);
   await page.locator('#import-record').setInputFiles(saved);await page.waitForSelector('#error:not([hidden])');assert.match(await page.locator('#error').textContent(),/truncate/);assert.equal(await page.locator('#history-list>li').count(),2);
   await page.screenshot({path:path.join(output,`${width}-dark-record.png`),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const export2=page.waitForEvent('download');await page.locator('#export-record').click();const last=await export2;const saved2=path.join(output,`${width}-record-v2.json`);await last.saveAs(saved2);
   await page.reload();await page.waitForSelector('#workspace:not([hidden])');assert.match(await page.locator('#history-status').textContent(),/pending/);await page.locator('#import-record').setInputFiles(saved2);await page.waitForFunction(()=>document.querySelectorAll('#history-list>li').length===2);
   await page.locator('#theme-toggle').click();await page.screenshot({path:path.join(output,`${width}-silver-imported.png`),fullPage:true});
   // A canceled chooser must not replace or clear the current history.
   const chooserPromise=page.waitForEvent('filechooser');await page.locator('#import-record').click();const chooser=await chooserPromise;await chooser.setFiles([]);assert.equal(await page.locator('#history-list>li').count(),2);
   // Stale asynchronous reads must not replace a newer appended revision.
   await page.evaluate(()=>{const original=File.prototype.arrayBuffer;window.__restoreReader=()=>{File.prototype.arrayBuffer=original;};File.prototype.arrayBuffer=function(){if(this.name==='slow.json'){window.__readStarted=true;return new Promise(resolve=>{window.__releaseRead=()=>original.call(this).then(resolve);});}return original.call(this);};});
   await page.locator('#import-record').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(first))});await page.waitForFunction(()=>window.__readStarted===true);
   for(const [id,value] of Object.entries({'reviewer-role':'Reader',rationale:'Newer local note','available-evidence':'Saved score','missing-evidence':'Field evidence'}))await page.locator('#'+id).fill(value);
   await page.locator('#set-now').click();await page.locator('#add-record').click();await page.waitForFunction(()=>document.querySelectorAll('#history-list>li').length===3);await page.evaluate(()=>window.__releaseRead());await page.waitForTimeout(100);assert.equal(await page.locator('#history-list>li').count(),3);assert.equal(await page.locator('#error').isVisible(),false);
   assert.equal(await page.locator('#import-record').inputValue(),'');await page.evaluate(()=>window.__restoreReader());
   await page.locator('#import-record').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(first))});await page.waitForSelector('#error:not([hidden])');assert.match(await page.locator('#error').textContent(),/truncate/);assert.equal(await page.locator('#history-list>li').count(),3);
   const badUtf8=Buffer.from(JSON.stringify(first));const mark=badUtf8.indexOf(Buffer.from('Self-declared reader'));assert.ok(mark>=0);badUtf8[mark]=255;
   await page.locator('#import-record').setInputFiles({name:'bad-utf8.json',mimeType:'application/json',buffer:badUtf8});await page.waitForFunction(()=>/encoded data|encoding/i.test(document.querySelector('#error').textContent));assert.equal(await page.locator('#history-list>li').count(),3);
   // Explicit navigation to another case cannot reuse this case's record.
   await page.goto(base+'/review/?sample=secom_1363');await page.waitForSelector('#workspace:not([hidden])');assert.match(await page.locator('#history-status').textContent(),/pending/);await page.locator('#import-record').setInputFiles(saved2);await page.waitForSelector('#error:not([hidden])');assert.equal(await page.locator('#history-list>li').count(),0);
   await page.goBack();await page.waitForSelector('#workspace:not([hidden])');assert.match(await page.locator('#source-details').textContent(),/secom_1397/);await page.goForward();await page.waitForSelector('#workspace:not([hidden])');assert.match(await page.locator('#source-details').textContent(),/secom_1363/);assert.equal(await page.locator('#history-list>li').count(),0);

   assert.deepEqual(errors,[]);checks.push({width,recordImportExportKeyboardLanguagesThemesReload:'passed'});await page.close();
  }
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/review/source.json',r=>r.fulfill({body:'{}',contentType:'application/json'}));await page.goto(base+'/review/?sample=secom_1397');await page.waitForSelector('#error:not([hidden])');assert.equal(await page.locator('#workspace').isVisible(),false);assert.deepEqual(errors,[]);checks.push({sourceCorruptionFailClosed:'passed'});await page.close();
  const invalid=await browser.newPage();await invalid.goto(base+'/review/?sample=not-real');await invalid.waitForSelector('#error:not([hidden])');assert.equal(await invalid.locator('#workspace').isVisible(),false);await invalid.close();checks.push({unknownSample:'passed'});
 } finally {await browser.close();fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(checks,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
