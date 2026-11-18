// Capture the old and detailed cutaways with identical camera, pose, light and renderer.
// Runs on the same real Chromium as the interactive checks but uses an unfaked clock.
const {performance} = require('node:perf_hooks');
const {writeFileSync} = require('node:fs');
const {join} = require('node:path');
const assert = require('node:assert/strict');

module.exports = async function compareTeaching(browser, base, out) {
  const results=[];
  for (const width of [1024,360]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    try {
      const errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      page.on('console',m=>{if(m.type()==='error' && /THREE.WebGLProgram|Shader Error/.test(m.text())) errors.push(m.text());});
      await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
      await page.goto(base+'/smt/');
      const perf=[];
      for(const mode of ['normal','cutaway','compare']){
        if(mode==='cutaway') await page.locator('#teaching-cutaway').click();
        if(mode==='compare') await page.locator('#teaching-mode').selectOption(mode);
        await page.locator('#viewport').scrollIntoViewIfNeeded();
        const sample=await page.evaluate(async()=>{
          const view=document.querySelector('#viewport'),canvas=view.querySelector('canvas'),gl=canvas.getContext('webgl2');
          const info=gl.getExtension('WEBGL_debug_renderer_info');
          const stamps=[];
          await new Promise(resolve=>{
            function sample(t){
              // Exercise a changing camera, not an idle cached frame.
              view.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
              stamps.push(t);
              if(stamps.length<16)requestAnimationFrame(sample);else resolve();
            }
            requestAnimationFrame(sample);
          });
          const times=stamps.slice(5).map((v,i)=>v-stamps[i+4]).sort((a,b)=>a-b);
          return {samples:times.length,medianFrameMs:times[5],p90FrameMs:times[9],buffer:[canvas.width,canvas.height],
            renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
        });
        perf.push({mode,...sample});
      }
      // Work on a fresh static document on the same origin so the live scene no longer consumes frames.
      await page.goto(base+'/smt/references.html');
      const began=performance.now();
      const images=await page.evaluate(async({width})=>{
        const T=await import('/smt/vendor/three.module.js');
        const {buildPlacementHousing}=await import('/smt/placement-housing.mjs');
        const {mountPlacementDetails}=await import('/smt/placement-details.mjs');
        const {buildTeachingModel}=await import('/smt/placement-teaching.mjs');
        const {studioEnvironment}=await import('/smt/placement-cutaway.mjs');
        const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
        const h=width===360?340:512;
        renderer.setSize(width,h);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
        const station=new T.Group(),cover=new T.Group();station.add(cover);station.userData.cover=cover;
        buildPlacementHousing(station,cover,2.25,6);
        const head=new T.Mesh(new T.CylinderGeometry(.11,.11,.48,12),new T.MeshStandardMaterial({color:0x3d7485,roughness:.5}));
        head.position.set(0,1.8,0);station.add(head);mountPlacementDetails(station,head,2.25,6);
        cover.visible=false;
        const guide=buildTeachingModel(station,6);
        guide.style('cutaway',0);guide.pose('cutaway',0);
        const scene=new T.Scene();scene.background=new T.Color(0x24323d);scene.environment=studioEnvironment();
        scene.add(new T.HemisphereLight(0xe4f2ff,0x83959b,1.8));
        const key=new T.DirectionalLight(0xfff3db,2.8);key.position.set(3,6,4);scene.add(key);
        const rim=new T.DirectionalLight(0xa5ddff,2.2);rim.position.set(-4,3,-3);scene.add(rim);
        const views={station:[0,1.22,.10,1.88],nozzle:[0,1.78,0,.66],feeder:[0,.90,1.07,1.06]};
        const images=[];
        for(const [view,[x,y,z,radius]] of Object.entries(views)){
          const camera=new T.PerspectiveCamera(38,width/h,.1,50);
          const half=T.MathUtils.degToRad(19),d=radius/Math.sin(Math.min(half,Math.atan(Math.tan(half)*width/h)));
          camera.position.set(x+d*Math.sin(.4)*Math.cos(.35),y+d*Math.sin(.35),z+d*Math.cos(.4)*Math.cos(.35));camera.lookAt(x,y,z);
          for(const [version,object] of [['before',station],['after',guide.model]]){
            scene.add(object);renderer.render(scene,camera);
            images.push({version,view,png:renderer.domElement.toDataURL('image/png').split(',')[1],
              calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
            scene.remove(object);
          }
        }
        guide.dispose();scene.environment.dispose();renderer.dispose();
        return images;
      },{width});
      for(const item of images) writeFileSync(join(out,`matched-${width}-${item.view}-${item.version}.png`),Buffer.from(item.png,'base64'));
      for(const key of ['station','nozzle','feeder']){
        const pair=images.filter(i=>i.view===key);assert.notEqual(pair[0].png,pair[1].png);
      }
      assert.deepEqual(errors,[]);
      results.push({width,liveOrbit:perf,stillRenderWallMs:Math.round(performance.now()-began),
        matched:images.map(({version,view,calls,triangles})=>({version,view,calls,triangles}))});
    }finally{await page.close();}
  }
  writeFileSync(join(out,'teaching-comparison.json'),JSON.stringify(results,null,2));
};
