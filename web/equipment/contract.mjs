export const fields = ['board_id', 'pad_id', 'value'];
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { if (row.some(v => v !== '')) rows.push(row); row = []; if (c === '\r' && text[i+1] === '\n') i++; }
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else { if (closed || c === '"') throw Error('CSV 따옴표 형식 오류'); cell += c; }
  }
  if (quoted) throw Error('닫히지 않은 CSV 따옴표');
  row.push(cell); if (row.some(v => v !== '')) rows.push(row);
  if (rows.length < 2) throw Error('헤더와 측정 행이 필요합니다.');
  const headers = rows.shift().map(v => v.trim());
  if (headers.some(v => !v) || new Set(headers).size !== headers.length) throw Error('비어 있거나 중복된 열 이름');
  if (rows.length > 20000) throw Error('최대 20,000개 측정 행을 지원합니다.');
  return {headers, rows};
}
export function validateCSV(data, mapping, context) {
  if (fields.some(f => !Number.isInteger(mapping[f]) || mapping[f] < 0 || mapping[f] >= data.headers.length) || new Set(fields.map(f=>mapping[f])).size !== fields.length) throw Error('필수 항목을 서로 다른 열에 연결하세요.');
  if (!context.equipment.trim() || !['observed','synthetic','public'].includes(context.role)) throw Error('장비명과 데이터 출처를 지정하세요.');
  if (!['paste_height_um','paste_volume_pct','paste_area_pct'].includes(context.metric)) throw Error('지원하지 않는 측정 항목');
  const seen = new Set(); const accepted = [], rejected = [];
  data.rows.forEach((row, index) => {
    const id = row[mapping.board_id]?.trim(), pad = row[mapping.pad_id]?.trim(), raw = row[mapping.value]?.trim();
    const errors = [];
    if (row.length !== data.headers.length) errors.push('열 개수 불일치');
    if (!id || !pad) errors.push('기판/패드 ID 누락');
    if (!raw || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(Number(raw)) || Number(raw)<0) errors.push('측정값 누락 또는 유효하지 않은 음이 아닌 숫자');
    const key = JSON.stringify([id,pad]);
    if (seen.has(key)) errors.push('같은 기판/패드 반복: 별도 실행 파일로 분리 필요');
    seen.add(key);
    if (errors.length) rejected.push({record:index+1, errors});
    else accepted.push({board_id:id,pad_id:pad,value:Number(raw)});
  });
  return {accepted,rejected};
}
