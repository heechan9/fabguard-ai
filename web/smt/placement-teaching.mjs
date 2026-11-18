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
export function buildTeachingModel(station) {
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
      if (!original.isMesh) return;
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
      const copy = original.isInstancedMesh ? original.clone(false) : new THREE.Mesh(original.geometry);
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

  function style(mode, step) {
    const field = FIELDS[mode];
    for (const item of styles) {
      const {material, part} = item;
      material.color.copy(item.color);
      if (item.emissive) material.emissive.copy(item.emissive);
      material.emissiveIntensity = item.intensity;
      material.metalness = item.metalness;
      if (field && Object.hasOwn(field.levels, part)) {
        const color = field.colors[field.levels[part]];
        material.color.setHex(color);
        material.emissive?.setHex(color);
        material.emissiveIntensity = 0.22;
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
    for (const material of materials.values()) material.dispose();
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
  let mode = 'normal', scene, illustration, camera, origin, stationIndex, step = 0;
  let progress = 0, from = 0, started = 0, duration = 0, dirty = true, lastFrame = '';
  modeInput.disabled = !available;
  byId('teaching-unavailable').hidden = available;
  for (const [index, [,label]] of STEPS.entries()) stepInput.add(new Option((index+1)+' · '+label, String(index)));

  function release() {
    illustration?.dispose();
    scene?.clear();
    illustration = scene = camera = null;
  }
  function close() {
    if (mode === 'normal') return;
    mode = modeInput.value = 'normal';
    release();
    legend.hidden = steps.hidden = caption.hidden = true;
    standardGuide.style.display = standardDisplay;
    restoreAngles(origin);
    viewport.setAttribute('aria-label', viewportLabel);
    viewport.classList.remove('teaching-active');
  }
  function chooseStep(value, animate = true) {
    step = Math.max(0, Math.min(STEPS.length-1, value));
    stepInput.value = String(step);
    back.disabled = step === 0;
    next.disabled = step === STEPS.length-1;
    from = progress;
    started = performance.now();
    duration = animate && !reducedMotion.matches ? Math.min(1000, Math.abs(step-from)*420) : 0;
    if (!duration) progress = step;
    byId('teaching-description').textContent = STEPS[step][2];
    illustration.style('assembly',step);
    dirty = true;
  }
  function open(value) {
    if (value === 'normal') return close();
    if (!available || (!Object.hasOwn(FIELDS,value) && value !== 'assembly')) return;
    if (mode === 'normal') {
      stationIndex = currentStation() === 4 ? 4 : 3;
      illustration = buildTeachingModel(stations[stationIndex]);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x15252e);
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
    legend.hidden = !field;
    caption.hidden = false;
    standardGuide.style.display = 'none';
    viewport.classList.add('teaching-active');
    viewport.setAttribute('aria-label', '실장기 설명용 3D 보기. 드래그 또는 화살표로 회전하고 더하기·빼기 키로 확대를 조절합니다.');
    const stationName = String(stationIndex+1).padStart(2,'0')+'번 실장기';
    if (field) {
      caption.textContent = stationName+' · '+field.label+' 색 분포 예시';
      const labels = Object.entries(field.levels).sort((a,b)=>a[1]-b[1]).map(([id, level]) => {
        const swatch = document.createElement('span');
        const dot = document.createElement('i');
        dot.style.backgroundColor = '#'+field.colors[level].toString(16).padStart(6,'0');
        swatch.append(dot,['낮음','중간','높음'][level]+' · '+STEPS.find(([key])=>key===id)[1]);
        return swatch;
      });
      byId('teaching-scale').replaceChildren(...labels);
      byId('teaching-field-note').textContent = '부품별로 지정한 설명용 합성 '+field.label+' 분포입니다. 센서 측정값·물리 해석값은 제공하지 않습니다.';
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
  function render(renderer, now) {
    const {azimuth,elevation,zoom} = angles();
    const aspect = viewport.clientWidth / Math.max(1,viewport.clientHeight);
    const signature = [azimuth,elevation,zoom,viewport.clientWidth,viewport.clientHeight].join('/');
    if (mode === 'assembly' && progress !== step) {
      const t = reducedMotion.matches || !duration ? 1 : Math.min(1,Math.max(0,(now-started)/duration));
      progress = from+(step-from)*(t*t*(3-2*t));
      dirty = true;
    }
    if (!dirty && signature === lastFrame) return;
    illustration.pose(mode, progress);
    const yaw = .40 + azimuth-origin.azimuth;
    const pitch = THREE.MathUtils.clamp(.35+elevation-origin.elevation,-.2,1.52);
    const halfFov = THREE.MathUtils.degToRad(camera.fov/2);
    const limitingFov = Math.min(halfFov, Math.atan(Math.tan(halfFov)*aspect));
    const distance = (mode==='assembly' ? 2.03 : 1.88)/Math.sin(limitingFov)*THREE.MathUtils.clamp(zoom/origin.zoom,.42,2.5);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    const height = mode === 'assembly' ? 1.45 : 1.22;
    camera.position.set(distance*Math.sin(yaw)*Math.cos(pitch),height+distance*Math.sin(pitch),.10+distance*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(0,height,.10);
    renderer.render(scene,camera);
    lastFrame = signature;
    dirty = false;
  }
  return {get active(){return mode !== 'normal';}, close, render};
}
