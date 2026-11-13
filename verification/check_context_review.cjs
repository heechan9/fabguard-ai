// Test-only installed Chrome + isolated Playwright, no downloaded browser or public URL.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {createHash}=require('node:crypto');

function sourceProvenance(repo=process.cwd(),runGit=cp.spawnSync){
 const unknown={commit:'UNKNOWN',source_provenance:'unknown'};
 const root=fs.realpathSync(repo);
 const git=runGit('git',['rev-parse','--show-toplevel','HEAD'],{cwd:root,encoding:'utf8'});
 if(git.status!==0)return unknown;
 const [top,head]=git.stdout.trimEnd().split(/\r?\n/);
 if(path.resolve(top)!==root||!/^[0-9a-f]{40}$/.test(head??''))return unknown;
 return {commit:head,source_provenance:'git_head_only'};
}
module.exports={sourceProvenance};

if(require.main===module){
const {chromium}=require('playwright');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',origin=new URL(base).origin;
const output=process.env.FABGUARD_UI_OUTPUT,width=Number(process.env.FABGUARD_UI_WIDTH||390);
fs.mkdirSync(output,{recursive:true});let browser,page;const errors=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(new URL('/equipment/context-review.html',base).href);
 await page.locator('#context-file').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'context-example');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#context-status').textContent.includes('3개 측정'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');
 if(width<650){const scroll=page.locator('.context-scroll').first();await scroll.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.context-scroll').scrollLeft>0);await scroll.evaluate(e=>e.scrollLeft=0);}
 assert.equal(await page.locator('#context-observations tr').count(),3);assert.equal(await page.locator('#context-history tr').count(),1);
 assert.match(await page.locator('#context-observations').innerText(),/판단 보류/);assert.match(await page.locator('#context-source').innerText(),/설명용 합성/);
 await page.screenshot({path:path.join(output,width+'-timeline.png'),fullPage:true});
 const raw=fs.readFileSync('web/equipment/data/maintenance-synthetic.json');
 const p=JSON.parse(raw);
 const clear=p.observations.find(row=>row.context_state==='context_clear');
 assert.ok(clear);
 const outcome=page.locator('#review-outcome');
 await page.locator('#review-target').selectOption(clear.review_id);
 assert.deepEqual(await outcome.locator('option').evaluateAll(options=>options.map(option=>option.value)),['insufficient_evidence','confirmed_issue','false_alarm']);
 assert.equal(await outcome.locator('option[value=confirmed_issue]').innerText(),'확인한 문제 있음 (사용자 기록)');
 await outcome.selectOption('confirmed_issue');
 await page.locator('#review-role').fill('합성 검사 역할');
 await page.locator('#review-time').fill('2026-09-01T00:21:00Z');
 await page.locator('#review-reason').fill('합성 문제 확인');
 await page.locator('#review-add').press('Enter');
 const clearDownloadPromise=page.waitForEvent('download');
 await page.locator('#review-export').press('Enter');
 const clearDownload=await clearDownloadPromise;
 const clearPath=path.join(output,width+'-confirmed-issue.json');
 await clearDownload.saveAs(clearPath);
 const [confirmed]=JSON.parse(fs.readFileSync(clearPath,'utf8')).decisions;
 assert.equal(confirmed.review_id,clear.review_id);
 assert.equal(confirmed.outcome,'confirmed_issue');
 await page.locator('#review-remove').press('Enter');

 await page.locator('#review-target').selectOption(p.observations[1].review_id);
 assert.equal(await page.locator('#review-action option[value=release]').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#review-outcome option[value=false_alarm]').evaluate(e=>e.disabled),true);
 assert.equal(await outcome.locator('option[value=confirmed_issue]').evaluate(option=>option.disabled),true);

 // Check the optional note through the real browser, including its separate download.
 const summary=page.locator('#evidence-title');
 const guide=page.locator('#evidence-verification-guide');
 const plan=page.locator('#evidence-verification_plan');
 const reference=page.locator('#evidence-verification_evidence_ref');
 const memoExport=page.locator('#evidence-export');
 const planText='같은 조건의 전후 측정값을 비교하고 차이가 없으면 가설을 다시 검토합니다.';
 assert.equal(await guide.isVisible(),false);
 await summary.press('Enter');
 assert.equal(await guide.isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow with evidence note open');
 assert.equal(await plan.getAttribute('aria-describedby'),'evidence-verification-guide');
 assert.match(await guide.innerText(),/무엇과 비교.*가설을 다시 볼지.*검증 기록 참조/);
 await plan.fill(planText);
 await reference.fill('SYNTHETIC-EVIDENCE-01');
 const sites=page.locator('#evidence-sites');
 await sites.fill('1e1');
 await page.locator('#evidence-build').press('Enter');
 assert.match(await page.locator('#evidence-status').innerText(),/측정 위치 수는 1 이상의 정수/);
 assert.equal(await memoExport.isDisabled(),true);
 await sites.fill('');
 await page.locator('#evidence-build').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#evidence-export').disabled);
 const noteDownloadPromise=page.waitForEvent('download');
 await memoExport.press('Enter');
 const noteDownload=await noteDownloadPromise;
 assert.equal(noteDownload.suggestedFilename(),'context-evidence-annotation.json');
 const notePath=path.join(output,width+'-evidence-annotation.json');
 await noteDownload.saveAs(notePath);
 const note=JSON.parse(fs.readFileSync(notePath,'utf8'));
 assert.equal(note.context_package_sha256,createHash('sha256').update(raw).digest('hex'));
 assert.equal(note.review_id,p.observations[1].review_id);
 assert.equal(note.declared_annotation.verification_plan,planText);
 assert.equal(note.declared_annotation.verification_evidence_ref,'SYNTHETIC-EVIDENCE-01');
 assert.equal(note.declared_annotation.measurement_sites,null);
 assert.equal(note.source_context_state,'withheld');
 assert.equal(note.evidence_verification,'NOT_PERFORMED');
 assert.equal(note.operational_decision,'NOT_MADE');
 assert.match(await page.locator('#review-count').innerText(),/초안 0건.*pending 3건/);
 assert.equal(await page.locator('#review-export').isDisabled(),true);
 await plan.fill('변경한 합성 메모');
 assert.equal(await memoExport.isDisabled(),true);
 await summary.press('Enter');
 assert.equal(await guide.isVisible(),false);

 await page.locator('#review-role').fill('합성 검사 역할');await page.locator('#review-time').fill('2026-09-01T00:21:00Z');
 await page.locator('#review-add').press('Enter');assert.match(await page.locator('#context-error').innerText(),/이유/);assert.equal(await page.locator('#review-export').isDisabled(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'context-error');
 await page.locator('#review-reason').fill('합성 정비 이후 기준선 확인 전까지 보류');await page.locator('#review-add').press('Enter');assert.match(await page.locator('#review-count').innerText(),/초안 1건.*pending 2건/);
 await page.locator('#review-reason').fill('수정한 합성 근거');
 assert.equal(await page.locator('#review-export').isDisabled(),true);
 assert.match(await page.locator('#review-unsaved').innerText(),/저장하지 않은 변경/);
 await page.locator('#review-add').press('Enter');
 await page.locator('#context-form').screenshot({path:path.join(output,width+'-review.png')});
 const downloadPromise=page.waitForEvent('download');await page.locator('#review-export').press('Enter');const download=await downloadPromise,decisionsPath=path.join(output,width+'-decisions.json');await download.saveAs(decisionsPath);
 assert.equal(JSON.parse(fs.readFileSync(decisionsPath,'utf8')).decisions[0].rationale,'수정한 합성 근거');
 const auditPath=path.join(output,width+'-audit.json');cp.execFileSync('python3',['-m','fabguard.maintenance_review','record','--input','examples/manufacturing/smt_synthetic_events.json','--history','examples/manufacturing/maintenance_history_synthetic.json','--package','web/equipment/data/maintenance-synthetic.json','--decisions',decisionsPath,'--recorded-at','2026-09-01T00:22:00Z','--output',auditPath],{env:{...process.env,PYTHONPATH:'src'},encoding:'utf8'});
 assert.deepEqual(JSON.parse(fs.readFileSync(auditPath,'utf8')).counts,{total:3,decided:1,pending:2});
 // Even manipulating the disabled option cannot bypass the decision validator.
 await outcome.locator('option[value=confirmed_issue]').evaluate(option=>option.disabled=false);
 await outcome.selectOption('confirmed_issue');
 await page.locator('#review-add').press('Enter');
 assert.match(await page.locator('#context-error').innerText(),/보류/);
 assert.equal(await page.locator('#review-export').isDisabled(),true);
 await outcome.selectOption('insufficient_evidence');
 await page.locator('#review-action option[value=release]').evaluate(e=>e.disabled=false);await page.locator('#review-action').selectOption('release');await page.locator('#review-add').press('Enter');assert.match(await page.locator('#context-error').innerText(),/해제/);assert.match(await page.locator('#review-count').innerText(),/초안 1건/);
 const changed=structuredClone(p);changed.queue.items[1].value=0;
 await page.locator('#context-file').setInputFiles({name:'mismatched.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))});await page.waitForFunction(()=>document.querySelector('#context-error').textContent.length>0);assert.equal(await page.locator('#context-view').isVisible(),false);assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.locator('#context-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});await page.waitForFunction(()=>document.querySelector('#context-error').textContent.length>0);assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.locator('#context-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(5*1024*1024+1,32)});await page.waitForFunction(()=>document.querySelector('#context-error').textContent.includes('5MiB'));assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.locator('#context-file').setInputFiles('web/equipment/data/maintenance-synthetic.json');await page.waitForFunction(()=>document.querySelector('#context-view').hidden===false);assert.match(await page.locator('#review-count').innerText(),/초안 0건.*pending 3건/);assert.equal(await page.locator('#review-role').inputValue(),'');
 await page.locator('#context-clear').press('Enter');assert.equal(await page.locator('#context-form').isVisible(),false);assert.equal(await page.locator('#review-export').isDisabled(),true);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('#context-example')).transitionDuration==='0s');
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({base_url:base,...sourceProvenance(),width,height:900,browser:browser.version(),status:'pass',errors,checks:['actual page and chart','no document overflow','Enter/Tab and narrow-chart ArrowRight','reduced-motion preference and CSS change','held controls and validator','three outcome options, confirmed issue download on clear row, and rejection on held row','optional evidence guide opens by keyboard and links to plan input','separate annotation download bound to input bytes and held row','editing invalidates annotation download without creating a decision','blank and invalid measurement site count','empty reason/error focus','draft count and unsaved decision export guard','download -> source-recomputed Python audit 1 decided / 2 pending','mismatched evidence invalidates old drafts','invalid JSON','oversized file','file replacement and reset'],scope:'synthetic local context review only; no field or detection performance'},null,2));
 await browser.close();
})().catch(async e=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,width,errors},null,2));if(page)await page.screenshot({path:path.join(output,'failure.png'),timeout:10000,fullPage:true}).catch(()=>{});if(browser)await browser.close().catch(()=>{});console.error(e);process.exit(1);});
}
