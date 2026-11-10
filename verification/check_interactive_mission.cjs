// Local/CI browser validation of public UI and exported synthetic state. Not safety validation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FABGUARD_BASE_URL||'http://127.0.0.1:8775',out=process.env.FABGUARD_UI_OUTPUT||'/tmp/fabguard-interactive-browser';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
try{for(const width of [1366,390,360])for(const theme of ['dark','silver']){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await page.clock.install({time:new Date('2026-11-11T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-11T00:01:00Z'));
 const advance=async(ms)=>{for(let i=0;i<ms;i+=100)await page.clock.fastForward(Math.min(100,ms-i));};
 let n=0;const snapshot=async()=>{const download=page.waitForEvent('download');await page.locator('#export').press('Enter');const d=await download,file=path.join(out,`${width}-${theme}-${n++}.json`);await d.saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));};
 await page.goto(base+'/smt/');await advance(200);assert.equal(await page.locator('#view-error').isVisible(),false);
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme-toggle').press('Enter');
 await page.locator('#reset').press('Enter');await advance(200);assert.match(await page.locator('#run-status').innerText(),/일시정지/);
 await page.locator('#peak-assumption').fill('260');await page.locator('#apply-peak').press('Enter');assert.equal((await snapshot()).pending_peak_celsius,260);
 await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');await advance(3600);
 const mid=await snapshot();assert.equal(mid.boards[1].peak,null);assert.equal(mid.boards[1].rawPeak,260);
 await page.locator('#simulation-stop').press('Enter');const frozen=await snapshot();await advance(1000);assert.deepEqual((await snapshot()).boards,frozen.boards);assert.equal(await page.locator('#play').isDisabled(),true);
 await page.locator('#release-stop').press('Enter');await advance(1000);assert.equal((await snapshot()).simulation_seconds,frozen.simulation_seconds);
 await page.locator('#play').press('Enter');await advance(6000);await page.locator('#play').press('Enter');await advance(200);
 const observed=await snapshot();assert.equal(observed.boards[1].peak,260);assert.equal(observed.boards[1].aoi,'NG');assert.match(await page.locator('#lot-mission').innerText(),/가상 NG 1/);
 await page.locator('#lot-mission button').first().press('Enter');assert.equal(await page.locator('#lot-mission button').first().getAttribute('aria-pressed'),'true');
 await page.locator('.mission-controls').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}-${theme}-controls.png`)});
 await page.locator('#viewport').scrollIntoViewIfNeeded();await page.locator('#viewport').screenshot({path:path.join(out,`${width}-${theme}-scene.png`)});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'Horizontal document overflow');
 await page.locator('#reset').press('Enter');await page.locator('[data-fault="missing"]').press('Enter');await page.locator('#speed').selectOption('4');await page.locator('#play').press('Enter');await advance(4000);await page.locator('#simulation-stop').press('Enter');assert.match(await page.locator('#lot-mission').innerText(),/HOLD 1/);await page.locator('#release-stop').press('Enter');assert.match(await page.locator('#lot-mission').innerText(),/HOLD 1/);
 await page.locator('#reset').press('Enter');const reset=await snapshot();assert.equal(reset.control_events.length,0);assert.equal(reset.emergency_stopped,false);assert.equal(reset.boards.length,1);assert.equal(reset.pending_peak_celsius,null);assert.equal(errors.length,0,errors.join('\n'));
 rows.push({width,theme,webgl:true,temperatureNextBoard:true,stopLatch:true,holdPreserved:true,reset:true,horizontalOverflow:false});await ctx.close();
 }
 // Deliberately disabled WebGL: the same public controls and exports must still work.
 const b=await chromium.launch({headless:true,executablePath:process.env.FABGUARD_BROWSER_PATH||'/usr/bin/chromium',args:['--disable-webgl']});try{const p=await b.newPage({reducedMotion:'reduce'});await p.goto(base+'/smt/');assert.equal(await p.locator('#view-error').isVisible(),true);await p.locator('#apply-peak').click();assert.match(await p.locator('#mission-status').innerText(),/260/);await p.locator('#simulation-stop').click();assert.equal(await p.locator('#play').isDisabled(),true);await p.locator('#release-stop').click();assert.equal(await p.locator('#play').isDisabled(),false);rows.push({webgl:false,controls:true});}finally{await b.close();}
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
