// CI-only read-only geometry observation, plus public UI actions. No safety validation.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8764',origin=new URL(base).origin;
const output=path.join(process.env.FABGUARD_UI_OUTPUT,'floor-agv');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[];let browser,activePage;
const observation=`
const originalAdd=Scene.prototype.add;
Scene.prototype.add=function(...objects){if(objects.some(o=>o.name==='synthetic-floor-agv-a01'))globalThis.__agvScene=this;return originalAdd.apply(this,objects);};
const originalLookAt=Object3D.prototype.lookAt;
Object3D.prototype.lookAt=function(...args){if(this.isPerspectiveCamera)globalThis.__agvCamera=this;return originalLookAt.apply(this,args);};
globalThis.__agvThree={Box3,Vector3};
`;
async function sample(page){return page.evaluate(()=>{
 const scene=globalThis.__agvScene,camera=globalThis.__agvCamera,{Box3,Vector3}=globalThis.__agvThree;
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const vehicles=[];scene.traverse(o=>{if(o.name==='synthetic-floor-agv-a01')vehicles.push(o);});
 const vehicle=vehicles[0],route=scene.getObjectByName('synthetic-floor-agv-route');
 if(!vehicle||!route)throw Error('Actual AGV and route geometry missing');
 let meshes=0,cylinders=0;const bounds=new Box3();vehicle.traverse(o=>{if(o.isMesh){meshes++;if(o.geometry.type==='CylinderGeometry')cylinders++;bounds.expandByObject(o);}});
 const size=bounds.getSize(new Vector3()).toArray(),center=bounds.getCenter(new Vector3()).project(camera).toArray();
 const routeBounds=new Box3().setFromObject(route),corners=[];
 for(const x of [routeBounds.min.x,routeBounds.max.x])for(const z of [routeBounds.min.z,routeBounds.max.z])corners.push(new Vector3(x,routeBounds.min.y,z).project(camera).toArray());
 return {count:vehicles.length,meshes,cylinders,size,center,corners,phase:vehicle.userData.phase,position:vehicle.position.toArray(),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},routeBounds:{min:routeBounds.min.toArray(),max:routeBounds.max.toArray()},board:document.querySelector('#board-select').value};
 });}
function samePosition(a,b,message){assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.03),message+': '+JSON.stringify({a,b}));}
function framed(s){assert.ok([...s.corners,s.center].every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1&&p[2]>-1&&p[2]<1),JSON.stringify({message:'Route and vehicle must be in the actual camera frustum',s}));}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH,args:['--use-angle=swiftshader']});
 for(const width of process.env.FABGUARD_UI_WIDTH?[Number(process.env.FABGUARD_UI_WIDTH)]:[1366,390,360])for(const theme of ['silver','dark']){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();activePage=page;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async r=>{
   const url=new URL(r.request().url());if(url.origin!==origin)return r.abort();
   if(url.pathname==='/smt/vendor/three.module.js'){const response=await r.fetch();return r.fulfill({response,body:(await response.text())+observation});}
   return r.continue();
  });
  await page.clock.install({time:new Date('2026-10-30T00:00:00Z')});
  const advance=async ms=>{for(let t=0;t<ms;t+=100)await page.clock.fastForward(Math.min(100,ms-t));};
  const capture=async name=>{
   await page.clock.resume();await page.locator('#viewport').scrollIntoViewIfNeeded();
   const bytes=await page.locator('#viewport').screenshot({path:path.join(output,`${width}-${theme}-${name}.png`)});
   await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));return crypto.createHash('sha256').update(bytes).digest('hex');
  };
  const snapshot=async name=>{const download=page.waitForEvent('download');await page.locator('#export').press('Enter');const d=await download;const file=path.join(output,`${width}-${theme}-${name}.json`);await d.saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));};
  await page.goto(new URL('/smt/',base).href);await advance(200);
  assert.equal(await page.locator('#view-error').isVisible(),false);assert.equal(await page.locator('#viewport canvas').count(),1);
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').press('Enter');
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  await page.locator('#reset').press('Enter');await advance(200);assert.match(await page.locator('#run-status').innerText(),/일시정지/);
  const initial=await sample(page);assert.equal(initial.count,1);assert.ok(initial.meshes>=8);assert.ok(initial.cylinders>=4,'Actual wheel primitives');assert.ok(initial.size[1]<2,'Floor chassis, not overhead robot');
  framed(initial);await capture('overview');
  await page.locator('#floor-agv-select').press('Enter');await advance(200);assert.equal(await page.locator('#station-strip [aria-pressed=true]').count(),0);assert.equal(await page.locator('#equipment-reference').isVisible(),false);assert.equal(await page.locator('#inside-view').isDisabled(),true);assert.match(await page.locator('#station-info').innerText(),/합성 바닥형 AGV/);framed(await sample(page));await capture('route');
  await page.locator('#top-view').press('Enter');await advance(200);framed(await sample(page));await capture('top');
  await page.locator('#floor-agv-select').press('Enter');await advance(200);
  const start=await sample(page);assert.equal(start.phase,'transport');
  await page.locator('#play').press('Enter');await advance(2000);await page.locator('#play').press('Enter');await advance(200);
  const moving=await sample(page);assert.notDeepEqual(moving.position,start.position);assert.deepEqual(moving.camera,start.camera,'Movement does not steal camera');
  const transportHash=await capture('transport');await advance(700);assert.deepEqual((await sample(page)).position,moving.position,'Global pause freezes AGV');
  await page.locator('#floor-agv-toggle').press('Enter');await page.locator('#play').press('Enter');await advance(1000);
  assert.deepEqual((await sample(page)).position,moving.position,'AGV-only pause freezes while SMT advances');
  await page.locator('#floor-agv-toggle').press('Enter');
  let wait;for(let i=0;i<180;i++){await advance(100);wait=await sample(page);if(wait.phase==='wait')break;}assert.equal(wait.phase,'wait');
  await advance(500);assert.deepEqual((await sample(page)).position,wait.position,'Illustrative loading wait is stationary');
  await page.locator('#play').press('Enter');const waitHash=await capture('wait');await page.locator('#play').press('Enter');
  let blocked;for(let i=0;i<180;i++){await advance(100);blocked=await sample(page);if(blocked.phase==='blocked')break;}assert.equal(blocked.phase,'blocked');
  await advance(2000);assert.deepEqual((await sample(page)).position,blocked.position,'Blocked route stays blocked until reset');
  assert.match(await page.locator('#floor-agv-status').innerText(),/막힘|차단/);
  await page.locator('#play').press('Enter');const blockedHash=await capture('blocked');
  const before=await snapshot('before-agv-reset'),preserved=await sample(page);
  await page.locator('#floor-agv-reset').press('Enter');await page.locator('#floor-agv-reset').press('Enter');await advance(200);
  const reset=await sample(page);assert.equal(reset.phase,'transport');samePosition(reset.position,start.position,'AGV reset returns to start');assert.deepEqual(reset.camera,preserved.camera);assert.equal(reset.board,preserved.board);
  assert.deepEqual(await snapshot('after-agv-reset'),before,'AGV reset cannot change production PCB/export model');
  await page.locator('#play').press('Enter');await advance(2000);await page.locator('#play').press('Enter');await advance(200);
  samePosition((await sample(page)).position,moving.position,'Reset deterministically replays the same travel');
  await page.locator('#reset').press('Enter');await advance(200);assert.equal(await page.locator('#completed').innerText(),'0');assert.equal(await page.locator('#board-select option').count(),1);samePosition((await sample(page)).position,start.position,'Global reset returns to start');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checks.push({width,theme,initial,transport:moving,wait,blocked,hashes:{transportHash,waitHash,blockedHash},globalPause:true,independentPause:true,blockedLatch:true,resetReplay:true,exportUnchanged:true});
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,errors,scope:'Synthetic floor AGV geometry/UI only. No real fleet, collision avoidance or safety certification.'},null,2));assert.deepEqual(errors,[]);
})().catch(async e=>{if(activePage){await activePage.clock.resume().catch(()=>{});await activePage.screenshot({path:path.join(output,'failure.png'),timeout:10000}).catch(()=>{});}fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,checks,errors},null,2));await browser?.close().catch(()=>{});console.error(e);process.exitCode=1;});
