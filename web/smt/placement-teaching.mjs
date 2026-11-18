import {addMechanismDetails, studioEnvironment} from './placement-cutaway.mjs';
import * as THREE from './vendor/three.module.js';

export const STEPS = [
  ['base', '본체', '하부 캐비닛과 기판 통로가 설비의 기준 위치를 이룹니다.', [0, 0, 0]],
  ['feeder', '피더 뱅크', '릴과 카세트가 기판 통로 앞쪽에 나란히 놓입니다.', [0, 0.25, 0.72]],
  ['rail', '가이드 레일', '브리지와 가이드 축이 통로 위에서 헤드의 이동 방향을 보여줍니다.', [0, 0.65, -0.25]],
  ['nozzle', '캐리지·노즐', '캐리지는 레일을 따라 움직이고 노즐 끝은 기판 쪽을 향합니다.', [0.45, 0.65, 0]],
  ['cover', '외장 덮개', '창과 상부 덮개가 내부 기구를 감싸며 본체 형상이 완성됩니다.', [0, 0.8, 0]]
];

export const FIELDS = {
  temperature: {
    label: '온도', colors: [0x2977bb, 0xf1c55d, 0xe84e32],
    levels: { feeder: 0, rail: 1, nozzle: 2 }
  },
  stress: {
    label: '응력', colors: [0x32a997, 0xa48de3, 0xe55e99],
    levels: { nozzle: 0, feeder: 1, rail: 2 }
  }
};

// Use the actual station geometry. The teaching scene owns its materials and transforms.
export function buildTeachingModel(station, feederCount) {
  const model = new THREE.Group();
  const groups = Object.fromEntries(STEPS.map(([id]) => [id, new THREE.Group()]));
  model.add(...Object.values(groups));
  const housing = station.getObjectByName('placement-engineering-body');
  const details = station.getObjectByName('schematic-placement-details');
  const head = station.children.find(child => child.userData.explanatoryPart === 'nozzle');
  const cover = station.userData.cover;
  station.updateWorldMatrix(true, true);
  const toStation = station.matrixWorld.clone().invert();
  const neutralHead = new THREE.Matrix4().makeTranslation(-head.position.x, 1.8-head.position.y, -head.position.z);
  const materials = new Map();
  const styles = [];

  function copyGroup(source, defaultPart, centerHead = false) {
    source.traverse(original => {
      if (!original.isMesh || original === head) return;
      // The open bay and spoked reels replace the solid teaching proxies.
      if (source === housing && !original.userData.explanatoryPart &&
          original.position.y > .22 && original.position.y < .71) return;
      if (original.userData.explanatoryPart === 'feeder' && original.geometry.type === 'CylinderGeometry' &&
          original.position.z > 1.10 && original.position.y < .85) return;
      const part = original.userData.explanatoryPart || defaultPart;
      const key = part + ':' + original.material.uuid;
      if (!materials.has(key)) {
        const material = original.material.clone();
        // Live selection uses emissive highlights. Keep the unselected finish here.
        if (['feeder','rail','nozzle'].includes(part)) material.emissive?.setHex(0);
        materials.set(key, material);
        styles.push({part, material, color:material.color.clone(), emissive:material.emissive?.clone(),
          intensity:material.emissiveIntensity, metalness:material.metalness});
      }
      const copy = original.isInstancedMesh ? original.clone(false) : new THREE.Mesh(original.geometry, materials.get(key));
      copy.material = materials.get(key);
      const matrix = new THREE.Matrix4().multiplyMatrices(toStation, original.matrixWorld);
      if (centerHead) matrix.premultiply(neutralHead);
      matrix.decompose(copy.position,copy.quaternion,copy.scale);
      groups[part].add(copy);
    });
  }
  copyGroup(housing, 'base');
  copyGroup(cover, 'cover');
  copyGroup(details, 'base');
  copyGroup(head, 'nozzle', true);

  const mechanism = addMechanismDetails(groups, feederCount);
  for (const {part,material} of mechanism.materials) {
    styles.push({part,material,color:material.color.clone(),emissive:material.emissive.clone(),
      intensity:material.emissiveIntensity,metalness:material.metalness});
  }
  for (const item of styles) {
    if (!Object.hasOwn(FIELDS.temperature.levels,item.part)) continue;
    const uniforms = {
      guideLevel:{value:-1}, guideLow:{value:new THREE.Color()}, guideMid:{value:new THREE.Color()}, guideHigh:{value:new THREE.Color()}
    };
    item.uniforms=uniforms;
    item.material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader = 'varying vec3 guidePosition;\n'+shader.vertexShader.replace('#include <project_vertex>', `
        #include <project_vertex>
        vec4 guidePoint = vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          guidePoint = instanceMatrix * guidePoint;
        #endif
        guidePosition = (modelMatrix * guidePoint).xyz;
      `);
      shader.fragmentShader = 'varying vec3 guidePosition; uniform float guideLevel; uniform vec3 guideLow, guideMid, guideHigh;\n'+
        shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          if (guideLevel >= 0.0) {
            float blend = clamp(guideLevel*.35+.15 + .13*sin(guidePosition.x*4.0+guidePosition.z*2.0)
              + .10*cos(guidePosition.y*8.0-guidePosition.z*3.0),0.0,1.0);
            diffuseColor.rgb = mix(mix(guideLow,guideMid,smoothstep(0.0,.5,blend)),guideHigh,smoothstep(.5,1.0,blend));
          }
        `);
    };
    item.material.customProgramCacheKey = () => 'placement-illustration-field-v1';
  }
  function style(mode, step) {
    const field = FIELDS[mode];
    for (const item of styles) {
      const {material, part} = item;
      material.color.copy(item.color);
      if (item.emissive) material.emissive.copy(item.emissive);
      material.emissiveIntensity = item.intensity;
      material.metalness = item.metalness;
      if (item.uniforms) item.uniforms.guideLevel.value = field ? field.levels[part] : -1;
      if (field && Object.hasOwn(field.levels, part)) {
        const color = field.colors[field.levels[part]];
        item.uniforms.guideLow.value.setHex(field.colors[0]);
        item.uniforms.guideMid.value.setHex(field.colors[1]);
        item.uniforms.guideHigh.value.setHex(field.colors[2]);
        material.color.setHex(color);
        material.emissive?.setHex(color);
        material.emissiveIntensity = 0.09;
        material.metalness = 0.18;
      } else if (mode === 'assembly' && part === STEPS[step][0] && material.emissive) {
        material.emissive.setHex(0x398697);
        material.emissiveIntensity = 0.32;
      }
    }
  }

  function pose(mode, progress) {
    STEPS.forEach(([id, , , offset], index) => {
      const group = groups[id];
      const joined = index === 0 ? 1 : THREE.MathUtils.clamp(progress-index+1,0,1);
      group.visible = mode === 'assembly' ? joined > 0 : id !== 'cover';
      group.position.set(...offset).multiplyScalar(mode === 'assembly' ? 1-joined : 0);
    });
  }
  function dispose() {
    for (const {material} of styles) material.dispose();
    mechanism.dispose();
    model.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
  }
  return {model, groups, style, pose, dispose};
}

export function mountTeachingView({stations, currentStation, angles, restoreAngles, reducedMotion, available}) {
  const byId = id => document.getElementById(id);
  const settings = byId('teaching-settings'), modeInput = byId('teaching-mode');
  const legend = byId('teaching-legend'), steps = byId('teaching-steps');
  const stepInput = byId('teaching-step'), back = byId('teaching-back'), next = byId('teaching-next');
  const caption = byId('teaching-caption'), viewport = byId('viewport');
  const standardGuide = document.querySelector('.scene-reading-guide');
  const standardDisplay = standardGuide.style.display;
  const viewportLabel = viewport.getAttribute('aria-label');
  const insideNote = byId('inside-note');
  let insideWasHidden = true;
  let mode = 'normal', scene, illustration, camera, origin, stationIndex, step = 0;
  let focus = 'all', activeHighlight = -1;
  let progress = 0, from = 0, started = 0, duration = 0, dirty = true, lastFrame = '';
  modeInput.disabled = !available;
  const shortcut=byId('teaching-cutaway'), focusControl=byId('teaching-focus');
  shortcut.disabled=!available;
  shortcut.addEventListener('click',()=>{settings.open=true;modeInput.value='cutaway';open('cutaway');});
  focusControl.addEventListener('change',()=>{focus=focusControl.value;dirty=true;});
  byId('teaching-unavailable').hidden = available;
  for (const [index, [,label]] of STEPS.entries()) stepInput.add(new Option((index+1)+' · '+label, String(index)));

  function release() {
    illustration?.dispose();
    scene?.environment?.dispose();
    scene?.clear();
    illustration = scene = camera = null;
  }
  function close() {
    if (mode === 'normal') return;
    const restoreFocus = settings.open && (steps.contains(document.activeElement) || byId('teaching-focus-row').contains(document.activeElement));
    mode = modeInput.value = 'normal';
    release();
    legend.hidden = steps.hidden = caption.hidden = true;
    standardGuide.style.display = standardDisplay;
    restoreAngles(origin);
    insideNote.hidden = insideWasHidden;
    if(restoreFocus) modeInput.focus();
    viewport.setAttribute('aria-label', viewportLabel);
    viewport.classList.remove('teaching-active','teaching-compare');
    byId('teaching-pair').hidden = byId('teaching-focus-row').hidden = true;
  }
  function chooseStep(value, animate = true) {
    const previousStep = step;
    step = Math.max(0, Math.min(STEPS.length-1, value));
    stepInput.value = String(step);
    back.disabled = step === 0;
    next.disabled = step === STEPS.length-1;
    from = progress;
    started = performance.now();
    duration = animate && !reducedMotion.matches ? Math.min(1000, Math.abs(step-from)*420) : 0;
    if (!duration) progress = step;
    byId('teaching-description').textContent = (animate && step < previousStep ? STEPS[previousStep][1]+' 분리 · ' : '')+STEPS[step][2];
    activeHighlight=step;
    illustration.style('assembly',step);
    dirty = true;
  }
  function open(value) {
    if (value === 'normal') return close();
    if (!available || (!Object.hasOwn(FIELDS,value) && !['assembly','cutaway','compare'].includes(value))) return;
    if (mode === 'normal') {
      insideWasHidden = insideNote.hidden;
      insideNote.hidden = true;
      stationIndex = currentStation() === 4 ? 4 : 3;
      illustration = buildTeachingModel(stations[stationIndex],stationIndex===4?4:6);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x24323d);
      scene.environment = studioEnvironment();
      focus = focusControl.value = "all";
      const ambient = new THREE.HemisphereLight(0xe4f2ff, 0x83959b, 1.8);
      const key = new THREE.DirectionalLight(0xfff3db, 2.8); key.position.set(3,6,4);
      const rim = new THREE.DirectionalLight(0xa5ddff, 2.2); rim.position.set(-4,3,-3);
      scene.add(illustration.model, ambient, key, rim);
      camera = new THREE.PerspectiveCamera(38,1,.1,50);
      origin = angles();
      lastFrame = '';
    }
    mode = value;
    const field = FIELDS[mode];
    steps.hidden = mode !== 'assembly';
    const compare = mode === 'compare';
    legend.hidden = !field && !compare;
    byId('teaching-focus-row').hidden = mode === 'assembly';
    byId('teaching-pair').hidden = !compare;
    viewport.classList.toggle('teaching-compare',compare);
    caption.hidden = false;
    standardGuide.style.display = 'none';
    viewport.classList.add('teaching-active');
    viewport.setAttribute('aria-label', '실장기 설명용 3D 보기. 드래그 또는 화살표로 회전하고 더하기·빼기 키로 확대를 조절합니다.');
    const stationName = String(stationIndex+1).padStart(2,'0')+'번 실장기';
    if (field || compare) {
      caption.textContent = stationName+' · '+(compare?'온도·응력 동일 시점 비교':field.label+' 색 분포 예시');
      const fields=compare?[FIELDS.temperature,FIELDS.stress]:[field];
      const scales=fields.map(item=>{
      const row=document.createElement('div');row.className='teaching-scale-row';
      const title=document.createElement('b');title.textContent=item.label;row.append(title);
      const labels = Object.entries(item.levels).sort((a,b)=>a[1]-b[1]).map(([id, level]) => {
        const swatch = document.createElement('span');
        const dot = document.createElement('i');
        dot.style.backgroundColor = '#'+item.colors[level].toString(16).padStart(6,'0');
        swatch.append(dot,['낮음','중간','높음'][level]+' · '+STEPS.find(([key])=>key===id)[1]);
        return swatch;
      });
      row.append(...labels);return row;});
      byId('teaching-scale').replaceChildren(...scales);
      byId('teaching-field-note').textContent = '부품별로 지정한 설명용 합성 '+(compare?'온도·응력':field.label)+' 분포입니다. 색 변화는 예시이며 센서 측정값이나 해석 단위가 없습니다.';
      illustration.style(compare?'temperature':mode,0);
    } else if(mode==='cutaway'){
      caption.textContent=stationName+' · 기구 절개 모형 · 드래그로 회전';
      illustration.style(mode,0);
    } else {
      caption.textContent = stationName+' · 단계별 조립 모형';
      chooseStep(0,false);
    }
    dirty = true;
  }
  modeInput.addEventListener('change', () => open(modeInput.value));
  settings.addEventListener('toggle', () => { if (!settings.open) close(); });
  stepInput.addEventListener('change', () => chooseStep(Number(stepInput.value)));
  back.addEventListener('click', () => chooseStep(step-1));
  next.addEventListener('click', () => chooseStep(step+1));
  window.addEventListener('pagehide', close);
  viewport.querySelector('canvas')?.addEventListener('webglcontextrestored',()=>{dirty=true;});
  function render(renderer, now) {
    const {azimuth,elevation,zoom} = angles();
    const signature = [azimuth,elevation,zoom,viewport.clientWidth,viewport.clientHeight].join('/');
    if (mode === 'assembly' && progress !== step) {
      const t = reducedMotion.matches || !duration ? 1 : Math.min(1,Math.max(0,(now-started)/duration));
      progress = from+(step-from)*(t*t*(3-2*t));
      dirty = true;
    }
    if (!dirty && signature === lastFrame) return;
    illustration.pose(mode, progress);
    if(mode==='assembly' && progress!==step){
      const highlight=Math.ceil(progress);
      if(highlight!==activeHighlight){illustration.style(mode,highlight);activeHighlight=highlight;}
    }else if(mode==='assembly' && activeHighlight!==step){illustration.style(mode,step);activeHighlight=step;}
    const yaw = .40 + azimuth-origin.azimuth;
    const pitch = THREE.MathUtils.clamp(.35+elevation-origin.elevation,-.2,1.52);
    const targets={
      all:[0,mode==='assembly'?1.45:1.22,.10,mode==='assembly'?2.03:1.88],
      nozzle:[0,1.78,0,.66], rail:[0,2.05,.09,1.24], feeder:[0,.9,1.07,1.06]
    };
    const [x,height,z,radius]=targets[mode==='assembly'?'all':focus];
    const W=viewport.clientWidth,H=viewport.clientHeight;
    function renderPanel(left,bottom,width,heightPx){
      const panelAspect=width/Math.max(1,heightPx);
      const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
      const limitingFov=Math.min(halfFov,Math.atan(Math.tan(halfFov)*panelAspect));
      const distance=radius/Math.sin(limitingFov)*THREE.MathUtils.clamp(zoom/origin.zoom,.42,2.5);
      camera.aspect=panelAspect;camera.updateProjectionMatrix();
      camera.position.set(x+distance*Math.sin(yaw)*Math.cos(pitch),height+distance*Math.sin(pitch),z+distance*Math.cos(yaw)*Math.cos(pitch));
      camera.lookAt(x,height,z);
      renderer.setViewport(left,bottom,width,heightPx);
      if(mode==='compare') renderer.setScissor(left,bottom,width,heightPx);
      renderer.render(scene,camera);
    }
    if(mode==='compare'){
      const stacked=W<580, half=Math.floor((stacked?H:W)/2);
      renderer.setScissorTest(true);
      try{
        illustration.style('temperature',0);
        if(stacked)renderPanel(0,half,W,H-half);else renderPanel(0,0,half,H);
        illustration.style('stress',0);
        if(stacked)renderPanel(0,0,W,half);else renderPanel(half,0,W-half,H);
      }finally{renderer.setScissorTest(false);renderer.setViewport(0,0,W,H);}
    }else renderPanel(0,0,W,H);
    lastFrame = signature;
    dirty = false;
  }
  return {get active(){return mode !== 'normal';}, close, render};
}
