// One-off paired experiment. Run each width in one Chromium instance on one runner.
const {chromium}=require('playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const width=Number(process.env.WIDTH), root=process.cwd(), out='benchmark-'+width;
fs.mkdirSync(out,{recursive:true});
const baseSHA='74309653e3740080f133ca4ed4c443ec1648529e';
const priorSHA='8af2730e19c2f2d8ca3ae67f252b715bf2935132';
const scripts=['app.mjs','placement-teaching.mjs','placement-cutaway.mjs','placement-housing.mjs'];
const files={};
for(const file of scripts){
  const key='web/smt/'+file;
  files[file]={
    candidate:fs.readFileSync(key,'utf8'),
    base:execFileSync('git',['show',baseSHA+':'+key],{encoding:'utf8'}),
    prior:execFileSync('git',['show',priorSHA+':'+key],{encoding:'utf8'})
  };
}
function stats(a){const sorted=[...a].sort((a,b)=>a-b);return {mean:a.reduce((s,x)=>s+x,0)/a.length,
  median:sorted[Math.floor(sorted.length*.5)],p90:sorted[Math.ceil(sorted.length*.9)-1]};}
async function run(browser,variant,round,images=false){
  const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await ctx.newPage(), errors=[];
  try{
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url()), name=url.pathname.split('/').pop();
      if(url.origin!=='http://127.0.0.1:8775')return route.abort();
      if(!url.pathname.startsWith('/smt/')||!files[name])return route.continue();
      let source=files[name].base;
      if(variant==='candidate' && name==='placement-teaching.mjs'){
        source=source.replace('renderer.setScissorTest(true);',
          'renderer.setOpaqueSort((a,b)=>a.groupOrder-b.groupOrder || a.renderOrder-b.renderOrder || a.z-b.z || a.id-b.id);renderer.setScissorTest(true);');
        source=source.replace('finally{renderer.setScissorTest(false);','finally{renderer.setOpaqueSort(null);renderer.setScissorTest(false);');
        assert(source.includes('renderer.setOpaqueSort(null)'));
      }
      if(variant==='priorMechanism' && name==='placement-cutaway.mjs'){
        const marker='// A small procedurally lit studio environment';
        assert(source.includes(marker) && files[name].prior.includes(marker));
        source=files[name].prior.split(marker)[0]+marker+source.split(marker)[1];
      }
      if(variant==='noGrain' && name==='placement-cutaway.mjs'){
        const needle="roughnessMap:['steel','bright','brass'].includes(finish)?grain:null";
        assert(source.includes(needle));source=source.replace(needle,"roughnessMap:null");
      }
      if(variant==='noShadow' && name==='app.mjs'){
        assert(source.includes('renderer.shadowMap.enabled=true'));
        source=source.replace('renderer.shadowMap.enabled=true','renderer.shadowMap.enabled=false');
      }
      return route.fulfill({status:200,contentType:'text/javascript',body:source});
    });
    await page.goto('http://127.0.0.1:8775/smt/');
    await page.locator('#reset').click();
    await page.locator('#station-strip button').nth(3).click();
    await page.locator('#teaching-cutaway').click();
    await page.locator('#teaching-mode').selectOption('compare');
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    const result=await page.evaluate(async()=>{
      const view=document.querySelector('#viewport'), canvas=view.querySelector('canvas'),gl=canvas.getContext('webgl2');
      const info=gl.getExtension('WEBGL_debug_renderer_info'), times=[];
      await new Promise(resolve=>{
        function tick(t){
          view.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
          times.push(t);
          if(times.length<73)requestAnimationFrame(tick);else resolve();
        }
        requestAnimationFrame(tick);
      });
      return {frames:times.slice(13).map((t,i)=>t-times[i+12]),renderer:gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        buffer:[canvas.width,canvas.height],dpr:devicePixelRatio};
    });
    if(images){
      for(const target of ['all','nozzle','feeder']){
        await page.locator('#teaching-focus').selectOption(target);
        // Read in the same RAF as the actual renderer, after its registered frame callback.
        const b64=await page.evaluate(async()=>{
          await new Promise(r=>requestAnimationFrame(r));
          return new Promise(resolve=>requestAnimationFrame(()=>{
            const c=document.querySelector('#viewport canvas'),gl=c.getContext('webgl2'),buf=new Uint8Array(c.width*c.height*4);
            gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,buf);
            let binary='';for(let i=0;i<buf.length;i+=16384)binary+=String.fromCharCode(...buf.subarray(i,i+16384));
            resolve(btoa(binary));
          }));
        });
        const pix=Buffer.from(b64,'base64');assert(new Set(pix).size>40);
        const tag=target+'-'+width;
        if(variant==='base')captures.set(tag,pix);
        if(variant==='candidate'){
          const ref=captures.get(tag);assert.equal(ref.length,pix.length);
          let changed=0,strong=0,abs=0,peak=0;for(let i=0;i<pix.length;i+=4){const delta=Math.max(...[0,1,2].map(c=>Math.abs(pix[i+c]-ref[i+c])));if(delta)changed++;if(delta>8)strong++;abs+=delta;peak=Math.max(peak,delta);}
          result.diffs??={};result.diffs[target]={pixels:pix.length/4,changed,strong,meanMaxChannelError:abs/(pix.length/4),peak};
        }
        if(target==='all')await page.locator('#viewport canvas').screenshot({path:path.join(out,variant+'-orbit.png')});
      }
    }
    assert.deepEqual(errors,[]);return {variant,round,...result,...stats(result.frames)};
  }finally{await ctx.close();}
}
const captures=new Map();
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results={width,chrome:browser.version(),baseSHA,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runs:[]};
 try{
  await run(browser,'base',-1);
  const order=['base','candidate','candidate','base','noGrain','priorMechanism','priorMechanism','noGrain','base','candidate','candidate','base'];
  for(const [round,v] of order.entries()){
    const record=await run(browser,v,round,round<2);
    results.runs.push(record);
    fs.writeFileSync(path.join(out,'timings.json'),JSON.stringify(results,null,2));
    console.log(round,v,record.mean.toFixed(2),record.median.toFixed(2),record.p90.toFixed(2),record.diffs||'');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
