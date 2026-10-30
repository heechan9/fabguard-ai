// Read-only theme QA. Existing silver and robot checks remain independent gates.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',output=process.env.FABGUARD_UI_OUTPUT;
fs.mkdirSync(output,{recursive:true});const results=[],errors=[];let browser,activePage;
async function audit(page,name,width,mode){
 const result=await page.evaluate(()=>{
  const rgba=s=>{const c=(s.match(/[\d.]+/g)||[]).map(Number);if(c.length===3)c.push(1);return c;};
  const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const issues=[],excluded=[];
  for(const el of document.querySelectorAll('body *')){
   if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||!el.getClientRects().length||el.closest('svg,.hero-visual,#viewport,.inspection-drawing'))continue;
   const s=getComputedStyle(el);if(s.visibility==='hidden'||Number(s.opacity)<1)continue;
   let p=el,layers=[],uncertain=false;
   while(p){const ps=getComputedStyle(p);if(ps.backgroundImage!=='none'){uncertain=true;break;}const c=rgba(ps.backgroundColor);layers.push(c);if(c[3]===1)break;p=p.parentElement;}
   if(uncertain){excluded.push(el.textContent.trim().slice(0,40));continue;}
   let bg=[255,255,255,1];for(const c of layers.reverse())bg=[...c.slice(0,3).map((v,i)=>v*c[3]+bg[i]*(1-c[3])),1];
   const ink=rgba(s.color),fg=ink.slice(0,3).map((v,i)=>v*ink[3]+bg[i]*(1-ink[3]));
   const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
   if(ratio<(large?3:4.5))issues.push({text:el.textContent.trim().slice(0,80),cls:el.className,color:s.color,background:bg,ratio:Number(ratio.toFixed(2))});
  }
  const button=document.querySelector('.theme-toggle'),r=button.getBoundingClientRect(),style=getComputedStyle(button);
  return {issues,excluded,body:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth,button:{left:r.left,right:r.right,width:r.width,height:r.height,color:style.color,background:style.backgroundColor}};
 });
 assert.equal(result.body,mode==='silver'?'rgb(170, 182, 197)':'rgb(7, 11, 15)');
 assert.ok(result.overflow<=width+1,JSON.stringify({name,width,result}));assert.ok(result.button.left>=0&&result.button.right<=width+1&&result.button.height>=32,JSON.stringify(result.button));
 results.push({name,width,mode,...result});
 await page.screenshot({path:path.join(output,`theme-${width}-${mode}-${name}-viewport.png`)});
 await page.screenshot({path:path.join(output,`theme-${width}-${mode}-${name}.png`),fullPage:true});
 fs.writeFileSync(path.join(output,'theme-results.json'),JSON.stringify({base,results,errors},null,2));
}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader']});
 for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,390,360]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();activePage=page;
  await page.clock.install({time:new Date('2026-10-24T00:00:00Z')});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base);await page.locator('#app h1').waitFor();
  const theme=page.locator('.theme-toggle');assert.equal(await page.locator('html').getAttribute('data-theme'),'silver');
  for(const mode of ['dark','silver','dark','silver']){await theme.press('Enter');assert.equal(await theme.getAttribute('aria-pressed'),String(mode==='dark'));assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-theme')),mode);}
  await theme.focus();assert.equal(await theme.evaluate(e=>document.activeElement===e),true);assert.notEqual(await theme.evaluate(e=>getComputedStyle(e).outlineStyle),'none');await theme.press('Space');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#language-toggle').click();await page.waitForURL(/lang=en/);await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.match(await theme.innerText(),/Silver.*Dark/);assert.equal(await theme.getAttribute('aria-pressed'),'true');
  await theme.click();assert.equal(new URL(page.url()).searchParams.get('lang'),'en');await theme.click();
  await page.locator('#language-toggle').click();await page.waitForFunction(()=>document.documentElement.lang==='ko');assert.equal(await theme.getAttribute('aria-pressed'),'true');
  for(const mode of ['dark','silver']){
   if(await page.locator('html').getAttribute('data-theme')!==mode)await theme.click();
   for(const [name,route,ready] of [['home','/','#app h1'],['global','/#global','.country-card'],['risks','/#risks','table'],['limits','/#limitations','#app h1'],['secom','/secom/','#distribution-evidence select'],['smt','/smt/','#context-review h3']]){
    await page.goto(new URL(route,base).href);await page.locator(ready).first().waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),mode);await audit(page,name,width,mode);
   }
   assert.equal(await page.locator('#view-error').isVisible(),false,'WebGL must render');
   await page.locator('#robot-select').click();await page.locator('[data-fault=condition]').click();
   await page.locator('#context-review-panel>summary').click();
   const state=await page.evaluate(()=>{window.themeCanvas=document.querySelector('#viewport canvas');return {clock:document.querySelector('#clock').textContent,board:document.querySelector('#board-select').value,pending:document.querySelector('#pending').textContent,history:history.length,hash:location.hash};});
   await theme.click();await theme.click();
   assert.deepEqual(await page.evaluate(()=>({clock:document.querySelector('#clock').textContent,board:document.querySelector('#board-select').value,pending:document.querySelector('#pending').textContent,history:history.length,hash:location.hash})),state);
   assert.equal(await page.evaluate(()=>window.themeCanvas===document.querySelector('#viewport canvas')),true);
   assert.equal(await page.locator('#robot-select').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#context-review-panel').getAttribute('open'),null);
   await page.locator('#context-review-panel>summary').click();
   // Real synthetic state transitions, not fabricated CSS classes.
   const advance=async ms=>{for(let t=0;t<ms;t+=100)await page.clock.fastForward(Math.min(100,ms-t));};
   for(const fault of ['paste','condition']){
    await page.locator('#reset').press('Enter');await page.locator('[data-fault='+fault+']').press('Enter');await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');await advance(11100);await page.locator('#play').press('Enter');await page.locator('#board-select').selectOption('PCB-002');
    assert.equal(await page.locator('#robot-review').getAttribute('data-state'),fault==='paste'?'review':'hold');
    const status=await page.locator('#robot-decision').innerText();await theme.press('Enter');await theme.press('Enter');assert.equal(await page.locator('#robot-decision').innerText(),status);
    await audit(page,'smt-'+fault,width,mode);
    await page.locator('#board-select').selectOption('PCB-001');assert.equal(await page.locator('#robot-review').getAttribute('data-state'),'ok');await audit(page,'smt-normal-'+fault,width,mode);
   }
   await page.clock.resume();
  }
  // Real Back/Forward paths must reconcile a theme changed on another document.
  await page.goto(base);if(await theme.getAttribute('aria-pressed')==='true')await theme.click();
  await page.goto(new URL('/secom/',base).href);await page.locator('.theme-toggle').click();
  await page.goBack();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.locator('.theme-toggle').click();await page.goForward();await page.waitForFunction(()=>document.documentElement.dataset.theme==='silver');
  await page.goto(base);await page.evaluate(()=>localStorage.setItem('fabguard-theme','broken'));await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'silver');
  await context.close();
  const blocked=await browser.newContext({viewport:{width,height:900}});await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage disabled','SecurityError');}});});
  const bp=await blocked.newPage();await bp.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await bp.goto(base);await bp.locator('.theme-toggle').press('Enter');assert.equal(await bp.locator('html').getAttribute('data-theme'),'dark');await blocked.close();
 }
 await browser.close();assert.deepEqual(errors,[]);assert.equal(results.reduce((n,r)=>n+r.issues.length,0),0,'Low contrast text; inspect theme-results.json');
})().catch(async e=>{fs.writeFileSync(path.join(output,'theme-failure.json'),JSON.stringify({error:e.stack,results,errors},null,2));if(activePage)await activePage.screenshot({path:path.join(output,'theme-failure.png'),timeout:10000}).catch(()=>{});await browser?.close().catch(()=>{});console.error(e);process.exitCode=1;});
