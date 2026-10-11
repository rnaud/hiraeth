// engine/scene-matrices.js: the scene's matrices from a flat list, the same as src/matrix-cache.js's walk makes them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache } from '../src/matrix-cache.js';
import { updateSceneMatrices, watchSceneEdits } from '../engine/scene-matrices.js';

installMatrixCache();
watchSceneEdits();

/** A little seeded random (the two scenes must be built and moved alike). */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** A scene of groups, meshes, a rig of bones, a camera, a skinned mesh and an object with its own updateMatrixWorld. */
function world(seed) {
  const r = rng(seed), scene = new THREE.Scene(), all = [];
  const put = (o, parent) => { o.position.set(r() * 10 - 5, r() * 3, r() * 10 - 5); o.rotation.set(r(), r() * 6, r()); parent.add(o); all.push(o); return o; };
  for (let g = 0; g < 6; g++) {
    const grp = put(new THREE.Group(), scene);
    for (let k = 0; k < 5; k++) { const m = put(new THREE.Mesh(), grp); if (k === 2) put(new THREE.Object3D(), m); }
  }
  const bones = [put(new THREE.Bone(), scene)];
  for (let i = 1; i < 8; i++) bones.push(put(new THREE.Bone(), bones[i - 1]));
  const skinned = put(new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()), all[0]);
  scene.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));
  put(new THREE.PerspectiveCamera(), all[3]);
  const hooked = put(new THREE.Group(), all[7]);
  hooked.ticks = 0;
  hooked.updateMatrixWorld = function (force) { this.ticks++; THREE.Object3D.prototype.updateMatrixWorld.call(this, force); };
  put(new THREE.Mesh(), hooked);
  // one whose matrix is its owner's
  const fixed = put(new THREE.Mesh(), all[10]);
  fixed.matrixAutoUpdate = false;
  return { scene, all, r, fixed, hooked };
}

/** The same changes to both: moves, a matrix set by its owner, a reparent, an attach, a removal, an addition. */
function step(w, f) {
  const { all, r, fixed, scene } = w;
  for (let k = 0; k < 6; k++) { const o = all[Math.floor(r() * all.length)]; o.position.x += r() - 0.5; o.quaternion.setFromEuler(new THREE.Euler(r(), r(), r())); }
  if (f % 3 === 0) { fixed.matrix.makeTranslation(f, 1, -f); fixed.matrixWorldNeedsUpdate = true; }
  if (f === 7) all[5].add(all[20]);
  if (f === 11) all[2].attach(all[30]);
  if (f === 13) all[12].removeFromParent();
  if (f === 17) { const o = new THREE.Mesh(); o.position.set(1, 2, 3); all[4].add(o); all.push(o); }
  if (f === 19) all[12].position.y += 1;   // (out of the scene: no matter)
  if (f === 21) scene.add(all[12]);
}

const matrices = (scene) => { const out = []; scene.traverse((o) => out.push(...o.matrixWorld.elements)); return out; };

test('the scene\'s matrices from the list are the walk\'s, bit for bit, through moves, flags, edits and hooks', () => {
  const A = world(7), B = world(7);
  let listed = 0;
  for (let f = 1; f <= 40; f++) {
    step(A, f); step(B, f);
    if (updateSceneMatrices(A.scene)) listed++;
    B.scene.updateMatrixWorld();
    assert.deepEqual(matrices(A.scene), matrices(B.scene), `frame ${f}`);
  }
  assert.ok(listed >= 30, `most frames from the list (${listed})`);
  assert.equal(A.hooked.ticks, B.hooked.ticks, 'an own updateMatrixWorld called as often');
});

test('a frame after an edit runs the walk and lists the scene again', () => {
  const { scene } = world(3);
  assert.equal(updateSceneMatrices(scene), false);
  assert.equal(updateSceneMatrices(scene), true);
  scene.add(new THREE.Group());
  assert.equal(updateSceneMatrices(scene), false);
  assert.equal(updateSceneMatrices(scene), true);
});
