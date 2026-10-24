// Local-only Playwright verification, explicitly authorised by the owner.
// Requires Playwright in the test environment; it is not a product dependency.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const base=process.env.FABGUARD_LOCAL_URL||'http://127.0.0.1:8764';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local host required');
const root=path.resolve(__dirname,'..');
const out=process.env.FABGUARD_UI_OUTPUT||path.join(root,'docs/review/pr173-validation-20261024/local_ui');
fs.mkdirSync(out,{recursive:true});
const checks=[], shots=[], pageErrors=[], externalRequests=[];
const expectedHead='bf8221462a1d7a7d532ed12dd6e08bc91b28336b';
const sourceFiles=['web/robot/app.mjs','web/robot/contract-feedback.mjs','web/robot/index.html','web/robot/style.css'];
const testedBlobs=Object.fromEntries(sourceFiles.map(p=>[p,execFileSync('git',['hash-object',p],{cwd:root,encoding:'utf8'}).trim()]));
async function check(name,fn){try{await fn();checks.push({name,status:'pass'});console.log('PASS',name)}catch(e){checks.push({name,status:'fail',error:e.message});console.log('FAIL',name,e.message)}}
async function capture(page,name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});shots.push(name+'.png')}
async function dimensions(page){return page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}))}
async function focus(page){return page.evaluate(()=>document.activeElement.id)}
async function fresh(page){await page.goto(base+'/robot/');await page.locator('#synthetic').waitFor();}
async function locked(page){await page.locator('#period').fill('0.001');await page.locator('#lock').click();}
(async()=>{
 const {syntheticFiles,toCSV}=await import(pathToFileURL(path.join(root,'web/robot/synthetic.mjs')).href);
 const browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1366,height:900},{width:390,height:844},{width:360,height:800}]){
  const tag=String(viewport.width);
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<500,isMobile:viewport.width<500});
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push({viewport:tag,message:e.message}));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(base).origin)return route.continue();externalRequests.push({viewport:tag,origin:u.origin});return route.abort();});
  await fresh(page);
  await check(tag+' robot initial layout',async()=>{const d=await dimensions(page);assert.ok(d.document<=d.viewport,JSON.stringify(d));await capture(page,tag+'-robot-initial');});
  await check(tag+' empty period error focus',async()=>{await page.locator('#lock').click();assert.equal(await focus(page),'period');assert.equal(await page.locator('#period').getAttribute('aria-invalid'),'true');assert.match(await page.locator('#contract-status').innerText(),/nominal_period_s/)});
  await check(tag+' minimum samples marks correct control',async()=>{await page.locator('#period').fill('0.001');await page.locator('#min-samples').fill('999');await page.locator('#lock').click();assert.equal(await focus(page),'min-samples');assert.equal(await page.locator('#min-samples').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#period').getAttribute('aria-invalid'),null);await capture(page,tag+'-contract-error');});
  await check(tag+' tolerance and gap errors',async()=>{await page.locator('#min-samples').fill('45');await page.locator('#tolerance').fill('0');await page.locator('#gap').fill('1');await page.locator('#lock').click();assert.equal(await focus(page),'tolerance');for(const id of ['tolerance','gap'])assert.equal(await page.locator('#'+id).getAttribute('aria-invalid'),'true');});
  await check(tag+' lock clears errors and preserves keyboard focus',async()=>{await page.locator('#tolerance').fill('0.05');await page.locator('#gap').fill('3');await page.locator('#lock').click();assert.equal(await focus(page),'unlock');assert.equal(await page.locator('#lock').isDisabled(),true);assert.equal(await page.locator('#period').getAttribute('aria-invalid'),null);assert.equal(await page.locator('#period').getAttribute('aria-describedby'),'period-help');});
  await check(tag+' unlock enables period and moves focus',async()=>{await page.locator('#unlock').press('Enter');assert.equal(await focus(page),'period');assert.equal(await page.locator('#period').isEnabled(),true);assert.equal(await page.locator('#files').isDisabled(),true);});
  await check(tag+' synthetic calculation keeps performance null',async()=>{await page.locator('#synthetic').click();await page.locator('#file-table tbody tr').nth(3).waitFor();await page.locator('#run').click();await page.locator('#run-results').waitFor();assert.match(await page.locator('#run-status').innerText(),/exploratory_alarm_activity_only/);for(const name of ['detection_delay','anomaly_recall','miss_rate','false_alarm_rate'])assert.match(await page.locator('#run-results').innerText(),new RegExp(name));assert.equal(await page.locator('#run-results table').last().locator('td').allTextContents().then(x=>x.every(t=>t.startsWith('null'))),true);const d=await dimensions(page);assert.ok(d.document<=d.viewport,JSON.stringify(d));await page.locator('#run-status').scrollIntoViewIfNeeded();await capture(page,tag+'-synthetic-results');});
  await check(tag+' hash mismatch removes previous results',async()=>{await page.getByLabel('SYNTHETIC_evA_dataLog_1 예상 SHA-256',{exact:true}).fill('0'.repeat(64));assert.equal(await page.locator('#run-results').innerText(),'');await page.locator('#run').click();assert.match(await page.locator('#run-status').innerText(),/source_verification_failed/);assert.equal(await page.locator('#run-results table').count(),0)});
  await check(tag+' invalid reference timestamp fails closed',async()=>{await page.locator('#synthetic-error').click();await page.locator('#file-table tbody tr').nth(3).waitFor();await page.locator('#run').click();assert.match(await page.locator('#run-results').innerText(),/reference_file_invalid/);assert.equal(await page.locator('#run-results table').count(),0)});
  await check(tag+' user CSV upload valid fields and missing-role rejection',async()=>{await page.locator('#clear').click();const f=syntheticFiles('demo')[0];await page.locator('#files').setInputFiles({name:f.fileId+'.csv',mimeType:'text/csv',buffer:Buffer.from(toCSV(f))});await page.locator('#file-table tbody tr').waitFor();assert.match(await page.locator('#input-status').innerText(),/무효 0개/);await page.locator('#run').click();assert.match(await page.locator('#run-status').innerText(),/invalid_manifest/);});
  const badCases=[
   ['wrong-header',Buffer.from('time,x,y,z\n0,1,0,0\n0.001,1,0,0\n'),'column_schema_mismatch'],
   ['bad-time',Buffer.from('Time,A_x [g],A_y [g],A_z [g]\nNaN,1,0,0\n0.001,1,0,0\n'),'time_nonfinite_or_nonnumeric'],
   ['invalid-utf8',Buffer.from([255,254,255]),'디코딩|UTF|csv_rejected'],
   ['over-5mb',Buffer.alloc(5*1024*1024+1,65),'5MB'],
   ['over-20000-rows',Buffer.from('Time,A_x [g],A_y [g],A_z [g]\n'+Array.from({length:20001},(_,i)=>`${i/1000},1,0,0`).join('\n')),'20,000|20000|rows|행']
  ];
  for(const [name,buffer,reason] of badCases)await check(tag+' rejects '+name,async()=>{await page.locator('#files').setInputFiles({name:name+'.csv',mimeType:'text/csv',buffer});await page.waitForFunction(()=>document.querySelector('#input-status').textContent.includes('무효 1개'));assert.match(await page.locator('#window-results').innerText(),new RegExp(reason));});
  await check(tag+' clear and unlock leave no stale files or results',async()=>{await page.locator('#clear').click();await page.locator('#unlock').click();assert.equal(await page.locator('#file-table tbody tr').count(),0);assert.equal(await page.locator('#run-results').innerText(),'');assert.equal(await page.locator('#run').isDisabled(),true);assert.equal(await focus(page),'period');});
  await check(tag+' skip link keyboard',async()=>{await page.goto(base+'/robot/');await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal(await focus(page),'robot-main');});
  await page.goto(base+'/secom/research.html');
  await check(tag+' SECOM layout and keyboard filter',async()=>{await page.locator('#summary-table tbody tr').nth(12).waitFor();const d=await dimensions(page);assert.ok(d.document<=d.viewport,JSON.stringify(d));await page.locator('#family-filter').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#summary-table tbody tr').count(),4);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'region');await capture(page,tag+'-secom-filter');});
  await page.goto(base+'/research/');
  await check(tag+' research overview layout',async()=>{const d=await dimensions(page);assert.ok(d.document<=d.viewport,JSON.stringify(d));assert.match(await page.locator('main').innerText(),/実|실제 로봇 검증 결과는 아닙니다/);await capture(page,tag+'-research-overview');});
  await context.close();
 }
 const report={tested_remote_commit:expectedHead,tested_local_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),testedBlobs,browser:await browser.version(),viewports:[{width:1366,height:900},{width:390,height:844},{width:360,height:800}],network:'loopback only; external font requests blocked, fallback font layout',checks,pageErrors,externalRequests,screenshots:shots,summary:{passed:checks.filter(x=>x.status==='pass').length,failed:checks.filter(x=>x.status==='fail').length},limitations:['Local Chromium, not Vercel deployment verification','Touch-capable mobile emulation, not a physical phone','No screen reader user testing','No SPC performance evaluation or real equipment control']};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');await browser.close();if(report.summary.failed||pageErrors.length)process.exitCode=1;
})().catch(e=>{fs.writeFileSync(path.join(out,'fatal.json'),JSON.stringify({error:e.stack,checks},null,2));console.error(e);process.exitCode=1});
