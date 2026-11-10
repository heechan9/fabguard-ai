// Read-only all-page Chrome acceptance audit. No project dependencies or remote browsing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

// An exact inventory is independently compared with every web/**/*.html by node:test.
const documents = [
  {file:'index.html', name:'overview', route:'/', ready:'.cc-queue a', english:true},
  {file:'secom/index.html', name:'secom', route:'/secom/', ready:'#distribution-evidence select'},
  {file:'smt/index.html', name:'smt', route:'/smt/', ready:'#station-strip button'},
  {file:'equipment/index.html', name:'equipment', route:'/equipment/', ready:'#example'},
  {file:'equipment/context-review.html', name:'context-review', route:'/equipment/context-review.html', ready:'#context-example'},
  {file:'robot/index.html', name:'robot', route:'/robot/', ready:'#offline-results table'},
  {file:'robot/ur3/index.html', name:'ur3', route:'/robot/ur3/', ready:'#load-status[data-status="ready"]'},
  {file:'research/index.html', name:'research', route:'/research/', ready:'main h1', nativeTheme:true},
  {file:'secom/research.html', name:'secom-research', route:'/secom/research.html', ready:'#fold-table tbody tr'},
  {file:'smt/references.html', name:'references', route:'/smt/references.html', ready:'main h1'},
  {file:'oht/index.html', name:'oht', route:'/oht/', ready:'#viewport canvas', english:true},
  {file:'review/index.html', name:'review', route:'/review/?sample=secom_1397', ready:'#workspace:not([hidden])', english:true},
];
const hashViews = [
  {name:'summary', route:'/#summary', ready:'.absolute-beginner', english:true},
  {name:'global', route:'/#global', ready:'.country-card', english:true},
  {name:'risks', route:'/#risks', ready:'.table-shell tbody tr', english:true},
  {name:'limitations', route:'/#limitations', ready:'#app h1', english:true},
  {name:'detail', route:'/#detail/secom_1397', ready:'.detail-hero', english:true},
];
const canonicalPath = value => {
  const u = new URL(value, 'http://localhost');
  return u.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
};

// Deterministic test-only inputs processed by the real local CSV/window pipeline.
// No manufactured DOM classes: each legend category must come from calculated state.
function semanticWindowCSV(kind) {
  assert.ok(['ok','gap','short','nonfinite','range'].includes(kind));
  const rows=['Time,A_x [g],A_y [g],A_z [g]'];
  for(let i=0;i<120;i++){
    if(kind==='gap'&&i>=50&&i<60)continue;
    if(kind==='short'&&i>0&&i<50&&i%5===0)continue;
    const value=kind==='nonfinite'&&i===70?'NaN':kind==='range'&&i===70?'1000001':'1';
    rows.push(`${(i/1000).toFixed(3)},${value},0,0`);
  }
  return rows.join('\n')+'\n';
}
// CSS custom properties are hex tokens; compare against the browser's actual RGB ink.
function semanticStyles(selectors) {
  const rgb=token=>/^#[0-9a-f]{6}$/i.test(token)?`rgb(${[1,3,5].map(i=>parseInt(token.slice(i,i+2),16)).join(', ')})`:token;
  return selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map(el=>{
    const style=getComputedStyle(el);
    return {selector,text:el.textContent.trim(),color:style.color,fill:style.fill,borderColor:style.borderColor,borderStyle:style.borderStyle,background:style.backgroundColor,visible:el.getClientRects().length>0,tokens:Object.fromEntries(['--red','--normal','--amber','--synthetic','--cc-ink','--cc-muted','--cc-accent','--cc-line'].map(name=>[name,rgb(style.getPropertyValue(name).trim())]))};
  }));
}

// Runs inside the page. Transparent layers are composited, not silently skipped.
// Gradient stops are sampled conservatively; unsupported images are reported and fail.
// Canvas/scene overlays keep their separate semantic palette. SVG chart labels are checked.
function renderedAudit() {
  const rgba = value => {
    if (value === 'transparent') return [0,0,0,0];
    const parts = value.match(/^rgba?\(([^)]+)\)$/)?.[1].match(/[\d.]+/g)?.map(Number);
    if (!parts) return null;
    if (parts.length === 3) parts.push(1);
    return parts;
  };
  const blend = (top, bottom) => top.slice(0,3).map((v,i)=>v*top[3]+bottom[i]*(1-top[3]));
  const lum = c => c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const ratio = (fg,bg) => (Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
  const scene = '#viewport,.hero-visual,.inspection-drawing,.cc-stage-art';
  const visible = el => {
    if (!el.getClientRects().length || el.closest('[hidden]')) return false;
    for (let p=el;p;p=p.parentElement) {
      const s=getComputedStyle(p);
      if (s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) return false;
      if (p.tagName==='DETAILS'&&!p.open&&!el.closest('summary')) return false;
    }
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return !(s.clipPath==='inset(50%)'||s.clip==='rect(0px, 0px, 0px, 0px)'||r.width<2||r.height<2||r.bottom<0);
  };
  const issues=[],unknownBackgrounds=[],excluded=[],controls=[],overflowing=[],scrollRegions=[],colors={};
  let tested=0;
  const palette={};
  for(const name of ['bg','panel','raised','active','ink','muted','accent','warm'])palette[name]=getComputedStyle(document.documentElement).getPropertyValue('--cc-'+name).trim();
  for(const el of document.querySelectorAll('body *')) {
    if(!visible(el))continue;
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    if(el.scrollWidth>el.clientWidth+2&&['auto','scroll'].includes(s.overflowX))scrollRegions.push({tag:el.tagName,id:el.id,cls:el.getAttribute('class'),width:el.clientWidth,scroll:el.scrollWidth});
    if(r.left< -1||r.right>innerWidth+1) {
      let contained=false;
      for(let p=el.parentElement;p;p=p.parentElement){const ps=getComputedStyle(p),pr=p.getBoundingClientRect();if(['auto','scroll','hidden','clip'].includes(ps.overflowX)&&pr.left>=-1&&pr.right<=innerWidth+1){contained=true;break;}}
      if(!contained&&!el.matches('.skip,.skip-link'))overflowing.push({tag:el.tagName,id:el.id,cls:el.getAttribute('class'),left:r.left,right:r.right});
    }
    if(el.matches('button')&&!el.matches(':disabled')&&!el.closest('fieldset:disabled')&&!el.closest(scene))controls.push({id:el.id,text:el.textContent.trim().slice(0,60),image:s.backgroundImage,radius:parseFloat(s.borderTopLeftRadius),color:s.color,background:s.backgroundColor});
    const directText=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).filter(Boolean).join(' ');
    const isValue=el.matches('input:not([type=file]):not([type=range]):not([type=checkbox]),textarea,select');
    const text=directText||(isValue?(el.value||el.getAttribute('placeholder')||''): '');
    if(!text||el.matches('script,style,title,option,template,noscript'))continue;
    if(el.closest(scene)&&!el.closest('#view-error')){excluded.push({reason:'scene/HUD separately preserves semantic colors',id:el.id,text:text.slice(0,70)});continue;}
    if(el.matches(':disabled')||el.closest('fieldset:disabled')){excluded.push({reason:'disabled control (WCAG inactive UI exemption)',id:el.id,text:text.slice(0,70)});continue;}
    const layers=[];let opacity=1;
    for(let p=el;p;p=p.parentElement){const ps=getComputedStyle(p);layers.unshift(ps);opacity*=Number(ps.opacity);}
    let backgrounds=[[255,255,255]],unknown=false;
    for(const layer of layers){
      const color=rgba(layer.backgroundColor);
      if(!color){unknown=true;break;}
      backgrounds=backgrounds.map(bg=>blend(color,bg));
      if(layer.backgroundImage!=='none'){
        if(!/gradient\(/.test(layer.backgroundImage)||/url\(/.test(layer.backgroundImage)){unknown=true;break;}
        const stops=(layer.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(rgba);
        if(!stops.length){unknown=true;break;}
        const samples=[...stops];
        for(let i=1;i<stops.length;i++)for(let n=1;n<8;n++)samples.push(stops[i-1].map((v,c)=>v+(stops[i][c]-v)*n/8));
        backgrounds=backgrounds.flatMap(bg=>samples.map(stop=>blend(stop,bg)));
        // Bounds retain the darkest/lightest candidates without exponential growth.
        if(backgrounds.length>256)backgrounds=backgrounds.sort((a,b)=>lum(a)-lum(b)).filter((_,i,all)=>i%Math.ceil(all.length/256)===0||i===all.length-1);
      }
    }
    const ink=rgba(el instanceof SVGElement?s.fill:s.color);
    if(unknown||!ink){unknownBackgrounds.push({text:text.slice(0,90),id:el.id,cls:el.getAttribute('class'),reason:unknown?'unsupported background image/color':'unsupported ink'});continue;}
    tested++;ink[3]*=opacity;
    const minimum=Math.min(...backgrounds.map(bg=>ratio(blend(ink,bg),bg)));
    const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700),required=large?3:4.5;
    colors[s.color]=(colors[s.color]||0)+1;
    if(minimum+0.005<required)issues.push({text:text.slice(0,100),tag:el.tagName,id:el.id,cls:el.getAttribute('class'),color:s.color,fontSize:s.fontSize,fontWeight:s.fontWeight,ratio:Number(minimum.toFixed(3)),required});
  }
  const canvas=[...document.querySelectorAll('canvas')].map(el=>({id:el.id,width:el.width,height:el.height,filter:getComputedStyle(el).filter,opacity:getComputedStyle(el).opacity}));
  return {tested,issues,unknownBackgrounds,excluded,controls,colors,overflowing,scrollRegions,canvas,palette,body:getComputedStyle(document.body).backgroundColor,scrollWidth:document.documentElement.scrollWidth,innerWidth};
}

async function main() {
  const {chromium}=require('playwright');
  const width=Number(process.env.FABGUARD_UI_WIDTH||1366),theme=process.env.FABGUARD_UI_THEME||'dark';
  assert.ok([1366,390,360].includes(width));assert.ok(['dark','silver'].includes(theme));
  const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',origin=new URL(base).origin;
  const output=path.join(process.env.FABGUARD_UI_OUTPUT||'/tmp/sitewide-command',`${width}-${theme}`);
  fs.mkdirSync(output,{recursive:true});
  const report={status:'running',base,width,theme,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),documents:documents.map(d=>d.file),hashViews:hashViews.map(d=>d.route),results:[],failures:[],links:[],navigationTraversals:[],navigationAudits:[],semanticAudits:[],scopeNotes:['Canvas/scene HUD semantic colors are not globally recolored; native SVG chart labels are audited.','Research preserves no-script CSP: both themes use its native checkbox; no cross-page saved-theme persistence or JavaScript Escape handler on this static page.','Contrast checks composite transparency and conservatively sample gradients; screenshots also require visual review.']};
  const save=()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
  let browser,activePage;
  const checkedLinks=new Set();
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();
    const fallbackViews=documents.filter(d=>['smt','oht'].includes(d.name)).map(d=>({...d,name:d.name+'-fallback',ready:'#view-error:not([hidden])',english:false,fallback:true}));
    for(const spec of [...documents,...hashViews,...fallbackViews])for(const lang of spec.english?['ko','en']:['ko']){
      const name=`${spec.name}-${lang}`,errors=[],requests=[];
      const context=await browser.newContext({viewport:{width,height:941},reducedMotion:'reduce'});
      if(spec.fallback)await context.addInitScript(()=>{
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^(?:webgl2?|experimental-webgl)$/.test(kind)?null:original.call(this,kind,...args);};
      });
      const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(new URL(r.url()).origin===origin&&r.status()>=400)requests.push({url:r.url(),status:r.status()});});
      await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const check=(condition,message)=>{if(!condition)report.failures.push({name,check:message});};
      const capture=async suffix=>{
        await page.evaluate(()=>scrollTo(0,0));
        const audit=await page.evaluate(renderedAudit);
        report.results.push({name:name+suffix,route:page.url(),theme,language:await page.locator('html').getAttribute('lang'),...audit});
        check(audit.scrollWidth<=width+1,`${suffix} no document overflow: ${audit.scrollWidth}`);
        check(audit.overflowing.length===0,`${suffix} no uncontained horizontal overflow: ${JSON.stringify(audit.overflowing.slice(0,8))}`);
        check(audit.tested>10,`${suffix} nonempty contrast coverage (${audit.tested})`);
        check(audit.issues.length===0,`${suffix} ${audit.issues.length} low-contrast text nodes`);
        check(audit.unknownBackgrounds.length===0,`${suffix} ${audit.unknownBackgrounds.length} unresolved text backgrounds`);
        check(audit.controls.every(c=>c.image==='none'&&c.radius<=10),`${suffix} old gradient/pill buttons: ${JSON.stringify(audit.controls.filter(c=>c.image!=='none'||c.radius>10))}`);
        check(audit.canvas.every(c=>c.width>0&&c.height>0&&c.filter==='none'&&c.opacity==='1'),`${suffix} canvas preserved without color filters`);
        check(audit.body===(theme==='dark'?'rgb(4, 23, 15)':'rgb(170, 182, 197)'),`${suffix} command-room background ${audit.body}`);
        await page.screenshot({path:path.join(output,`${name}${suffix}-viewport.png`),animations:'disabled'});
        await page.screenshot({path:path.join(output,`${name}${suffix}-full.png`),fullPage:true,animations:'disabled'});save();
      };
      try {
        const url=new URL(spec.route,base);if(lang==='en')url.searchParams.set('lang','en');
        // Reach every screen through the actual shared navigation (detail via saved queue).
        const home=new URL('/',base);if(lang==='en')home.searchParams.set('lang','en');
        const response=await page.goto(home.href);assert.equal(response.status(),200);
        await page.locator('.cc-queue a').first().waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','fresh browser defaults to command-room dark');
        assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-theme')),null);
        if(theme==='silver')await page.locator('#theme-toggle').press('Enter');
        if(spec.name==='detail'||spec.name==='review') {
          await page.locator('.cc-queue a[href="#detail/secom_1397"]').press('Enter');
          await page.locator('.detail-hero').waitFor();
          if(spec.name==='review'){
            const review=page.locator('.review-prompt a[href^="/review/?sample="]');
            const target=new URL(await review.getAttribute('href'),base);
            assert.equal(target.searchParams.get('sample'),'secom_1397');
            assert.equal(target.searchParams.get('lang'),lang==='en'?'en':null);
            await review.press('Enter');
          }
        }else if(spec.name!=='overview') {
          const links=await page.locator('.cc-navigation a').evaluateAll(es=>es.map(e=>({raw:e.getAttribute('href'),href:e.href,secondary:Boolean(e.closest('.cc-more'))})));
          const target=links.find(link=>canonicalPath(link.href)===canonicalPath(url.href)&&(canonicalPath(url.href)!=='/'||new URL(link.href).hash===url.hash));
          assert.ok(target,`actual navigation target for ${spec.name}`);
          if(target.secondary)await page.locator('.cc-more summary').press('Enter');
          await page.locator('.cc-navigation a').nth(links.indexOf(target)).press('Enter');
        }
        await page.waitForURL(current=>canonicalPath(current.href)===canonicalPath(url.href)&&(canonicalPath(url.href)!=='/'||current.hash===url.hash||spec.name==='overview'));
        await page.locator(spec.ready).first().waitFor();await page.evaluate(()=>document.fonts.ready);
        if(spec.name==='review'){
          assert.equal(new URL(page.url()).searchParams.get('sample'),'secom_1397');
          assert.equal(new URL(page.url()).searchParams.get('lang'),lang==='en'?'en':null);
          assert.match(await page.locator('#source-details').innerText(),/secom_1397/);
        }
        report.navigationTraversals.push({name,from:home.href,to:page.url(),method:spec.name==='overview'?'entry':spec.name==='detail'?'saved queue Enter':spec.name==='review'?'saved queue to detail to record-specific review Enter':'shared navigation Enter'});
        if(spec.nativeTheme){
          const native=page.locator('#research-theme');await native.setChecked(theme==='silver');
          await native.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
          assert.equal(await native.evaluate(e=>document.activeElement===e&&e.matches(':focus-visible')),true);
          assert.notEqual(await native.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
          assert.equal(await native.getAttribute('aria-describedby'),'research-theme-note');
          assert.match(await page.locator('#research-theme-note').innerText(),/저장하지.*다크/);
          const before=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
          await native.press('Space');assert.equal(await native.isChecked(),theme!=='silver');
          assert.notEqual(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),before);
          await native.press('Space');assert.equal(await native.isChecked(),theme==='silver');
          assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),before);
        }
        else {
          assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
          if(theme==='dark')assert.equal(await page.evaluate(()=>localStorage.getItem('fabguard-theme')),null,'every scripted page defaults dark without a stored preference');
        }
        // Preserve complete page visuals/contrast even if a later interaction assertion fails.
        await capture('');
        assert.equal(await page.locator('body.command-shell').count(),1);
        assert.equal(await page.locator('.topbar').count(),1);
        assert.equal(await page.locator('.cc-navigation > a').count(),4);
        assert.equal(await page.locator('link[href="/sitewide-command.css"]').count(),1);
        assert.equal(await page.locator('html').getAttribute('lang'),lang);
        const loaded=await page.evaluate(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/sitewide-command.css')&&s.cssRules.length>0));assert.equal(loaded,true);
        const nav=await page.locator('.cc-navigation a').evaluateAll(es=>es.map(e=>({href:e.href,text:e.textContent.trim()})));
        for(const doc of documents)assert.ok(nav.some(a=>canonicalPath(a.href)===canonicalPath(doc.route)),`navigation reaches ${doc.file}`);
        for(const link of nav){
          assert.ok(link.text);assert.equal(new URL(link.href).origin,origin);
          const u=new URL(link.href);u.hash='';
          if(!checkedLinks.has(u.href)){
            const response=await context.request.get(u.href);checkedLinks.add(u.href);report.links.push({url:u.href,status:response.status()});assert.equal(response.status(),200,link.href);
          }
        }
        const more=page.locator('.cc-more'),summary=more.locator('summary');
        await summary.press('Enter');assert.equal(await more.evaluate(e=>e.open),true);
        const menuAudit=await page.evaluate(renderedAudit);
        report.navigationAudits.push({name,tested:menuAudit.tested,issues:menuAudit.issues,unknownBackgrounds:menuAudit.unknownBackgrounds,overflowing:menuAudit.overflowing,scrollWidth:menuAudit.scrollWidth});
        check(menuAudit.issues.length===0&&menuAudit.unknownBackgrounds.length===0,'expanded navigation text contrast');
        check(menuAudit.scrollWidth<=width+1&&menuAudit.overflowing.length===0,'expanded navigation horizontal bounds');
        await page.screenshot({path:path.join(output,`${name}-expanded-navigation.png`),animations:'disabled'});
        await summary.press('Space');assert.equal(await more.evaluate(e=>e.open),false);
        if(!spec.nativeTheme){
          await summary.press('Enter');await page.keyboard.press('Escape');assert.equal(await more.evaluate(e=>e.open),false);
          await summary.press('Enter');
          const snapshot=()=>({href:location.href,theme:document.documentElement.dataset.theme,language:document.documentElement.lang,history:history.length,controls:[...document.querySelectorAll('main input,main select,main textarea')].map(e=>({id:e.id,value:e.value,checked:e.checked}))});
          const beforeOutside=await page.evaluate(snapshot);
          // On narrow screens the expanded menu overlays main headings. Click actual
          // empty topbar padding, outside More and every action, without force-clicking.
          await page.locator('.topbar').click({position:{x:1,y:1}});
          assert.equal(await more.evaluate(e=>e.open),false);
          assert.deepEqual(await page.evaluate(snapshot),beforeOutside,'outside dismissal preserves navigation, theme and form state');
          const toggle=page.locator('#theme-toggle');await toggle.focus();
          // Programmatic focus after a pointer click retains pointer modality in Chrome.
          // Traverse away and back with real keys before checking the keyboard indicator.
          await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
          assert.equal(await toggle.evaluate(e=>document.activeElement===e),true,'keyboard traversal returns to the theme control');
          assert.equal(await toggle.evaluate(e=>e.matches(':focus-visible')),true,'theme control is keyboard-focused');
          assert.notEqual(await toggle.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
          await toggle.press('Enter');assert.equal(await page.locator('html').getAttribute('data-theme'),theme==='dark'?'silver':'dark');
          await toggle.press('Space');assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
          assert.equal(await toggle.getAttribute('aria-pressed'),String(theme==='dark'));
        }
        if(spec.name==='overview')assert.equal(await page.locator('.cc-queue a').count(),5);
        if(spec.name==='risks')assert.equal(await page.locator('.table-shell tbody tr').count(),50);
        if(spec.name==='detail')assert.match(await page.locator('#app h1').innerText(),/secom_1397/);
        if(spec.fallback)assert.equal(await page.locator('#view-error').isVisible(),true,'WebGL failure is readable, not hidden');
        // Real controls open previously hidden surfaces; never fabricate CSS state classes.
        if(spec.name==='equipment'){
          await page.locator('#example').press('Enter');await page.locator('#mapping-panel:not([hidden])').waitFor();
          await page.locator('#validate').press('Enter');assert.match(await page.locator('#result').innerText(),/2행.*1행/);
          await page.locator('[data-spc="missing"]').press('Enter');await capture('-input-and-missing');
          await page.locator('#clear').press('Enter');assert.equal(await page.locator('#mapping-panel').isVisible(),false);
        }else if(spec.name==='context-review'){
          await page.locator('#context-example').press('Enter');await page.locator('#context-form:not([hidden])').waitFor();
          assert.equal(await page.locator('#context-observations tr').count(),3);
          await page.locator('#review-role').fill('QA synthetic reviewer');await page.locator('#review-time').fill('2026-09-01T00:21:00Z');
          await page.locator('#review-reason').fill('Synthetic UI verification only; hold pending evidence.');
          await capture('-form');await page.locator('#context-clear').press('Enter');assert.equal(await page.locator('#context-form').isVisible(),false);
        }else if(spec.name==='robot'){
          await page.locator('#lock').press('Enter');await page.locator('#contract-status span.bad').waitFor();
          const errorInk=(await page.evaluate(semanticStyles,['#contract-status span.bad']))[0];
          check(errorInk.color===errorInk.tokens['--red']&&/고정 실패/.test(errorInk.text),'invalid contract retains named red error state');
          const invalidFields=await page.evaluate(semanticStyles,['#contract-fields input[aria-invalid="true"]']);
          const validFields=await page.evaluate(semanticStyles,['#contract-fields input:not([type="checkbox"]):not([aria-invalid="true"])']);
          check(invalidFields.length>0&&invalidFields.every(field=>field.borderColor===field.tokens['--red']),'invalid fields retain red borders matching aria-invalid');
          check(validFields.length>0&&validFields.every(field=>field.borderColor===field.tokens['--cc-line']),'valid fields retain ordinary line borders');
          report.semanticAudits.push({name,state:'invalid-contract',styles:[errorInk],invalidFields,validFields});await capture('-invalid-contract');
          await page.locator('#synthetic-error').press('Enter');
          await page.waitForFunction(()=>document.querySelector('#input-status').textContent.includes('무효 1개'));
          const pills=await page.evaluate(semanticStyles,['#file-table .pill-ok','#file-table .pill-bad']);
          check(pills.filter(p=>p.selector.endsWith('.pill-ok')).length===3&&pills.filter(p=>p.selector.endsWith('.pill-bad')).length===1,'actual invalid synthetic example retains three valid and one invalid file');
          check(pills.every(p=>p.selector.endsWith('.pill-ok')?p.color===p.tokens['--normal']&&p.text==='형식 통과':p.color===p.tokens['--red']&&p.text==='무효'),'valid/invalid named pills retain semantic colors');
          check(new Set(pills.map(p=>p.color)).size===2,'valid and invalid pills are visually distinct');
          report.semanticAudits.push({name,state:'invalid-synthetic',styles:pills});await capture('-invalid-synthetic');
          await page.locator('#files').setInputFiles(['ok','gap','short','nonfinite','range'].map(kind=>({name:`QA_SYNTHETIC_${kind}.csv`,mimeType:'text/csv',buffer:Buffer.from(semanticWindowCSV(kind))})));
          await page.waitForFunction(()=>document.querySelector('#input-status').textContent.includes('5개 파일 · 무효 0개'));
          const legend=[];
          for(const kind of ['ok','gap','short','nonfinite','range','tail']){
            const key=page.locator(`#window-legend .${kind}`),marks=page.locator(`.strip .w-${kind}`);
            assert.ok(await marks.count()>0,`real calculated ${kind} SVG state exists`);
            const ink=await key.evaluate(e=>getComputedStyle(e).color),fills=await marks.evaluateAll(es=>[...new Set(es.map(e=>getComputedStyle(e).fill))]);
            check(fills.length===1&&fills[0]===ink,`${kind} legend ink matches every actual SVG state fill`);
            legend.push({kind,text:await key.innerText(),color:ink,fills,count:await marks.count()});
          }
          check(new Set(legend.map(x=>x.color)).size===6,'all six named window categories retain distinct colors');
          report.semanticAudits.push({name,state:'all-calculated-window-categories',legend});await capture('-semantic-legend');
        }else if(spec.name==='secom-research'){
          const labels=await page.locator('#capture-chart').evaluate(svg=>{
            const bounds=svg.viewBox.baseVal;
            return [...svg.querySelectorAll('text')].map(el=>{const box=el.getBBox();return {text:el.textContent,x:box.x,y:box.y,right:box.x+box.width,bottom:box.y+box.height,inside:box.x>=bounds.x-1&&box.y>=bounds.y-1&&box.x+box.width<=bounds.x+bounds.width+1&&box.y+box.height<=bounds.y+bounds.height+1,renderedHeight:el.getBoundingClientRect().height};});
          });
          check(labels.length>2&&labels.every(label=>label.inside&&label.renderedHeight>=11),'research SVG labels stay inside viewBox and remain readable');
          report.semanticAudits.push({name,state:'research-chart-labels',labels});
          const figure=page.locator('.r-figure');assert.equal(await figure.getAttribute('tabindex'),'0');
          if(await figure.evaluate(e=>e.scrollWidth>e.clientWidth+1)){
            await figure.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.r-figure').scrollLeft>0);
            await figure.evaluate(e=>e.scrollLeft=0);
          }
        }else if(spec.name==='research'){
          const tags=await page.evaluate(semanticStyles,['p.tag.synthetic','p.tag.prototype']);
          const synthetic=tags.find(t=>t.selector==='p.tag.synthetic');assert.ok(synthetic);
          check(synthetic.color===synthetic.tokens['--synthetic']&&synthetic.color!==synthetic.tokens['--cc-accent']&&synthetic.color!==synthetic.tokens['--amber'],'synthetic evidence badge retains distinct semantic ink');
          check(/합성 데이터만/.test(synthetic.text)&&synthetic.borderStyle==='dashed','synthetic boundary remains explicit in text and border');
          report.semanticAudits.push({name,state:'synthetic-evidence-boundary',styles:tags});
        }else if(spec.name==='global'){
          // This evidence module is shared from /smt, but its actual host is #global.
          await page.locator('[data-evidence-source="dkasc"]').press('Enter');
          await page.locator('#dataset-card p.plain-quality').waitFor();
          await page.locator('#dataset-card .evidence-details > summary').first().press('Enter');
          const warningStyles=await page.evaluate(semanticStyles,['#dataset-card p.plain-quality','#dataset-card p.evidence-note.evidence-warning']);
          check(warningStyles.length>=2&&warningStyles.every(w=>w.visible),'real quality warning and detailed warnings are present and expanded');
          check(warningStyles.every(w=>w.color===w.tokens['--amber']&&w.color!==w.tokens['--cc-muted']),'warning paragraphs retain amber ink, not ordinary reader text');
          report.semanticAudits.push({name,state:'saved-quality-warnings',styles:warningStyles});await capture('-quality-warnings');
        }else if(spec.name==='ur3'){
          assert.match(await page.locator('#quality-summary').innerText(),/7,409행.*24열/);assert.equal(await page.locator('#sensor option').count(),19);
          await page.locator('#position').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#position').inputValue(),'1');
          await page.locator('[data-jump="missing"]').press('Enter');assert.match(await page.locator('#current-quality').innerText(),/결측/);await capture('-missing');
        }else if(spec.name==='secom'){
          await page.locator('[data-action="begin"][data-case="solution"]').press('Enter');assert.equal(await page.locator('[data-condition]').getAttribute('data-state'),'active');await capture('-warning');await page.locator('[data-action="reset"]').press('Enter');
        }else if(spec.name==='review'){
          await page.locator('#reviewer-role').fill('QA synthetic reviewer');await page.locator('#rationale').fill('Unsubmitted local UI draft');
          const toggle=page.locator('#theme-toggle');await toggle.press('Enter');await toggle.press('Enter');assert.equal(await page.locator('#rationale').inputValue(),'Unsubmitted local UI draft');
          await page.locator('#language-toggle').press('Enter');await page.locator('#language-toggle').press('Enter');assert.equal(await page.locator('#rationale').inputValue(),'Unsubmitted local UI draft');
          await capture('-draft');
        }else if(spec.name==='smt'){
          assert.equal(await page.locator('#view-error').isVisible(),false);const canvas=await page.locator('#viewport canvas').elementHandle();
          await page.locator('#theme-toggle').press('Enter');await page.locator('#theme-toggle').press('Enter');assert.equal(await canvas.evaluate(e=>e===document.querySelector('#viewport canvas')),true);
          await page.locator('#intro-open').press('Enter');await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
        }
        check(errors.length===0,'no page errors: '+JSON.stringify(errors));check(requests.length===0,'no failed local resources: '+JSON.stringify(requests));
      }catch(error){report.failures.push({name,error:error.stack,errors,requests});await page.screenshot({path:path.join(output,`${name}-failure.png`),fullPage:true}).catch(()=>{});save();}
      finally{await context.close();}
    }
    report.status=report.failures.length?'failed':'passed';save();
    assert.deepEqual(report.failures,[],`Inspect ${output}/results.json`);
    console.log(`All-page audit passed: ${report.results.length} rendered views, 12 HTML documents, 5 root hash views, 2 forced WebGL fallback views, ${report.links.length} navigation destinations; ${width}px ${theme}.`);
  }catch(error){report.status='failed';report.fatal=error.stack;save();throw error;}
  finally{await browser?.close();}
}
module.exports={documents,hashViews,canonicalPath,renderedAudit,semanticWindowCSV,semanticStyles};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
