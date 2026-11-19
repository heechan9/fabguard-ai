import * as THREE from './vendor/three.module.js';

const MAX_BOARDS = 12; // Maximum boards in one simulation run.

function batchFor(geometry, exemplar, capacity) {
  const material = exemplar.material.clone();
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0;
  mesh.castShadow = exemplar.castShadow;
  mesh.receiveShadow = exemplar.receiveShadow;
  // Original board groups remain the exclusive picking targets.
  mesh.raycast = () => {};
  return mesh;
}

// Only settled boards enter this batch. Their original group, meshes, and local
// transforms remain in the scene so selection can keep raycasting the real shapes.
export class CompletedBoardBatch {
  constructor(scene, example) {
    this.originals = new Map();
    const markings = example.children.find(child => child.material.vertexColors);
    this.markings = batchFor(markings.geometry.clone(), markings, MAX_BOARDS);
    const boxesPerBoard = example.children.length - 1;
    this.solids = batchFor(new THREE.BoxGeometry(), example.userData.pcb, boxesPerBoard * MAX_BOARDS);
    this.solids.material.color.setHex(0xffffff);
    scene.add(this.solids, this.markings);
  }

  add(board) {
    if (this.originals.has(board) || this.originals.size >= MAX_BOARDS) return;
    const matrix = new THREE.Matrix4(), size = new THREE.Vector3();
    board.updateMatrix();
    for (const part of board.children) {
      if (!part.visible) continue;
      part.updateMatrix();
      // Batch and original board are siblings under the same factory scene.
      matrix.multiplyMatrices(board.matrix, part.matrix);
      if (part.material.vertexColors) {
        this.markings.setMatrixAt(this.markings.count++, matrix);
      } else {
        const {width, height, depth} = part.geometry.parameters;
        matrix.scale(size.set(width, height, depth));
        this.solids.setColorAt(this.solids.count, part.material.color);
        this.solids.setMatrixAt(this.solids.count++, matrix);
      }
    }
    this.solids.instanceColor.needsUpdate = true;
    for (const batch of [this.solids, this.markings]) {
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
    }

    // Three's Raycaster traverses hidden groups. Rendering and shadow draws skip
    // this subtree, while pointer hits still resolve through the same boardId owner.
    const originals = new THREE.Group();
    originals.visible = false;
    originals.add(...board.children);
    board.add(originals);
    this.originals.set(board, originals);
  }

  dispose() {
    for (const [board, originals] of this.originals) {
      board.add(...originals.children);
      originals.removeFromParent();
    }
    this.originals.clear();
    for (const batch of [this.solids, this.markings]) {
      batch.removeFromParent();
      batch.dispose();
      batch.geometry.dispose();
      batch.material.dispose();
    }
  }
}
