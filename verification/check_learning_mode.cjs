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
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,...(process.env.FABGUARD_BROWSER_PATH?{executablePath:process.env.FABGUARD_BROWSER_PATH}:{})});
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
  for(let i=0;i<4;i++){
   await page.locator(`[data-action="lesson-${i}"]`).click();
   await page.locator('[data-action="check"]').click();
   assert.equal(await page.locator('input[name="choice"]').first().evaluate(el=>el===el.getRootNode().activeElement),true);
   await page.locator('[data-action="hint"]').click();await page.locator('[data-action="hint"]').click();await page.locator('[data-action="hint"]').click();
   assert.equal(await page.locator('#hints p').count(),2);
   await page.locator('input[name="choice"]').nth([0,1,1,0][i]).check();await page.locator('input[name="reason"]').nth([0,1,1,0][i]).check();
   await page.locator('[data-action="check"]').click();assert.equal(await page.locator('#explanation-title').isVisible(),true);
   // Exercise the new native disclosures, not only the existing learning flow.
   const note=page.locator('.review-note'), reference=page.locator('.review-reference');
   assert.equal(await note.evaluate(el=>el.open),false);
   assert.equal(await reference.evaluate(el=>el.open),false);
   await note.locator(':scope > summary').focus();await page.keyboard.press('Enter');
   assert.equal(await note.evaluate(el=>el.open),true);
   assert.equal(await note.locator(':scope > summary').evaluate(el=>el===el.getRootNode().activeElement),true);
   await reference.locator(':scope > summary').focus();await page.keyboard.press('Space');
   assert.equal(await reference.evaluate(el=>el.open),true);
   assert.equal(await reference.locator(':scope > summary').evaluate(el=>el===el.getRootNode().activeElement),true);
   const assertReviewOpen=async()=>{assert.equal(await note.evaluate(el=>el.open),true);assert.equal(await reference.evaluate(el=>el.open),true);};
   await page.locator('[data-action="hint"]').click();await assertReviewOpen();
   assert.equal(await page.locator('[data-action="hint"]').evaluate(el=>el===el.getRootNode().activeElement),true);
   await page.locator('#language').click();await assertReviewOpen();
   assert.equal(await page.locator('#fabguard-learning-host').getAttribute('lang'),language==='ko'?'en':'ko');
   assert.ok((await note.innerText()).includes(language==='ko'?'This is a review after seeing the explanation above.':'위 해설을 이미 본 뒤의 복습입니다.'));
   // Clicking language can focus it natively; do not claim focus restoration here.
   await page.locator('#language').click();await assertReviewOpen();
   assert.ok((await note.innerText()).includes(language==='ko'?'위 해설을 이미 본 뒤의 복습입니다.':'This is a review after seeing the explanation above.'));
   await page.locator('input[name="choice"]').nth([1,0,0,1][i]).check();await assertReviewOpen();
   assert.equal(await page.locator('input[name="choice"]').nth([1,0,0,1][i]).evaluate(el=>el===el.getRootNode().activeElement),true);
   await page.locator('[data-action="reveal"]').click();await assertReviewOpen();
   assert.equal(await page.locator('#explanation-title').evaluate(el=>el===el.getRootNode().activeElement),true);
   await page.locator('input[name="transfer"]').nth([1,0,1,0][i]).check();await page.locator('[data-action="transfer"]').click();await assertReviewOpen();
   assert.equal(await page.locator('#transfer-explanation').evaluate(el=>el===el.getRootNode().activeElement),true);
   // Confirm updates records only; this is a no-disturbance check, not stage-rerender evidence.
   await page.locator('[data-action="confirm"]').click();await assertReviewOpen();
   // Closing an outer disclosure must not reopen it on same-case rerender.
   await note.locator(':scope > summary').focus();await page.keyboard.press('Enter');
   await page.locator('[data-action="hint"]').click();assert.equal(await note.evaluate(el=>el.open),false);assert.equal(await reference.evaluate(el=>el.open),true);
   await note.locator(':scope > summary').click();
   const geometry=await dialog.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,rect:el.getBoundingClientRect().width,viewport:innerWidth}));
   assert.ok(geometry.scroll<=geometry.client+1,JSON.stringify(geometry));assert.ok(geometry.rect<=geometry.viewport,JSON.stringify(geometry));
   if(i===0){const filename=tag+'.png';await page.screenshot({path:path.join(out,filename),fullPage:false});report.screenshots.push(filename);}
   await page.locator('[data-action="back-map"]').click();
  }
  // The preceding Back to concept map action focuses its heading. Use actual
  // keys, not locator.focus(), to reach and activate the fourth lesson.
  const focused=locator=>locator.evaluate(el=>el===el.getRootNode().activeElement);
  assert.equal(await focused(page.locator('#stage-title')),true);
  for(let i=0;i<4;i++){
   await page.keyboard.press('Tab');
   assert.equal(await focused(page.locator(`[data-action="lesson-${i}"]`)),true,`${tag}: Tab to lesson ${i+1}`);
  }
  await page.keyboard.press('Enter');
  await page.locator('#stage-title').waitFor({state:'visible'});
  assert.match(await page.locator('#stage-title').innerText(),language==='ko'?/로봇 신호/:/How far did the robot signal travel/);
  assert.equal(await focused(page.locator('#stage-title')),true);
  await page.keyboard.press('Tab');
  assert.equal(await focused(page.locator('input[name="choice"]').first()),true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('input[name="choice"]').nth(1).isChecked(),true);
  await page.keyboard.press('Tab');
  assert.equal(await focused(page.locator('input[name="reason"]').first()),true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('input[name="reason"]').nth(1).isChecked(),true);
  await page.keyboard.press('Tab');
  assert.equal(await focused(page.locator('[data-action="check"]')),true);
  await page.keyboard.press('Enter');
  await page.locator('#explanation-title').waitFor({state:'visible'});
  assert.equal(await focused(page.locator('#explanation-title')),true);
  const robotFeedback=await page.locator('.feedback').innerText();
  assert.ok(robotFeedback.includes(language==='ko'?'선택한 항목 또는 이유를 아래 근거와 다시 비교해 보세요.':'Compare your selected item or reason with the evidence below.'));
  assert.ok(robotFeedback.includes(language==='ko'?'같은 작업·시도 ID·시간 범위로 기존 송신·수신 로그를 대조합니다.':'Compare existing send and receipt logs for the same cycle, attempt ID and time window.'));
  const robotGeometry=await dialog.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,rect:el.getBoundingClientRect().width,viewport:innerWidth}));
  assert.equal(robotGeometry.viewport,width);
  assert.ok(robotGeometry.scroll<=robotGeometry.client+1&&robotGeometry.rect<=width,JSON.stringify(robotGeometry));
  // Scroll the robot case heading into view so the screenshot actually names the
  // tested case instead of inheriting the generic end-of-review position.
  const filename='robot-'+tag+'.png';
  await page.locator('#stage-title').evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(out,filename),fullPage:false});
  report.screenshots.push(filename);
  await page.locator('[data-action="skip-case"]').click();
  assert.equal(await page.locator('[data-action="lesson-3"]').isVisible(),true);
  assert.equal(await focused(page.locator('#stage-title')),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-learning-v1')),null);
  await page.locator('#save').click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fabguard-learning-v1')));
  assert.equal(saved.records.length,4);assert.ok(saved.records.every(row=>row.checked));
  for(const row of saved.records)assert.deepEqual(Object.keys(row).sort(),['checked','concept','evidence','misconception','source']);
  await page.locator('#reset').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#reset-dialog').isVisible(),false);assert.equal(await dialog.isVisible(),true);
  assert.equal(await page.locator('#reset').evaluate(el=>el===el.getRootNode().activeElement),true);
  await page.locator('#exit').click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#open-learning').evaluate(el=>el===document.activeElement),true);
  await page.locator('#open-learning').click();await page.locator('#language').click();await page.locator('#language').click();
  await page.locator('[data-action="lesson-0"]').click();await page.locator('[data-action="reveal"]').click();
  await page.locator('.review-note > summary').click();await page.locator('.review-reference > summary').click();
  assert.equal(await page.locator('.review-reference').evaluate(el=>el.open),true);
  await page.locator('#reset').click();await page.locator('#confirm-reset').click();assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-learning-v1')),null);
  assert.equal(await page.locator('#stage input[type="radio"]').count(),8);
  await page.locator('[data-action="skip-probe"]').click();await page.locator('[data-action="lesson-0"]').click();await page.locator('[data-action="reveal"]').click();
  assert.equal(await page.locator('.review-note').evaluate(el=>el.open),false);assert.equal(await page.locator('.review-reference').evaluate(el=>el.open),false);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.id==='open-learning');
  // Escape/reopen retains the current lesson, so no probe button is present.
  await page.locator('#open-learning').click();
  await page.locator(`#stage a[href="/?lang=${language}#limitations"]`).click();await page.waitForURL(`**/?lang=${language}#limitations`);assert.equal(await dialog.isVisible(),false);
  await page.goBack();assert.equal(await dialog.isVisible(),false);await page.goForward();assert.equal(await dialog.isVisible(),false);
  report.checks.push({tag,status:'pass',flows:'4 cases, prediction/reason, 2 bounded hints, reveal, transfer, self-check, save, reset cancel/confirm, close/reopen, language, internal navigation, back/forward, no horizontal overflow; review disclosures: programmatic summary focus + Enter/Space activation (not Tab reachability); same-case open-state preservation after hint/language/choice/reveal/transfer; confirm record-update no-disturbance; closed-state preservation; case/reset clearing; post-explanation wording; actual Tab and Enter to robot case, wrong prediction and reason by keyboard with localized feedback/next check, robot screenshot and width, final skip returns to map, Escape restores opener'});
  await context.close();
 }
 // Full production mount/DOM escaping checks, separate from source-extracted unit tests.
 for(const language of ['ko','en'])for(const field of ['observation','limit','next']){
  const context=await browser.newContext({viewport:{width:390,height:900}});
  const page=await context.newPage();const tag=`escaping-${language}-${field}`;
  page.on('pageerror',error=>report.errors.push({tag,error:String(error)}));
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  await page.goto(base+'/?lang='+language+'#summary');
  const payload='<em data-review-injection="probe">synthetic & "quoted" \'text\'</em>';
  // In-memory fixture only in this isolated page context; source files are untouched.
  await page.evaluate(async({language,field,payload})=>{const {lessons}=await import('/learn/content.mjs');lessons[0][field][language]=payload;},{language,field,payload});
  await page.locator('#open-learning').click();await page.locator('[data-action="skip-probe"]').click();await page.locator('[data-action="lesson-0"]').click();await page.locator('[data-action="reveal"]').click();
  await page.locator('.review-note > summary').click();await page.locator('.review-reference > summary').click();
  assert.equal(await page.locator('.review-reference dd').nth(['observation','limit','next'].indexOf(field)).textContent(),payload);
  assert.equal(await page.locator('[data-review-injection]').count(),0);
  report.checks.push({tag,status:'pass',flows:'full production mount: injected synthetic field rendered as literal text, no injected element'});
  await context.close();
 }
 assert.equal(report.externalAfterOpen.length,0);assert.equal(report.errors.length,0);
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:report.checks.length,report:path.join(out,'receipt.json')}));
})().catch(async error=>{fs.writeFileSync(path.join(out,'blocked-or-failed.json'),JSON.stringify({error:String(error),status:'blocked_or_failed',complete:false},null,2)+'\n');console.error(error);await browser?.close();process.exitCode=1});
