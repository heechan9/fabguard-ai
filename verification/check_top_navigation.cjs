// Shared browser assertions: catches desktop sidebar regressions as well as mobile clipping.
const assert=require('node:assert/strict');
const {assertProfessionalDisclosure}=require('./check_professional_disclosure.cjs');
const order=['summary','overview','smt','risks','secom','limitations'];
async function assertTopNavigation(page,{scroll=true}={}){
 const inspect=()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const header=document.querySelector('.topbar'),nav=document.querySelector('.cc-navigation');
  const items=[...nav.querySelectorAll(':scope > a,:scope > details > summary')].map(e=>({text:e.textContent.trim(),...box(e),font:parseFloat(getComputedStyle(e).fontSize),clip:e.scrollWidth>e.clientWidth+2,key:e.matches('a')?(e.dataset.route||new URL(e.href).hash.slice(1)||new URL(e.href).pathname.split('/')[1]):'more'}));
  return {header:box(header),position:getComputedStyle(header).position,items,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,main:box(document.querySelector('main')),navOverflow:nav.scrollWidth>nav.clientWidth+2};
 };
 await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>document.fonts.ready);
 const state=await page.evaluate(inspect);
 assert.deepEqual(state.items.map(e=>e.key),[...order,'more']);
 assert.ok(['sticky','fixed'].includes(state.position),'header must remain at viewport top');
 assert.ok(state.header.y>=-1&&state.header.y<=2,JSON.stringify(state));
 assert.ok(state.header.width>=state.width-2,'horizontal full-width header, not desktop sidebar');
 assert.ok(state.main.y>=state.header.bottom-1,'header is above content');
 assert.ok(state.scrollWidth<=state.width+1&&!state.navOverflow,'no document or navigation overflow');
 for(const item of state.items){assert.ok(item.width>0&&item.height>0&&item.x>=-1&&item.right<=state.width+1,JSON.stringify(item));assert.ok(item.font>=11&&!item.clip,`readable unclipped navigation: ${JSON.stringify(item)}`);}
 const rows=new Set(state.items.map(e=>Math.round(e.y)));
 assert.ok(rows.size<=(state.width<=900?2:1),`navigation row count ${rows.size}`);
 if(scroll){await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));const after=await page.evaluate(inspect);assert.ok(after.header.y>=-1&&after.header.y<=2,'header stays at top after scroll');await page.evaluate(()=>scrollTo(0,0));}
 return state;
}
async function assertIntroduction(page){
 await page.locator('.absolute-beginner').waitFor();
 assert.equal(await page.locator('.cc-navigation [aria-current="page"]').getAttribute('data-route'),'summary');
 assert.match(await page.locator('.brand').getAttribute('href'),/#summary$/);
}
module.exports={assertTopNavigation,assertIntroduction,order};
async function main(){
 const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
 const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',output=process.env.FABGUARD_UI_OUTPUT||'/tmp/top-navigation';fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];let page;
 try{
 const requestedWidth=Number(process.env.FABGUARD_UI_WIDTH);
 const widths=requestedWidth?(requestedWidth===900?[900,820]:[requestedWidth]):[1920,1672,1366,1024,900,820,720,390,360];
 for(const {width,height} of widths.flatMap(width=>width===1366?[{width,height:941},{width,height:768}]:[{width,height:941}]))for(const theme of process.env.FABGUARD_UI_THEME?[process.env.FABGUARD_UI_THEME]:['dark','silver'])for(const lang of ['ko','en']){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base+(lang==='en'?'/?lang=en':'/'));await assertIntroduction(page);
  if(theme==='silver')await page.locator('#theme-toggle').press('Enter');
  const geometry=await assertTopNavigation(page);
  await assertProfessionalDisclosure(page);
  const more=page.locator('.cc-more'),trigger=more.locator('summary');
  for(let i=0;i<2;i++){
   await trigger.press('Enter');assert.equal(await more.evaluate(e=>e.open),true);
   await page.keyboard.press('Escape');assert.equal(await more.evaluate(e=>e.open),false);
   assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
   await trigger.press('Space');assert.equal(await more.evaluate(e=>e.open),true);
   await page.locator('.topbar').click({position:{x:1,y:1}});assert.equal(await more.evaluate(e=>e.open),false);
  }
  await trigger.press('Enter');await page.locator('.cc-more a[data-route=global]').press('Enter');await page.locator('.country-card').first().waitFor();assert.equal(await more.evaluate(e=>e.open),false);
  await page.goBack();await assertIntroduction(page);
  await page.locator('.cc-navigation > a[data-route=overview]').press('Enter');await page.locator('.cc-queue a').first().waitFor();await assertTopNavigation(page);
  await page.locator('.brand').press('Enter');await assertIntroduction(page);
  const smt=page.locator('.cc-navigation > a').nth(2);assert.match(await smt.getAttribute('href'),/^\/smt\//);await smt.press('Enter');await page.locator('#station-strip button').first().waitFor();await assertTopNavigation(page);
  await page.goBack();await assertIntroduction(page);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert.equal(await page.locator('html').getAttribute('lang'),lang);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(output,`${width}x${height}-${theme}-${lang}.png`)});
  results.push({width,height,theme,lang,geometry});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));await context.close();
 }
 console.log(`PASS ${results.length} top-navigation combinations`);
 }catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,url:page?.url(),diagnostic:error.disclosureDiagnostic||null,completed:results},null,2));await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
