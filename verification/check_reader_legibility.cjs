// Presentation-only checks. This module reads rendered public DOM, never data/model files.
const assert=require('node:assert/strict');
const fontHosts=new Set(['fonts.googleapis.com','fonts.gstatic.com']);
function allowedReaderRequest(url,origin){const u=new URL(url);return u.origin===origin||(u.protocol==='https:'&&fontHosts.has(u.hostname));}
async function readerFonts(page){
 const result=await page.evaluate(async()=>{
  const configured=[...document.styleSheets].some(s=>s.href===location.origin+'/style.css');
  if(configured){
   const families=[];
   for(const [family,text] of [['Manrope','Manufacturing review'],['Noto Sans KR','반도체 점검 근거']]){
    const faces=await document.fonts.load(`400 16px "${family}"`,text);
    families.push({family,count:faces.length,statuses:faces.map(f=>f.status)});
   }
   await document.fonts.ready;
   return {mode:'configured Google web fonts',families,resources:performance.getEntriesByType('resource').filter(e=>new URL(e.name).hostname==='fonts.gstatic.com').length};
  }
  await document.fonts.ready;
  return {mode:'existing local/system font path; no remote font declared',families:[],resources:0};
 });
 if(result.families.length){
  for(const f of result.families)assert.ok(f.count>0&&f.statuses.every(s=>s==='loaded'),`web font actually loaded: ${JSON.stringify(result)}`);
  // The browser may reuse its font cache without a new PerformanceResourceTiming
  // entry. Verify a painted custom font as well as loaded FontFace objects.
  const session=await page.context().newCDPSession(page);
  try{
   await session.send('DOM.enable');await session.send('CSS.enable');
   const {root}=await session.send('DOM.getDocument');
   const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'main p'});
   const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
   result.paintedFonts=fonts;
   assert.ok(fonts.some(f=>f.isCustomFont&&f.glyphCount>0),'loaded font must actually paint reader text: '+JSON.stringify(result));
  }finally{await session.detach();}
 }
 return result;
}
function readerAudit(){
 const visible=e=>e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden'&&(!e.closest('details:not([open])')||Boolean(e.closest('summary')));
 const sizes=[],small=[],targets=[],prose=[];
 for(const e of document.querySelectorAll('main *,footer *,.cc-navigation *')){
  if(!visible(e)||e.matches('script,style')||![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const s=getComputedStyle(e),size=parseFloat(s.fontSize);sizes.push(size);
  if(size<12)small.push({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,90),size});
 }
 const rules=[
  ['.cc-queue .cc-outcome,.cc-concept-label,.cc-records time,.cc-bottom-line',13],
  ['.cc-panel-note,.cc-panel-foot,.cc-queue small,.cc-records small',14],
  ['.validation-seal small,.validation-details>summary span,.principles-list b,.principles-note small',14],
  ['.evidence-levels p,.pipeline p,.decision-flow p,.budget-grid p',14],
  ['.boundary-quote>span,.detail-grid article>span,.features b,.answer-strip span,.budget-top span,.budget-top b',13],
  ['.project-intro figcaption,.portfolio-result small,.professional-details>summary small',14],
  ['.intro-boundary,.intro-failure',15],['.project-intro .lead',17],
  ['main table th,main table td',innerWidth<=900?13:14],
  ['.cc-navigation>a,.cc-more>summary',14],
 ];
 for(const [selector,min] of rules)for(const e of document.querySelectorAll(selector))if(visible(e)){
  const s=getComputedStyle(e);targets.push({selector,size:parseFloat(s.fontSize),min,pass:parseFloat(s.fontSize)>=min});
 }
 for(const e of document.querySelectorAll('.card>p,.robot-step>p,.professional-body>section>p,.limits p,.uncertainty-note p,.design-boundary p,.implementation-note p,.principles-list p'))if(visible(e)){
  const s=getComputedStyle(e),r=e.getBoundingClientRect();prose.push({width:r.width,max:42*parseFloat(s.fontSize),wordBreak:s.wordBreak,wrap:s.overflowWrap,pass:r.width<=42*parseFloat(s.fontSize)+1});
 }
 const warning=document.querySelector('.intro-failure');
 const rgb=hex=>/^#[0-9a-f]{6}$/i.test(hex)?`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`:hex;
 const failureColor=warning?{actual:getComputedStyle(warning).color,expected:rgb(getComputedStyle(warning).getPropertyValue('--cc-warm').trim())}:null;
 const bottom=document.querySelector('.cc-bottom-grid')?.getBoundingClientRect().bottom;
 return {nodes:sizes.length,below12:small,below14:sizes.filter(s=>s<14).length,targets,prose,failureColor,lowerPanelsBottom:bottom??null,viewport:{width:innerWidth,height:innerHeight}};
}
function assertReaderAudit(audit){
 assert.ok(audit.nodes>10,'nonempty visible typography coverage');
 assert.deepEqual(audit.targets.filter(t=>!t.pass),[],'targeted reader text minimums');
 assert.deepEqual(audit.prose.filter(p=>!p.pass),[],'scoped prose remains within 42em');
 if(audit.failureColor)assert.equal(audit.failureColor.actual,audit.failureColor.expected,'failure caveat keeps its semantic warm ink');
 if(audit.lowerPanelsBottom!==null&&audit.viewport.width>=1280)assert.ok(audit.lowerPanelsBottom<=audit.viewport.height-8,'all four overview panels remain visible; no relaxed height threshold');
}
module.exports={allowedReaderRequest,readerFonts,readerAudit,assertReaderAudit};
