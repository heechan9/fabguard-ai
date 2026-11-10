// Synthetic public fixture only. No equipment connection or field-performance claim.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8769';
const out=process.env.FABGUARD_UI_OUTPUT;
const root=path.resolve(__dirname,'..');
const csv=fs.readFileSync(path.join(root,'web/equipment/data/spc-synthetic.csv'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const checks=[],errors=[],network=[];
const sourceFiles=['web/equipment/index.html','web/equipment/app.mjs','web/equipment/contract.mjs','web/equipment/screening.mjs','web/equipment/screening-ui.mjs','web/equipment/spc-model.mjs','web/equipment/data/spc-synthetic.csv','verification/check_equipment_screening.cjs'];
async function bytesOf(download){const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
async function prepare(page,buffer=csv){
 await page.locator('#file').setInputFiles({name:'public-synthetic.csv',mimeType:'text/csv',buffer});
 await page.locator('#mapping-panel').waitFor();
 await page.locator('#equipment').fill('SYNTHETIC-SPI');
 await page.locator('#role').selectOption('synthetic');
}
async function screen(page){
 await page.locator('#screen').click();
 await page.getByRole('button',{name:'점검 목록 JSON 저장',exact:true}).waitFor();
 assert.equal(await page.locator('#result tbody tr').count(),2);
 assert.deepEqual(await page.locator('#result tbody tr td:last-child').allTextContents(),['pending','pending']);
}
async function saved(page,expectedBytes){
 const wait=page.waitForEvent('download');
 await page.getByRole('button',{name:'점검 목록 JSON 저장',exact:true}).click();
 const download=await wait;
 assert.equal(download.suggestedFilename(),'fabguard-equipment-screening.json');
 const payload=JSON.parse((await bytesOf(download)).toString('utf8'));
 assert.equal(payload.schema_version,'fabguard-equipment-csv-screening/v1');
 assert.equal(payload.source_sha256,sha(expectedBytes));
 assert.equal(payload.source_role,'synthetic');
 assert.equal(payload.sample_count,13);assert.equal(payload.baseline_count,10);
 assert.equal(payload.spc.center,100);
 assert.deepEqual(payload.queue.map(r=>[r.record,r.board_id,r.screening_status,r.review_status]),[[12,'DEMO-012','above_limit','pending'],[13,'DEMO-013','below_limit','pending']]);
 assert.match(payload.claim_boundary,/no authenticated reviewer, equipment connection, defect diagnosis or control action/);
 return payload;
}
(async()=>{
 assert.ok(out,'FABGUARD_UI_OUTPUT is required');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 try{
  for(const width of [1366,390,360])for(const theme of ['dark','silver']){
   const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
   await context.addInitScript(value=>localStorage.setItem('fabguard-theme',value),theme);
   const page=await context.newPage();page.setDefaultTimeout(10000);
   page.on('pageerror',error=>errors.push({width,theme,message:error.message}));
   page.on('request',request=>{if(['xhr','fetch'].includes(request.resourceType()))network.push({method:request.method(),url:request.url()});});
   await page.goto(base+'/equipment/');
   assert.equal(await page.title(),'FabGuard · 장비 CSV 오프라인 점검');
   assert.equal(await page.locator('h1').innerText(),'장비 CSV 오프라인 점검');
   assert.match(await page.locator('.notice').first().innerText(),/실장비 진위·제품 불량·현장 효과는 검증하지 않습니다/);
   // Use the page's downloadable public fixture, then the real file-input route.
   const fixtureWait=page.waitForEvent('download');
   await page.getByRole('link',{name:'SPC 연결 합성 CSV 내려받기'}).click();
   assert.deepEqual(await bytesOf(await fixtureWait),csv);
   await prepare(page);
   await page.locator('#validate').click();
   assert.match(await page.locator('#result').innerText(),/형식 통과 13행 \/ 격리 0행/);
   await screen(page);await saved(page,csv);await saved(page,csv);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#result').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,`equipment-${width}-${theme}.png`),fullPage:true});
   checks.push(`${width}/${theme}: real upload, validation, frozen SPC, repeated pending JSON downloads, SHA-256 and reflow`);
   const changes=[
    ['equipment',()=>page.locator('#equipment').fill('SYNTHETIC-CHANGED')],
    ['source role',()=>page.locator('#role').selectOption('public')],
    ['metric',()=>page.locator('#metric').selectOption('paste_volume_pct')],
    ['baseline',()=>page.locator('#baseline-count').fill('11')],
    ...['board_id','pad_id','value','timestamp','lot_id','recipe_id'].map(field=>['mapping '+field,()=>page.locator('#map-'+field).selectOption('')]),
   ];
   for(const [name,change] of changes){
    await prepare(page);await screen(page);await change();
    assert.equal(await page.locator('#result').innerText(),'',name+' invalidates result');
    assert.equal(await page.getByRole('button',{name:'점검 목록 JSON 저장',exact:true}).count(),0);
   }
   checks.push(`${width}/${theme}: all six mappings, equipment, role, metric and baseline invalidate old output`);
   // Hash must match uploaded bytes, not a re-encoded or newline-normalised CSV.
   const bomCRLF=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(csv.toString('utf8').replace(/\n/g,'\r\n'))]);
   assert.notEqual(sha(bomCRLF),sha(csv));
   await prepare(page,bomCRLF);await screen(page);await saved(page,bomCRLF);
   checks.push(`${width}/${theme}: BOM/CRLF raw-byte SHA-256 retained`);
   // Invalid replacement and clear both remove the previous export path.
   await page.locator('#file').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from([255,254,255])});
   assert.equal(await page.locator('#result').innerText(),'');
   await page.waitForFunction(()=>document.querySelector('#file-status').textContent.length>0);
   assert.equal(await page.locator('#mapping-panel').isVisible(),false);
   await prepare(page);await screen(page);await page.locator('#clear').click();
   assert.equal(await page.locator('#result').innerText(),'');assert.equal(await page.locator('#mapping-panel').isVisible(),false);
   // Exercise the pending hash race with a deterministic gate, not a short timer.
   await prepare(page);await screen(page);
   await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);window.hashStarted=false;crypto.subtle.digest=(...args)=>{window.hashStarted=true;return new Promise(resolve=>{window.finishHash=async()=>{crypto.subtle.digest=original;resolve(await original(...args));};});};});
   const downloads=[];page.on('download',download=>downloads.push(download.suggestedFilename()));
   await page.getByRole('button',{name:'점검 목록 JSON 저장',exact:true}).click();
   await page.waitForFunction(()=>window.hashStarted);
   await page.locator('#equipment').fill('SYNTHETIC-NEW');
   await page.evaluate(async()=>{await window.finishHash();await new Promise(resolve=>setTimeout(resolve,100));});
   assert.equal(await page.locator('#result').innerText(),'');assert.deepEqual(downloads,[]);
   // Recovery after invalidation must produce only the new report.
   await prepare(page);await screen(page);await saved(page,csv);
   checks.push(`${width}/${theme}: invalid file/clear and in-flight hash invalidation; fresh run recovers`);
   await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[],'equipment input must not issue fetch/XHR');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),testedFiles:Object.fromEntries(sourceFiles.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),browser:browser.version(),base,status:'pass',checks,errors,network,scope:'Synthetic local CSV behavior only. No production deployment, real equipment, physical handset or screen-reader validation.'},null,2)+'\n');
  console.log(`PASS: ${checks.length} equipment flow groups across 3 widths and 2 themes`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
