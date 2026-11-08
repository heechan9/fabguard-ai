import test from 'node:test';
import assert from 'node:assert/strict';
import {englishText} from '../../web/english-copy.mjs';
test('English preserves denominators and uncertainty in parameterised review evidence',()=>{
 assert.equal(englishText('40건 중 불량 5건 · 정상 35건.'),'40 reviewed: 5 Fail and 35 Pass records.');
 assert.equal(englishText('불량 24건 중 5건 포착, 19건 누락, 정상 35건 점검.'),'5 of 24 failures captured, 19 missed, 35 normal records reviewed.');
 assert.match(englishText('V1은 공개 SECOM 데이터의 오프라인 위험순위화와 Top-K 점검 큐만 구현했습니다. 현장 요구 확인, 실시간 MES/FDC 연동, 생산 제어와 피드백 저장은 목표 구조이며 구현 완료 기능이 아닙니다.'),/not an authenticated factory system/);
});
test('English does not rewrite source identifiers, hashes, user notes or unknown copy',()=>{
 for(const text of ['secom_1397','feature_059','0.09347718147533737','null','사용자가 작성한 검토 의견'])assert.equal(englishText(text),text);
});
test('Sensor and synthetic boundaries stay distinct',()=>{
 assert.match(englishText('UCI 공개 기록 7,409행 · 관절 전류·온도·속도와 툴 전류 19채널. 결측과 시간 공백을 유지한 탐색·재생이며 실시간 연결·예측·제어가 아닙니다. 합성 R-01·R-02 동작과 SECOM 익명 변수 분석에 연결하거나 합산하지 않습니다.'),/No live connection, prediction or control/);
});
