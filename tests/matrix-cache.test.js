import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateMatrixWorldCached } from '../src/matrix-cache.js';

// The cached walk must give exactly the matrices three's own gives, frame after frame, whatever moves.
const threeWalk = THREE.Object3D.prototype.updateMatrixWorld;
/** Walk `root` with `method` on every object (the children reach it through the prototype, as in the game). */
const walk = (method, root) => {
  const P = THREE.Object3D.prototype;
  P.updateMatrixWorld = method;
  try { root.updateMatrixWorld(); } finally { P.updateMatrixWorld = threeWalk; }
};

function build(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const scene = new THREE.Scene(), all = [];
  const add = (parent, depth) => {
    for (let i = 0; i < 3; i++) {
      const o = i === 1 ? new THREE.Mesh() : new THREE.Object3D();
      o.position.set(rnd() * 10, rnd() * 10, rnd() * 10);
      o.rotation.set(rnd(), rnd(), rnd());
      o.scale.setScalar(0.5 + rnd());
      parent.add(o); all.push(o);
      if (depth < 3) add(o, depth + 1);
    }
  };
  add(scene, 0);
  return { scene, all, rnd };
}

/** Run the same changes on two copies, one walked by three, one by the cache, and compare every world matrix. */
test('the cached walk matches three exactly over frames of moves, manual matrices and flags', () => {
  const A = build(7), B = build(7);
  for (let frame = 0; frame < 60; frame++) {
    // the same random changes on both
    const r = A.rnd(); B.rnd();
    const pick = Math.floor(r * A.all.length);
    const kinds = frame % 6;
    for (const [W, set] of [[A, A.all], [B, B.all]]) {
      const o = set[pick];
      if (kinds === 0) o.position.x += 0.25;
      else if (kinds === 1) o.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame * 0.1);
      else if (kinds === 2) o.scale.y = 1 + frame * 0.01;
      else if (kinds === 3) { o.matrixAutoUpdate = false; o.matrix.makeTranslation(frame, 0, 0); o.matrixWorldNeedsUpdate = true; }
      else if (kinds === 4) { o.position.z -= 0.5; o.updateMatrix(); }
      // (5: nothing moves this frame)
      void W;
    }
    walk(threeWalk, A.scene);
    walk(updateMatrixWorldCached, B.scene);
    for (let i = 0; i < A.all.length; i++) assert.deepEqual(B.all[i].matrixWorld.elements, A.all[i].matrixWorld.elements, `object ${i} at frame ${frame}`);
  }
});

test('an object that did not move is not recomposed, and its children are not multiplied again', () => {
  const o = new THREE.Object3D(), child = new THREE.Object3D();
  o.add(child); o.position.set(1, 2, 3);
  let composed = 0, multiplied = 0;
  const compose = o.matrix.compose.bind(o.matrix), mul = child.matrixWorld.multiplyMatrices.bind(child.matrixWorld);
  o.matrix.compose = (...a) => { composed++; return compose(...a); };
  child.matrixWorld.multiplyMatrices = (...a) => { multiplied++; return mul(...a); };
  walk(updateMatrixWorldCached, o);
  assert.equal(composed, 1); assert.equal(multiplied, 1);
  for (let k = 0; k < 5; k++) walk(updateMatrixWorldCached, o);
  assert.equal(composed, 1, 'still: not recomposed'); assert.equal(multiplied, 1, 'parent still: the child not multiplied');
  o.position.x = 4;
  walk(updateMatrixWorldCached, o);
  assert.equal(composed, 2); assert.equal(multiplied, 2, 'the parent moved: the child follows');
  assert.equal(child.matrixWorld.elements[12], 4);
});
