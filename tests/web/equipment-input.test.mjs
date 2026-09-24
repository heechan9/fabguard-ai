import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,validateCSV,decodeCSVBytes,CSV_LIMITS} from '../../web/equipment/contract.mjs';
const mapping={board_id:0,pad_id:1,value:2};
const context={equipment:'SPI',role:'synthetic',metric:'paste_height_um'};
test('BOM, CRLF, quoted comma and escaped quotes',()=>{assert.deepEqual(parseCSV('\uFEFFa,b\r\n"x,y","a""b"\r\n').rows,[['x,y','a"b']]);});
test('reject malformed headers and quotes',()=>{for(const text of ['a,a\n1,2','a,\n1,2','a,b\n"x,y','a,b\n"x"z,2'])assert.throws(()=>parseCSV(text));});
test('zero accepted; missing, NaN, Infinity, negative, duplicate quarantined',()=>{const d=parseCSV('a,b,c\nB,P,0\nB,P,1\nC,P,\nD,P,NaN\nE,P,Infinity\nF,P,-1');const r=validateCSV(d,mapping,context);assert.equal(r.accepted.length,1);assert.equal(r.rejected.length,5);});
test('mapping and context fail closed',()=>{const d=parseCSV('a,b,c\nB,P,1');assert.throws(()=>validateCSV(d,{...mapping,value:0},context));assert.throws(()=>validateCSV(d,mapping,{...context,role:''}));});
test('column mismatch quarantined; HTML is plain data',()=>{const d=parseCSV('a,b,c\n<script>,P,12\nB,P,1,extra');const r=validateCSV(d,mapping,context);assert.equal(r.accepted[0].board_id,'<script>');assert.equal(r.rejected.length,1);});

test('row limit accepts boundary and stops before malformed trailing content',()=>{
  const valid='a\n'+'1\n'.repeat(CSV_LIMITS.rows);
  assert.equal(parseCSV(valid).rows.length,CSV_LIMITS.rows);
  assert.throws(()=>parseCSV(valid+'1\n"unterminated'),/20,000/);
});
test('column limit covers headers and data, accepts boundary',()=>{
  const header=Array.from({length:200},(_,i)=>'c'+i).join(',');
  assert.equal(parseCSV(header+'\n'+Array(200).fill('1').join(',')).headers.length,200);
  assert.throws(()=>parseCSV(header+',extra\n"unterminated'),/200열/);
  assert.throws(()=>parseCSV('a\n'+Array(201).fill('1').join(',')+'\n"unterminated'),/200열/);
});
test('binary signatures, controls and non-UTF8 rejected before parsing',()=>{
  const samples=[[80,75,3,4],[80,75,5,6],[80,75,7,8],[31,139],[37,80,68,70,45],
    [208,207,17,224],[55,122,188,175,39,28],[82,97,114,33],[97,0,98],[97,1,98],[255,254,97,0]];
  for(const sample of samples){
    assert.throws(()=>decodeCSVBytes(Uint8Array.from(sample).buffer),/압축·바이너리/);
    assert.throws(()=>decodeCSVBytes(Uint8Array.from([239,187,191,...sample]).buffer),/압축·바이너리/);
  }
  assert.throws(()=>decodeCSVBytes(Uint8Array.from([0xc0,0xaf]).buffer),/UTF-8/);
  assert.throws(()=>parseCSV('a\nx\0y'),/압축·바이너리/);
});
test('UTF8 BOM, Korean, tabs and quoted newlines remain valid',()=>{
  const text='\uFEFFa,b\r\n"한글\n탭\t값","x,y"\r\n';
  const decoded=decodeCSVBytes(new TextEncoder().encode(text).buffer);
  assert.deepEqual(parseCSV(decoded).rows,[['한글\n탭\t값','x,y']]);
  assert.throws(()=>decodeCSVBytes(new TextEncoder().encode('\uFEFF \r\n').buffer),/빈 CSV/);
});
test('byte limits also apply to decoder and direct parser',()=>{
  assert.throws(()=>decodeCSVBytes(new ArrayBuffer(CSV_LIMITS.bytes+1)),/5MB/);
  assert.throws(()=>parseCSV('a\n'+'x'.repeat(CSV_LIMITS.bytes)),/5MB/);
  assert.throws(()=>parseCSV('a\n'+'가'.repeat(Math.ceil(CSV_LIMITS.bytes/3))),/5MB/);
});
