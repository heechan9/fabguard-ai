// Run only with an installed, permitted browser. No browser download or external URL creation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764';
const output=process.env.FABGUARD_UI_OUTPUT;
if(!output)throw Error('FABGUARD_UI_OUTPUT required');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 const original=fs.readFileSync('docs/review/pr173-validation-20261024/robot_spc_results/report.json');
 const expectedHash=crypto.createHash('sha256').update(original).digest('hex');
 const widths=process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,360,390];
 assert.ok(widths.every(width=>[1366,360,390].includes(width)));
 try{for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base+'/robot/');await page.locator('#offline-results[data-status=verified]').waitFor();
  assert.equal(await page.locator('#offline-results tbody tr').count(),7);
  assert.match(await page.locator('#offline-results').innerText(),/9 · 0 · 3/);
  assert.match(await page.locator('#offline-results').innerText(),/null/);
  assert.match(await page.locator('#offline-title').innerText(),/저장된 분석 보고서/);
  assert.ok((await page.locator('#offline-results').innerText()).includes(expectedHash));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const wrap=page.locator('#offline-results .table-wrap');await wrap.focus();
  assert.equal(await wrap.evaluate(e=>e===document.activeElement),true);
  if(width<650){await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#offline-results .table-wrap').scrollLeft>0);}
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('download')),true);
  const pendingDownload=page.waitForEvent('download');await page.keyboard.press('Enter');
  const download=await pendingDownload,downloadPath=path.join(output,`report-${width}.json`);await download.saveAs(downloadPath);
  const downloaded=fs.readFileSync(downloadPath);assert.deepEqual(downloaded,original);
  const report=JSON.parse(downloaded),tableRows=await page.locator('#offline-results tbody tr').allTextContents();
  for(const [i,file] of report.evaluation_files.entries()){
   const cells=await page.locator('#offline-results tbody tr').nth(i).locator('td').allTextContents();
   assert.ok(tableRows[i].includes(file.file_id));assert.ok(tableRows[i].includes(file.recording_group));
   assert.deepEqual(cells.slice(-3),['shewhart','ewma','cusum'].map(m=>String(file.methods[m].raw_alarms)));
  }
  await wrap.evaluate(e=>e.scrollLeft=0);await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(output,`offline-${width}.png`),fullPage:true});
  await page.locator('.offline-evidence').screenshot({path:path.join(output,`report-card-${width}.png`)});
  // Corrupt only the test response, keeping application code unchanged: hash mismatch must withhold.
  for(const kind of ['malformed-json','missing-file']){
   await page.route('**/offline-report-data.mjs',r=>kind==='missing-file'
    ?r.fulfill({status:404,body:'not found'})
    :r.fulfill({contentType:'text/javascript',body:'export const REPORT_TEXT="{broken json";'}));
   await page.reload();await page.locator('#offline-results[data-status=withheld]').waitFor();
   assert.equal(await page.locator('#offline-results table').count(),0);
   assert.match(await page.locator('#offline-results').innerText(),/파일 누락·형식 오류·해시 불일치/);
   await page.locator('#synthetic').click();await page.locator('#file-table').waitFor({state:'visible'});
   await page.screenshot({path:path.join(output,`${kind}-${width}.png`),fullPage:true});
   await page.unroute('**/offline-report-data.mjs');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));await context.close();
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({status:'pass',commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),widths,browser:browser.version(),report_sha256:expectedHash,checks:['download bytes = historical report','table rows = downloaded JSON','visible hash','7 file rows','null performance','overflow','keyboard table/scroll/download Enter','reduced motion','malformed JSON withheld','missing file withheld','CSV demo still works after errors'],scope:'stored exploratory report display only'},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
