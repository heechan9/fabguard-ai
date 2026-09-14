import test from 'node:test';
import assert from 'node:assert/strict';
import {clampZoom,overviewDistance,stationZoom} from '../../web/smt/camera-model.mjs';

test('zoom permits a closer view while bounding pinch, wheel and keyboard inputs',()=>{
  assert.equal(clampZoom(0.01),0.1);
  assert.equal(clampZoom(2),1.8);
  assert.equal(clampZoom(0.2),0.2);
  assert.ok(clampZoom(0)<0.45);
});
test('station framing fits the widest machine on phone and desktop',()=>{
  for(const aspect of [0.65,1,1.8])for(const width of [1.45,2.25,4.4]){
    const zoom=stationZoom(width,aspect);
    const visibleSpan=2*overviewDistance(aspect)*zoom*Math.tan(21*Math.PI/180)*Math.min(1,aspect);
    assert.ok(visibleSpan+1e-9>=Math.max(width+1.5,4.5));
    assert.ok(zoom<1,'focus is closer than overview');
  }
});
