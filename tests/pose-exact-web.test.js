// The web game's matrix cache (src/matrix-cache.js, installed by main.js) against three's own walk, for the people's
// rigs: two copies of the same skinned people, one walked by three, the other by the cache, posed the same way every
// frame as the game poses them (bones turned, the rig posed for a moment by world-read.js updateRig and its numbers
// put back, a rig's walk entered below the scene's root after its vehicle moved, a carried thing changing hands), and
// every bone's world matrix and every skeleton's bone matrices compared every frame. (tests/pose-exact.test.js does
// the same with the whole game through the Unity bundle.) Issue #105.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateMatrixWorldCached, updateMatrixCached } from '../src/matrix-cache.js';
import { updateRig } from '../src/world-read.js';

const P = THREE.Object3D.prototype;
const plain = { world: P.updateMatrixWorld, matrix: P.updateMatrix };
/** Run fn with the cache on the prototype (the children reach it through the prototype, as in the game). */
const cached = (fn) => {
  P.updateMatrixWorld = updateMatrixWorldCached; P.updateMatrix = updateMatrixCached;
  try { return fn(); } finally { P.updateMatrixWorld = plain.world; P.updateMatrix = plain.matrix; }
};

const BONES = 24;
/** A scene of people on carts: each a rig (root → body → a chain of bones, a skinned mesh), a lantern to carry. */
function build() {
  const scene = new THREE.Scene(), people = [];
  for (let n = 0; n < 6; n++) {
    const cart = new THREE.Group(); cart.position.set(n * 3, 0, -n);
    const root = new THREE.Group(), body = new THREE.Group();
    root.position.set(0, 0.5, 0); cart.add(root); root.add(body);
    const bones = [];
    for (let i = 0; i < BONES; i++) {
      const b = new THREE.Bone(); b.position.set(i % 3 === 0 ? 0.1 : 0, 0.12, 0);
      (i === 0 ? body : bones[i % 4 === 0 ? i - 3 : i - 1]).add(b); bones.push(b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
    root.add(mesh); mesh.bind(new THREE.Skeleton(bones));
    const lantern = new THREE.Mesh(); lantern.position.set(0.2, 0, 0.1);
    bones[BONES - 1].add(lantern);
    scene.add(cart);
    people.push({ cart, root, body, bones, mesh, lantern });
  }
  return { scene, people };
}

/** One frame of the game's posing on world W at frame f (the same on both copies). */
function frame(W, f) {
  W.people.forEach((h, n) => {
    const t = f / 60 + n;
    // the clip: every bone turned
    h.bones.forEach((b, i) => b.quaternion.setFromEuler(new THREE.Euler(Math.sin(t * 2 + i) * 0.3, Math.cos(t + i) * 0.2, 0)));
    // the carts move on most frames
    if (f % 3 !== 0) h.cart.position.x += 0.01 * (n + 1);
    // the body bobs, then the rig is posed for a moment and read (animator.js), and its numbers put back
    h.body.position.y = Math.sin(t * 4) * 0.05;
    if (f % 2 === 0) {
      const keep = h.root.position.clone(), keepQ = h.root.quaternion.clone();
      h.root.position.y += 0.3; h.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
      updateRig(h.root);
      h.root.position.copy(keep); h.root.quaternion.copy(keepQ);
    }
    // a walk entered at the rig, after the cart's own matrix was made alone (the vehicle's ride)
    if (f % 5 === 1) { h.cart.updateWorldMatrix(false, false); h.root.updateMatrixWorld(); }
  });
  // the lantern changes hands: its own numbers the same, another parent
  if (f % 7 === 3) {
    const n = W.people.length;
    W.people[(f + 1) % n].bones[BONES - 1 - (f % 4)].add(W.people[f % n].lantern);
  }
  W.scene.updateMatrixWorld();
  for (const h of W.people) h.mesh.skeleton.update();
}

test('every bone of the web cache\'s walk as three\'s own, frame after frame (momentary poses, walks below the root, a carried thing)', () => {
  const A = build(), B = build();
  let worst = 0, compared = 0;
  for (let f = 0; f < 240; f++) {
    frame(A, f);
    cached(() => frame(B, f));
    const all = (W) => { const L = []; W.scene.traverse((o) => L.push(o)); return L; };
    const a = all(A), b = all(B);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      const x = a[i].matrixWorld.elements, y = b[i].matrixWorld.elements;
      for (let k = 0; k < 16; k++) { const d = Math.abs(x[k] - y[k]); if (d > worst) worst = d; }
      if (a[i].isBone) compared++;
    }
    for (let n = 0; n < A.people.length; n++) assert.deepEqual(B.people[n].mesh.skeleton.boneMatrices, A.people[n].mesh.skeleton.boneMatrices, `person ${n}'s bone matrices at frame ${f}`);
    assert.equal(worst, 0, `frame ${f}: the matrices differ by ${worst}`);
  }
  assert.ok(compared >= 240 * 6 * BONES);
});

test('the cache still skips what did not move: a still scene is neither recomposed nor multiplied', () => {
  const W = build();
  let composed = 0, multiplied = 0;
  const M = THREE.Matrix4.prototype, compose = M.compose, mul = M.multiplyMatrices;
  M.compose = function (...a) { composed++; return compose.apply(this, a); };
  M.multiplyMatrices = function (...a) { multiplied++; return mul.apply(this, a); };
  try {
    let objects = 0; W.scene.traverse(() => objects++);
    cached(() => W.scene.updateMatrixWorld());
    assert.ok(composed >= objects - 1, `the first walk composes everything (${composed} of ${objects})`);
    composed = multiplied = 0;
    for (let k = 0; k < 10; k++) cached(() => W.scene.updateMatrixWorld());
    assert.equal(composed, 0, 'still: nothing recomposed'); assert.equal(multiplied, 0, 'still: nothing multiplied');
    // one bone turned: only it is recomposed, only it and what hangs under it multiplied
    W.people[2].bones[BONES - 2].rotation.z = 0.5;
    cached(() => W.scene.updateMatrixWorld());
    let under = 0; W.people[2].bones[BONES - 2].traverse(() => under++);
    assert.equal(composed, 1); assert.equal(multiplied, under);
    // a walk entered at a rig is forced (as three's) but recomposes nothing that did not move
    composed = multiplied = 0;
    let rig = 0; W.people[0].root.traverse(() => rig++);
    cached(() => W.people[0].root.updateMatrixWorld());
    assert.equal(composed, 0); assert.equal(multiplied, rig);
  } finally { M.compose = compose; M.multiplyMatrices = mul; }
});
