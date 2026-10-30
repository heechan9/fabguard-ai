// Read-only rendered checks: no remote requests, models or browser downloads.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=process.env.FABGUARD_UI_OUTPUT,base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH});
 const observations=[];
 for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,390,360]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  for(const [name,route,ready] of [['home','/','#app h1'],['smt','/smt/','#context-review h3'],['secom','/secom/','#distribution-evidence select'],['limits','/#limitations','#app h1'],['global','/#global','.country-card'],['risks','/#risks','table']]){
   await page.goto(new URL(route,base).href);await page.locator(ready).first().waitFor();
   assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(184, 194, 206)');
   if(name==='smt'||name==='secom'){
    const selectors=name==='smt'?['.workspace','.panel','.scenario-buttons button','.station-strip button:not(.active)']:['.panel'];
    for(const selector of selectors){const surface=await page.locator(selector).first().evaluate(e=>({color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage}));assert.equal(surface.image,'none',name+' '+selector);assert.ok(['rgb(209, 217, 226)','rgb(197, 207, 218)'].includes(surface.bg),JSON.stringify({selector,surface}));}
   }
   const overflow=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(overflow.scroll<=width+1,JSON.stringify({name,width,overflow}));
   await page.screenshot({path:path.join(output,`${width}-${name}-viewport.png`)});
   await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true});
   const contrast=await page.evaluate(()=>{
    const rgba=s=>{const c=(s.match(/[\d.]+/g)||[]).map(Number);if(c.length===3)c.push(1);return c;},lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const issues=[];
    for(const el of document.querySelectorAll('body *')){
     if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||!el.getClientRects().length||el.closest('svg,.hero-visual,#viewport,.inspection-drawing'))continue;
     const s=getComputedStyle(el);if(s.visibility==='hidden'||Number(s.opacity)<1)continue;
     let bg=[184,194,206,1],p=el,uncertain=false;
     while(p){const ps=getComputedStyle(p),c=rgba(ps.backgroundColor);if(ps.backgroundImage!=='none'){uncertain=true;break;}if(c[3]===1){bg=c;break;}if(c[3]>0){uncertain=true;break;}p=p.parentElement;}
     if(uncertain)continue;const fg=rgba(s.color),ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
     if(ratio<(large?3:4.5))issues.push({text:el.textContent.trim().slice(0,85),tag:el.tagName,cls:el.className,color:s.color,background:bg,ratio:Number(ratio.toFixed(2))});
    }return issues;
   });
   observations.push({name,width,contrast});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 fs.writeFileSync(path.join(output,'silver-contrast.json'),JSON.stringify(observations,null,2));
 await browser.close();
 assert.equal(observations.reduce((n,x)=>n+x.contrast.length,0),0,'Low contrast text; inspect silver-contrast.json');
})().catch(e=>{console.error(e);process.exitCode=1;});
