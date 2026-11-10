import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {allowedReaderRequest,assertReaderAudit}=require('../../verification/check_reader_legibility.cjs');
test('font verification permits only the existing public font hosts and same-origin assets',()=>{
 const origin='https://fabguard.invalid';
 for(const url of [origin+'/data/saved.json','https://fonts.googleapis.com/css2?family=Manrope','https://fonts.gstatic.com/example.woff2'])assert.equal(allowedReaderRequest(url,origin),true);
 for(const url of ['https://example.com/collect','https://fonts.gstatic.com.evil.invalid/font','http://fonts.gstatic.com/font','https://drive.google.com/private'])assert.equal(allowedReaderRequest(url,origin),false);
});
test('rendered reader contract rejects small text, lost warning ink, long prose and panel clipping',()=>{
 const valid={nodes:12,targets:[{size:14,min:14,pass:true}],prose:[{width:600,max:672,pass:true}],failureColor:{actual:'rgb(1, 2, 3)',expected:'rgb(1, 2, 3)'},lowerPanelsBottom:932,viewport:{width:1366,height:941}};
 assert.doesNotThrow(()=>assertReaderAudit(valid));
 for(const mutate of [a=>a.nodes=0,a=>a.targets[0].pass=false,a=>a.prose[0].pass=false,a=>a.failureColor.actual='rgb(4, 5, 6)',a=>a.lowerPanelsBottom=934]){
  const a=structuredClone(valid);mutate(a);assert.throws(()=>assertReaderAudit(a));
 }
});
