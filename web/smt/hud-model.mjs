// Read-only presentation of the existing synthetic SPI record. Never a sensor feed.
import {holdReasons} from './context-review-model.mjs';

export const HUD_STATION = 2;
export function spiHudRecord(board) {
  if (!board) return {state: 'waiting', value: null, boardId: null, phase: 'before'};
  const base = {boardId: board.id, phase: board.stage < 2 ? 'before' : board.stage === 2 ? 'here' : 'after'};
  // rawVolume is deliberately never read: it is not yet an observed demo result.
  if (board.stage < 2) return {...base, state: 'waiting', value: null};
  if (!Number.isFinite(board.volume)) return {...base, state: 'missing', value: null};
  if (holdReasons(board).length) return {...base, state: 'hold', value: board.volume};
  return {...base, state: board.volume < 80 || board.volume > 120 ? 'outside' : 'within', value: board.volume};
}

export const HUD_COPY = {
  ko: {
    title: '납 검사', badge: '가상 데이터', board: '선택한 기판', unit: '납 도포량',
    range: '데모 기준 80–120%', scope: '설명용 합성 기록 · 실제 장비 연결 아님',
    states: {waiting: '측정 전', missing: '값 누락 · 판단 보류', hold: '맥락 확인 · HOLD', outside: '범위 밖 · 검토 필요', within: '데모 범위 안'},
    phases: {before: '이 기판은 아직 검사 전', here: '이 기판은 현재 SPI 공정', after: '이 기판의 지난 SPI 기록'},
    toggle: 'HUD 표시', language: 'HUD language: English', focus: '03 납 검사 HUD 보기', hidden: '03 납 검사를 선택하면 HUD가 나타나요.',
    offscreen: '설비가 화면 밖에 있어요. 03 공정을 다시 선택하세요.',
  },
  en: {
    title: 'Paste inspection', badge: 'SYNTHETIC', board: 'Selected board', unit: 'Paste volume',
    range: 'Demo range 80–120%', scope: 'Illustrative synthetic record · no device connected',
    states: {waiting: 'Not measured', missing: 'Missing value · on hold', hold: 'Context review · HOLD', outside: 'Outside range · review', within: 'Within demo range'},
    phases: {before: 'This board has not reached SPI', here: 'This board is now at SPI', after: 'Earlier SPI record for this board'},
    toggle: 'Show HUD', language: 'HUD 언어: 한국어', focus: 'Focus 03 · SPI HUD', hidden: 'Select process 03 to show its HUD.',
    offscreen: 'Equipment is off screen. Select process 03 again.',
  },
};

// A line is only drawn to a real on-screen anchor, never clamped to a false location.
export function hudAnchorVisible({x, y, z}, width, height) {
  return [x, y, z, width, height].every(Number.isFinite) && z >= -1 && z <= 1 &&
    x >= 12 && x <= width - 12 && y >= 48 && y <= height - 42;
}
