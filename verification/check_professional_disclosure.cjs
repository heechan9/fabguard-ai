// Native disclosure checks complement the scientific/data contracts, not replace them.
const assert=require('node:assert/strict');
async function openProfessionalDetails(page){
 const details=page.locator('details.professional-details');
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
 const summary=panel.locator(':scope > summary');
 assert.equal(await summary.isVisible(),true);
 assert.equal(await page.locator('.project-intro .hero-actions').isVisible(),true);
 assert.equal(await page.locator('.project-intro .intro-boundary').isVisible(),true);
 assert.equal(await page.locator('.project-intro .portfolio-result').isVisible(),true);
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
  if(hash!=='answer-overview')assert.equal(await panel.evaluate(e=>e.open),true,`${hash} reveals detailed evidence`);
  await page.waitForFunction(id=>{const target=document.getElementById(id),header=document.querySelector('.topbar');return target&&target.getBoundingClientRect().top>=header.getBoundingClientRect().bottom-2&&target.getBoundingClientRect().top<innerHeight;},hash);
  await page.locator('.cc-navigation > a[data-route=risks]').press('Enter');await page.locator('.table-shell tbody tr').first().waitFor();
  await page.goBack();await element.waitFor({state:'visible'});
  if(hash!=='answer-overview')assert.equal(await panel.evaluate(e=>e.open),true,'Back reveals the target again');
 }
 await page.goto(initial.href);await page.locator('.absolute-beginner').waitFor();assert.equal(await panel.evaluate(e=>e.open),false);
}
module.exports={openProfessionalDetails,assertProfessionalDisclosure};
