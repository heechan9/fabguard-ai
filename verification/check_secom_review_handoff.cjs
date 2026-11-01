const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8769';
const output=path.join(process.env.FABGUARD_UI_OUTPUT||'/tmp/secom-review-browser','handoff');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.FABGUARD_BROWSER_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),checks=[];
 try{
  for(const width of [1366,390,360]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(base+'/review/?sample=secom_1397');await page.waitForSelector('#export-handoff');
   assert.equal(await page.locator('#handoff-host fieldset').count(),5);
   await page.locator('#handoff-physical_mapping').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'handoff-role-physical_mapping');
   await page.locator('#handoff-role-physical_mapping').selectOption('equipment');await page.locator('#handoff-note-physical_mapping').fill('<img src=x onerror=alert(1)> mapping requested');
   await page.locator('#language-toggle').click();assert.match(await page.locator('#handoff-title').textContent(),/Additional evidence/);assert.match(await page.locator('#handoff-note-physical_mapping').inputValue(),/<img/);assert.equal(await page.locator('#handoff-host img').count(),0);
   const download=page.waitForEvent('download');await page.locator('#export-handoff').focus();await page.keyboard.press('Enter');const file=await download,saved=path.join(output,`${width}-handoff.json`);await file.saveAs(saved);const packet=JSON.parse(fs.readFileSync(saved));assert.equal(packet.readiness,'not_validated');assert.equal(packet.checklist[0].state,'requested');assert.equal(packet.unresolved.length,5);
   await page.reload();await page.waitForSelector('#export-handoff');await page.locator('#language-toggle').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.locator('#import-handoff').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#handoff-status').textContent.includes('loaded'));assert.match(await page.locator('#handoff-note-physical_mapping').inputValue(),/mapping requested/);
   const corrupt=structuredClone(packet);corrupt.readiness='approved';await page.locator('#import-handoff').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupt))});await page.waitForFunction(()=>document.querySelector('#handoff-status').textContent.includes('withheld'));assert.match(await page.locator('#handoff-note-physical_mapping').inputValue(),/mapping requested/);
   await page.locator('#theme-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(output,`${width}-handoff.png`),fullPage:true});
   // An unrecorded legacy form must not silently disappear from a packet.
   await page.locator('#rationale').fill('Unrecorded draft');await page.locator('#export-handoff').click();await page.waitForFunction(()=>document.querySelector('#handoff-status').textContent.includes('Append existing'));
   assert.equal(await page.locator('#rationale').inputValue(),'Unrecorded draft');assert.deepEqual(errors,[]);checks.push({width,keyboardLanguagesThemesRoundtripInvalidImportDraftGuard:'passed'});await page.close();
  }
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('**/review/handoff-ui.mjs',r=>r.fulfill({status:404,body:'missing'}));await page.goto(base+'/review/?sample=secom_1397');await page.waitForFunction(()=>/표시 보류|display withheld/.test(document.querySelector('#handoff-host').textContent));
  await page.locator('#reviewer-role').fill('Reader');await page.locator('#rationale').fill('Original note still works');await page.locator('#available-evidence').fill('Saved score');await page.locator('#missing-evidence').fill('Field log');await page.locator('#set-now').click();await page.locator('#add-record').click();await page.waitForFunction(()=>document.querySelectorAll('#history-list>li').length===1);assert.deepEqual(errors,[]);checks.push({missingHandoffRendererLegacyReviewPreserved:'passed'});await page.close();
 }finally{await browser.close();fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(checks,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
