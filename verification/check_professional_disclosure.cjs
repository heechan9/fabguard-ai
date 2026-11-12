// Native disclosure checks complement the scientific/data contracts, not replace them.
const assert=require('node:assert/strict');
async function openProfessionalDetails(page){
 const details=page.locator('details.professional-details, details.public-guide');
 for(let i=0;i<await details.count();i++){
  const item=details.nth(i);
  if(!await item.evaluate(e=>e.open))await item.locator(':scope > summary').press('Enter');
  assert.equal(await item.evaluate(e=>e.open),true);
 }
 return details.count();
}
async function assertProfessionalDisclosure(page){
 const panel=page.locator('#app details.professional-details');
 assert.equal(await panel.count(),1,'one optional detailed introduction');
 assert.equal(await panel.evaluate(e=>e.open),false,'fresh introduction is concise');
 assert.equal(await page.locator('#answer-overview').isVisible(),false,'duplicate summary belongs to optional expert detail');
 const summary=panel.locator(':scope > summary');
 assert.equal(await summary.isVisible(),true);
 assert.equal(await page.locator('.project-intro .hero-actions').isVisible(),true);
 assert.equal(await page.locator('.project-intro .intro-boundary').isVisible(),true);
 assert.equal(await page.locator('.project-intro .portfolio-result').isVisible(),true);
 const guide=page.locator('#app > details.public-guide');
 assert.equal(await guide.count(),1,'one public easy guide outside expert evidence');
 assert.equal(await guide.evaluate(e=>e.open),false,'easy guide starts collapsed');
 const guideSummary=guide.locator(':scope > summary');
 const guideText=await guide.textContent();
 assert.equal(await guide.locator('article').count(),5,'five distinct public feature groups');
 for(let repeat=0;repeat<2;repeat++){
  await guideSummary.press('Enter');assert.equal(await guide.evaluate(e=>e.open),true);
  assert.equal(await guide.locator('article').first().isVisible(),true);
  assert.equal(await panel.evaluate(e=>e.open),false,'easy guide does not open expert evidence');
  assert.equal(await guide.textContent(),guideText,'opening does not modify guide content');
  await guideSummary.press('Space');assert.equal(await guide.evaluate(e=>e.open),false);
  assert.equal(await guide.locator('article').first().isVisible(),false);
 }
 const critical=await page.locator('.project-intro').innerText();
 assert.match(critical,/잠정|provisional/i);assert.match(critical,/홀드아웃|holdout/i);assert.match(critical,/현장|field/i);
 const evidence=await panel.textContent();
 for(const term of ['40','5','35','19','2.04'])assert.ok(evidence.includes(term),`retained saved evaluation ${term}`);
 const linkTargets=await panel.locator('a[href]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 assert.ok(linkTargets.includes('#limitations'),'professional methodology route is retained');
 assert.ok(linkTargets.some(h=>h.includes('top_k_test.csv')),'raw evidence source retained');
 for(let repeat=0;repeat<2;repeat++){
  await summary.press('Enter');assert.equal(await panel.evaluate(e=>e.open),true);
  assert.equal(await page.locator('#process').isVisible(),true);
  assert.equal(await panel.textContent(),evidence,'expanding does not recompute or discard evidence');
  await summary.press('Space');assert.equal(await panel.evaluate(e=>e.open),false);
  assert.equal(await page.locator('#process').isVisible(),false);
 }
 const initial=new URL(page.url());
 for(const hash of ['result','process','answer-overview']){
  const target=new URL(initial);target.hash=hash;
  await page.goto(target.href);await page.locator('#app .absolute-beginner').waitFor();
  const element=page.locator('#'+hash);await element.waitFor({state:'visible'});
  assert.equal(await panel.evaluate(e=>e.open),true,`${hash} reveals detailed evidence`);
  try {
   await page.waitForFunction(id=>{const target=document.getElementById(id),header=document.querySelector('.topbar');return target&&target.getBoundingClientRect().top>=header.getBoundingClientRect().bottom-2&&target.getBoundingClientRect().top<innerHeight;},hash);
  } catch(error) {
   error.disclosureDiagnostic=await page.evaluate(id=>{
    const rect=e=>e?{...e.getBoundingClientRect().toJSON()}:null;
    const target=document.getElementById(id),header=document.querySelector('.topbar');
    const ancestors=[];for(let e=target;e;e=e.parentElement){const style=getComputedStyle(e);ancestors.push({tag:e.tagName,id:e.id,className:e.className,open:e.open,rect:rect(e),overflow:style.overflow,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,scrollPaddingTop:style.scrollPaddingTop,scrollMarginTop:style.scrollMarginTop,position:style.position});}
    return {url:location.href,requestedHash:id,viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY,height:document.documentElement.scrollHeight},target:rect(target),header:rect(header),activeElement:{tag:document.activeElement?.tagName,id:document.activeElement?.id},fonts:document.fonts.status,ancestors};
   },hash);
   error.message+='\nAnchor diagnostic: '+JSON.stringify(error.disclosureDiagnostic);
   throw error;
  }
  await page.locator('.cc-navigation > a[data-route=risks]').press('Enter');await page.locator('.table-shell tbody tr').first().waitFor();
  await page.goBack();await element.waitFor({state:'visible'});
  assert.equal(await panel.evaluate(e=>e.open),true,'Back reveals the target again');
 }
 await page.goto(initial.href);await page.locator('.absolute-beginner').waitFor();assert.equal(await panel.evaluate(e=>e.open),false);
}
module.exports={openProfessionalDetails,assertProfessionalDisclosure};
