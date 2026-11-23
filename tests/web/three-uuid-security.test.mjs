import test from 'node:test';
import assert from 'node:assert/strict';
import {MathUtils, BoxGeometry, MeshBasicMaterial, Mesh} from '../../web/smt/vendor/three.module.js';

test('scene UUIDs retain version/variant and object construction without Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('predictable randomness must not generate UUIDs'); };
  try {
    const ids = Array.from({length: 1000}, () => MathUtils.generateUUID());
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    ids.push(geometry.uuid, material.uuid, new Mesh(geometry, material).uuid);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    Math.random = original;
  }
});
