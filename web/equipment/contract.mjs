export const CSV_LIMITS = Object.freeze({bytes: 5 * 1024 * 1024, rows: 20000, columns: 200});
const binaryMessage = '압축·바이너리 파일 대신 UTF-8 CSV를 선택하세요.';
export function decodeCSVBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > CSV_LIMITS.bytes) throw Error('5MB 이하 CSV만 지원합니다.');
  const signatures = [
    [0x50,0x4b,0x03,0x04], [0x50,0x4b,0x05,0x06], [0x50,0x4b,0x07,0x08],
    [0x1f,0x8b], [0x25,0x50,0x44,0x46,0x2d], [0xd0,0xcf,0x11,0xe0],
    [0x37,0x7a,0xbc,0xaf,0x27,0x1c], [0x52,0x61,0x72,0x21]
  ];
  const offset = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  if (signatures.some(sig => sig.every((byte, i) => bytes[offset + i] === byte)) ||
      bytes.some(byte => byte < 32 && ![9,10,13].includes(byte) || byte === 127)) {
    throw Error(binaryMessage);
  }
  let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { throw Error('UTF-8 인코딩의 CSV를 선택하세요.'); }
  if (!text.trim()) throw Error('빈 CSV 파일은 지원하지 않습니다.');
  return text;
}
export const fields = ['board_id', 'pad_id', 'value'];
export function parseCSV(text) {
  if (typeof text !== 'string') throw Error('CSV 텍스트가 필요합니다.');
  if (text.length > CSV_LIMITS.bytes || new TextEncoder().encode(text).byteLength > CSV_LIMITS.bytes) throw Error('5MB 이하 CSV만 지원합니다.');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw Error(binaryMessage);
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const pushCell = () => {
    if (row.length >= CSV_LIMITS.columns) throw Error('최대 200열을 지원합니다.');
    row.push(cell); cell = ''; closed = false;
  };
  const pushRow = () => {
    if (row.some(v => v !== '')) {
      if (rows.length >= CSV_LIMITS.rows + 1) throw Error('최대 20,000개 측정 행을 지원합니다.');
      rows.push(row);
    }
    row = [];
  };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      pushCell();
      if (c !== ',') { pushRow(); if (c === '\r' && text[i+1] === '\n') i++; }
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else { if (closed || c === '"') throw Error('CSV 따옴표 형식 오류'); cell += c; }
  }
  if (quoted) throw Error('닫히지 않은 CSV 따옴표');
  pushCell(); pushRow();
  if (rows.length < 2) throw Error('헤더와 측정 행이 필요합니다.');
  const headers = rows.shift().map(v => v.trim());
  if (headers.some(v => !v) || new Set(headers).size !== headers.length) throw Error('비어 있거나 중복된 열 이름');
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
