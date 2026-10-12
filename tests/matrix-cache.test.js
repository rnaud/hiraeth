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

test('a skinned machine\'s bounds: once a frame in its passes, exact outside them (issue #111)', async () => {
  const { skinned } = await import('../src/enemies/plans/kit.js');
  const { RENDER_FRAME } = await import('../src/render-frame.js');
  const owner = new THREE.Group(), joint = new THREE.Bone();
  owner.add(joint);
  joint.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  const sm = skinned(owner, [joint.children[0]], new THREE.MeshBasicMaterial());
  const at = () => sm.boundingSphere.center.x;
  assert.ok(Math.abs(at()) < 1e-6);
  joint.position.x = 5; owner.updateMatrixWorld(true);
  assert.ok(Math.abs(at() - 5) < 1e-6, 'outside the passes: where its joints are now');
  RENDER_FRAME.n++; RENDER_FRAME.on = true;
  try {
    assert.ok(Math.abs(at() - 5) < 1e-6);
    joint.position.x = 9; owner.updateMatrixWorld(true);
    assert.ok(Math.abs(at() - 5) < 1e-6, 'in a frame\'s passes: worked out once');
    RENDER_FRAME.n++;
    assert.ok(Math.abs(at() - 9) < 1e-6, 'the next frame: again');
  } finally { RENDER_FRAME.on = false; }
});

test('updateChain: an object and its parents made now, and the next walk as if the whole rig had been walked (issue #111)', async () => {
  const { updateChain, updateMatrixCached } = await import('../src/matrix-cache.js');
  const P = THREE.Object3D.prototype, plainMatrix = P.updateMatrix;
  const cached = (fn) => { P.updateMatrixWorld = updateMatrixWorldCached; P.updateMatrix = updateMatrixCached; try { return fn(); } finally { P.updateMatrixWorld = threeWalk; P.updateMatrix = plainMatrix; } };
  // A: every matrix made from scratch (three's walk, forced: the truth); B: the cache, updateChain at the reads
  const A = build(11), B = build(11);
  const truth = () => A.scene.updateMatrixWorld(true);
  truth(); cached(() => B.scene.updateMatrixWorld());
  let chained = 0;
  for (let frame = 0; frame < 300; frame++) {
    const r = A.rnd(); B.rnd();
    const pick = Math.floor(r * A.all.length), at = Math.floor(((frame * 7919) % 97) / 97 * A.all.length);
    for (const set of [A.all, B.all]) {
      const o = set[pick];
      const kind = frame % 5;
      if (kind === 0) o.position.x += 0.25;
      else if (kind === 1) o.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame * 0.1);
      else if (kind === 2) { o.matrixAutoUpdate = false; o.matrix.makeTranslation(frame, 0, 0); o.matrixWorldNeedsUpdate = true; }
      else if (kind === 3) o.scale.y = 1 + frame * 0.01;
    }
    // a read of the object (and its parents): updateChain makes them as they now are
    truth(); cached(() => updateChain(B.all[at]));
    for (let o = A.all[at], q = B.all[at]; o; o = o.parent, q = q.parent, chained++) assert.deepEqual(q.matrixWorld.elements, o.matrixWorld.elements, `the chain at frame ${frame}`);
    // another change under it before the frame's walk, sometimes a walk from it first
    if (frame % 3 === 0) for (const set of [A.all, B.all]) set[at].children[0]?.position.add(new THREE.Vector3(0.1, 0, 0));
    if (frame % 2) cached(() => B.all[at].updateMatrixWorld(true));
    // the frame's walk: every matrix as made from scratch
    truth(); cached(() => B.scene.updateMatrixWorld());
    for (let i = 0; i < A.all.length; i++) assert.deepEqual(B.all[i].matrixWorld.elements, A.all[i].matrixWorld.elements, `object ${i} at frame ${frame}`);
  }
  assert.ok(chained > 600);
});
