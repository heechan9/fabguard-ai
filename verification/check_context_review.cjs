// Test-only installed Chrome + isolated Playwright, no downloaded browser or public URL.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const output=process.env.FABGUARD_UI_OUTPUT,width=Number(process.env.FABGUARD_UI_WIDTH||390);
fs.mkdirSync(output,{recursive:true});let browser,page;const errors=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8764'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:8764/equipment/context-review.html');
 await page.locator('#context-file').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'context-example');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#context-status').textContent.includes('3개 측정'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');
 assert.equal(await page.locator('#context-observations tr').count(),3);assert.equal(await page.locator('#context-history tr').count(),1);
 assert.match(await page.locator('#context-observations').innerText(),/판단 보류/);assert.match(await page.locator('#context-source').innerText(),/설명용 합성/);
 await page.screenshot({path:path.join(output,width+'-timeline.png'),fullPage:true});
 const p=JSON.parse(fs.readFileSync('web/equipment/data/maintenance-synthetic.json','utf8'));
 await page.locator('#review-target').selectOption(p.observations[1].review_id);
 assert.equal(await page.locator('#review-action option[value=release]').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#review-outcome option[value=false_alarm]').evaluate(e=>e.disabled),true);
 await page.locator('#review-role').fill('합성 검사 역할');await page.locator('#review-time').fill('2026-09-01T00:21:00Z');
 await page.locator('#review-add').press('Enter');assert.match(await page.locator('#context-error').innerText(),/이유/);assert.equal(await page.locator('#review-export').isDisabled(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'context-error');
 await page.locator('#review-reason').fill('합성 정비 이후 기준선 확인 전까지 보류');await page.locator('#review-add').press('Enter');assert.match(await page.locator('#review-count').innerText(),/초안 1건.*pending 2건/);
 await page.locator('#context-form').screenshot({path:path.join(output,width+'-review.png')});
 const downloadPromise=page.waitForEvent('download');await page.locator('#review-export').press('Enter');const download=await downloadPromise,decisionsPath=path.join(output,width+'-decisions.json');await download.saveAs(decisionsPath);
 const auditPath=path.join(output,width+'-audit.json');cp.execFileSync('python3',['-m','fabguard.maintenance_review','record','--input','examples/manufacturing/smt_synthetic_events.json','--history','examples/manufacturing/maintenance_history_synthetic.json','--package','web/equipment/data/maintenance-synthetic.json','--decisions',decisionsPath,'--recorded-at','2026-09-01T00:22:00Z','--output',auditPath],{env:{...process.env,PYTHONPATH:'src'},encoding:'utf8'});
 assert.deepEqual(JSON.parse(fs.readFileSync(auditPath,'utf8')).counts,{total:3,decided:1,pending:2});
 // Even manipulating the disabled option cannot bypass the decision validator.
 await page.locator('#review-action option[value=release]').evaluate(e=>e.disabled=false);await page.locator('#review-action').selectOption('release');await page.locator('#review-add').press('Enter');assert.match(await page.locator('#context-error').innerText(),/해제/);assert.match(await page.locator('#review-count').innerText(),/초안 1건/);
 const changed=structuredClone(p);changed.queue.items[1].value=0;
 await page.locator('#context-file').setInputFiles({name:'mismatched.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))});await page.waitForFunction(()=>document.querySelector('#context-error').textContent.length>0);assert.equal(await page.locator('#context-view').isVisible(),false);assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.locator('#context-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});await page.waitForFunction(()=>document.querySelector('#context-error').textContent.length>0);assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.locator('#context-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(5*1024*1024+1,32)});await page.waitForFunction(()=>document.querySelector('#context-error').textContent.includes('5MiB'));assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.locator('#context-file').setInputFiles('web/equipment/data/maintenance-synthetic.json');await page.waitForFunction(()=>document.querySelector('#context-view').hidden===false);assert.match(await page.locator('#review-count').innerText(),/초안 0건.*pending 3건/);assert.equal(await page.locator('#review-role').inputValue(),'');
 await page.locator('#context-clear').press('Enter');assert.equal(await page.locator('#context-form').isVisible(),false);assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('#context-example')).transitionDuration==='0s');
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),width,height:900,browser:browser.version(),status:'pass',errors,checks:['actual page and chart','no document overflow','Enter/Tab','reduced-motion preference','held controls and validator','empty reason/error focus','draft count','download -> source-recomputed Python audit 1 decided / 2 pending','mismatched evidence invalidates old drafts','invalid JSON','oversized file','file replacement and reset'],scope:'synthetic local context review only; no field or detection performance'},null,2));
 await browser.close();
})().catch(async e=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,width,errors},null,2));if(page)await page.screenshot({path:path.join(output,'failure.png'),timeout:10000,fullPage:true}).catch(()=>{});if(browser)await browser.close().catch(()=>{});console.error(e);process.exit(1);});
