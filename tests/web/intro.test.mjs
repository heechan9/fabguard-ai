import test from 'node:test';
import assert from 'node:assert/strict';
import {INTRO_SECONDS,introShot,recordingFormat} from '../../web/smt/intro-model.mjs';

test('ten-second introduction contains overview, every station in order, and an outro',()=>{
 assert.equal(INTRO_SECONDS,10);
 assert.equal(introShot(0).station,null);assert.equal(introShot(1.999).touring,false);
 const seen=[];
 for(let i=0;i<11;i++)seen.push(introShot(2+(i+.5)*6/11).station);
 assert.deepEqual(seen,[0,1,2,3,4,5,6,7,8,9,10]);
 assert.equal(introShot(8).station,null);assert.equal(introShot(10).t,10);
});
test('invalid and out-of-range presentation times cannot create invalid camera inputs',()=>{
 for(const t of [NaN,Infinity,-Infinity,-100,100]){
  const shot=introShot(t);assert.ok(Number.isFinite(shot.t));
  assert.ok(shot.t>=0&&shot.t<=10);assert.ok(shot.progress>=0&&shot.progress<=1);
 }
});
test('recording uses only supported formats and never labels WebM as MP4',()=>{
 assert.equal(recordingFormat(undefined),null);
 assert.equal(recordingFormat({isTypeSupported:()=>false}),null);
 assert.deepEqual(recordingFormat({isTypeSupported:m=>m==='video/webm'}),{mime:'video/webm',extension:'webm'});
 assert.equal(recordingFormat({isTypeSupported:()=>true}).extension,'mp4');
});
