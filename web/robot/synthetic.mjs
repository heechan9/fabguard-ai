// SYNTHETIC demonstration files for the robot window demo. Not robot data, not IMAD-DS.
// Deterministic integer generator so every browser produces identical CSV bytes.

export const SYNTHETIC_CONFIG = Object.freeze({nominal_period_s: '0.001'});
const decimal = (n, scale) => { // integer n / 10^scale as an exact decimal string
  const sign = n < 0 ? '-' : '', a = Math.abs(n), s = String(a).padStart(scale + 1, '0');
  return `${sign}${s.slice(0, -scale)}.${s.slice(-scale)}`;
};

function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648);
}

function file(fileId, group, role, seed, n, {gapAt = null, nanAt = null, shiftAt = null, duplicateAt = null} = {}, note) {
  const next = lcg(seed), rows = [], times = [];
  for (let i = 0; i < n; i++) {
    let ms = gapAt !== null && i >= gapAt ? i + 25 : i;
    if (duplicateAt !== null && i === duplicateAt) ms -= 1;
    const noise = next() % 2001 - 1000;               // +/-0.01 g in 1e-5 steps
    const x = 100000 + (shiftAt !== null && i >= shiftAt ? 3000 : 0) + noise;
    const y = next() % 201 - 100, z = next() % 201 - 100;
    times.push(ms / 1000);
    rows.push([decimal(ms, 3), i === nanAt ? 'NaN' : decimal(x, 5), decimal(y, 4), decimal(z, 4)]);
  }
  return {fileId, group, role, times, rows, note};
}

export function syntheticFiles(kind = 'demo') {
  if (kind === 'error') {
    return [
      file('SYNTHETIC_ref_dataLog_1', 'SYNTHETIC_ref', 'reference', 11, 1020, {duplicateAt: 300}, '중복 시각 1건을 일부러 넣은 기준 파일'),
      file('SYNTHETIC_cal_dataLog_1', 'SYNTHETIC_cal', 'calibration', 22, 1020, {}, '보정용 합성 파일'),
      file('SYNTHETIC_evA_dataLog_1', 'SYNTHETIC_evA', 'evaluation', 33, 1020, {}, '평가용 합성 파일'),
      file('SYNTHETIC_evB_dataLog_1', 'SYNTHETIC_evB', 'evaluation', 44, 1020, {}, '평가용 합성 파일'),
    ];
  }
  return [
    file('SYNTHETIC_ref_dataLog_1', 'SYNTHETIC_ref', 'reference', 11, 1020, {}, '기준(reference) 합성 파일 · 약 1.02초'),
    file('SYNTHETIC_cal_dataLog_1', 'SYNTHETIC_cal', 'calibration', 22, 1020, {}, '보정(calibration) 합성 파일 · 약 1.02초'),
    file('SYNTHETIC_evA_dataLog_1', 'SYNTHETIC_evA', 'evaluation', 33, 1037, {gapAt: 400, nanAt: 730}, '25 ms 시각 공백과 NaN 1개를 넣은 평가 파일'),
    file('SYNTHETIC_evB_dataLog_1', 'SYNTHETIC_evB', 'evaluation', 44, 1020, {shiftAt: 500}, '0.5초부터 X축에 +0.03 g 수준 변화를 인위적으로 넣은 평가 파일'),
  ];
}

export function toCSV(f) {
  return ['Time,A_x [g],A_y [g],A_z [g]', ...f.rows.map(r => r.join(','))].join('\n') + '\n';
}
