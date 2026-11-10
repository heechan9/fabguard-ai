// Real-browser acceptance checks for the saved-data command center. No model calls.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',output=path.join(process.env.FABGUARD_UI_OUTPUT,'command-center');
fs.mkdirSync(output,{recursive:true});
const risks=JSON.parse(fs.readFileSync('web/data/priority_top50.json','utf8'));
const results=[];let browser,page;
async function audit(width,mode,lang){
 const info=await page.evaluate(()=>{
  const rgba=s=>{const c=(s.match(/[\d.]+/g)||[]).map(Number);if(c.length===3)c.push(1);return c;};
  const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const contrast=[];
  for(const el of document.querySelectorAll('body *')){
   if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||!el.getClientRects().length||el.closest('svg'))continue;
   const s=getComputedStyle(el);if(s.visibility==='hidden'||Number(s.opacity)<1)continue;
   const layers=[];let p=el;
   while(p){const c=rgba(getComputedStyle(p).backgroundColor);layers.push(c);if(c[3]===1)break;p=p.parentElement;}
   let bg=[255,255,255,1];for(const c of layers.reverse())bg=[...c.slice(0,3).map((v,i)=>v*c[3]+bg[i]*(1-c[3])),1];
   const ink=rgba(s.color),fg=ink.slice(0,3).map((v,i)=>v*ink[3]+bg[i]*(1-ink[3]));
   const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
   if(ratio<(large?3:4.5))contrast.push({text:el.textContent.trim().slice(0,80),ratio,color:s.color,bg});
  }
  return {scrollWidth:document.documentElement.scrollWidth,innerWidth,contrast,images:[...document.querySelectorAll('.cc-stage img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.getAttribute('src')})),navWrap:getComputedStyle(document.querySelector('.cc-navigation')).flexWrap};
 });
 assert.ok(info.scrollWidth<=width+1,JSON.stringify(info));assert.deepEqual(info.contrast,[]);assert.equal(info.images.length,6);assert.ok(info.images.every(i=>i.loaded));assert.equal(info.navWrap,'nowrap');
 await page.screenshot({path:path.join(output,`${width}-${mode}-${lang}-viewport.png`)});
 await page.screenshot({path:path.join(output,`${width}-${mode}-${lang}-full.png`),fullPage:true});
 results.push({width,mode,lang,...info});
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1672,1366,390,360]){
  const context=await browser.newContext({viewport:{width,height:941},reducedMotion:'reduce'});page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base);await page.locator('.cc-queue a').first().waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await page.locator('.cc-navigation [aria-current=page]').getAttribute('data-route'),'overview');
  for(const mode of ['dark','silver']){
   if(await page.locator('html').getAttribute('data-theme')!==mode)await page.locator('#theme-toggle').press('Enter');
   for(const lang of ['ko','en']){
    await page.goto(base+(lang==='en'?'/?lang=en':'/'));await page.locator('.cc-queue a').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'),mode);
    for(let i=0;i<5;i++){assert.equal(await page.locator('.cc-queue a').nth(i).getAttribute('href'),`#detail/${risks[i].sample_id}`);assert.equal(await page.locator('.cc-queue small b').nth(i).innerText(),risks[i].risk_score.toFixed(3));}
    if(lang==='en')assert.doesNotMatch(await page.locator('.cc-dashboard').innerText(),/[가-힣]/);
    await audit(width,mode,lang);
    const stage=page.locator('[data-stage="etch"]');await stage.press('Enter');assert.equal(await stage.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-stage][aria-pressed=true]').count(),1);assert.equal(await page.locator('.cc-stage-detail a').isVisible(),false);
    await page.locator('[data-stage="inspection"]').press('Space');assert.equal(await page.locator('.cc-stage-detail a').isVisible(),true);
    await page.locator('.cc-queue a').first().press('Enter');await page.locator('.detail-hero').waitFor();assert.match(await page.locator('#app h1').innerText(),new RegExp(risks[0].sample_id));
    await page.goBack();await page.locator('.cc-queue a').first().waitFor();
   }
  }
  // Keep original routes reachable, including a long mobile navigation rail.
  await page.locator('.cc-navigation a[data-route="summary"]').click();await page.locator('.absolute-beginner').waitFor();
  await page.locator('.cc-navigation a[data-route="global"]').click();await page.locator('.country-card').first().waitFor();
  await page.locator('.cc-navigation a[data-route="risks"]').click();await page.locator('.table-shell table').waitFor();assert.equal(await page.locator('.table-shell tbody tr').count(),50);
  await page.locator('.brand').click();await page.locator('.cc-queue a').first().waitFor();
  assert.deepEqual(errors,[]);await context.close();
  const missing=await browser.newContext({viewport:{width,height:941}});page=await missing.newPage();
  await page.route('**/command-center.mjs',r=>r.fulfill({status:404,body:'missing'}));await page.goto(base);await page.locator('#app .state h1').waitFor();assert.match(await page.locator('#app').innerText(),/표시할 수 없습니다|unavailable/);
  await page.locator('.cc-navigation [data-route="risks"]').click();await page.locator('.table-shell table').waitFor();assert.equal(await page.locator('.table-shell tbody tr').count(),50);await missing.close();
  const broken=await browser.newContext({viewport:{width,height:941}});page=await broken.newPage();
  await page.route('**/data/priority_top50.json',r=>{const copy=structuredClone(risks);copy[0].risk_score=null;return r.fulfill({contentType:'application/json',body:JSON.stringify(copy)});});await page.goto(base);await page.locator('#app .state h1').waitFor();assert.equal(await page.locator('.cc-queue').count(),0);await broken.close();
 }
 await browser.close();console.log('Command center browser checks passed:',results.length,'rendered combinations, plus keyboard/navigation/data/error isolation.');
})().catch(async error=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,results},null,2));await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await browser?.close().catch(()=>{});console.error(error);process.exitCode=1;});
