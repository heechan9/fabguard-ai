import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../web/smt/index.html',import.meta.url),'utf8');
const contract=JSON.parse(readFileSync(new URL('../../examples/nvidia_tao/optical_inspection_contract.json',import.meta.url),'utf8'));

test('simulation exposes the NVIDIA AOI plan without claiming a running model',()=>{
  assert.match(html,/id="nvidia-aoi-plan"/);
  assert.match(html,new RegExp(`data-contract-status="${contract.status}"`));
  assert.match(html,/데이터·GPU 대기/);
  assert.match(html,/모델이 이 시뮬레이션을 판정하고 있지 않습니다/);
  assert.match(html,/학습·평가·ONNX·TensorRT·현장 성능을 완료했다고 주장하지 않습니다/);
});

test('simulation mirrors the contract runtime and validation gates',()=>{
  assert.equal(contract.runtime_gate.minimum_vram_gb,8);
  assert.match(html,/VRAM 8GB 이상/);
  assert.match(html,/기판·lot 단위 분리/);
  for(const metric of ['미탐','오탐','결함별 재현율'])assert.match(html,new RegExp(metric));
  assert.match(html,/SECOM 위험순위, 이 화면의 합성 SMT 사례, 향후 AOI 영상 모델은 서로 다른 증거/);
});
