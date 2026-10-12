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

/** The matrices of what is shown (every ancestor visible), in the scene's order. */
const shownMatrices = (scene) => {
  const out = [];
  const walk = (o) => { if (!o.visible) return; out.push(...o.matrixWorld.elements); for (const c of o.children) walk(c); };
  walk(scene);
  return out;
};

test('skipHidden: what is shown has the walk\'s matrices, a hidden thing read through three gets the walk\'s, and its own walks still run', () => {
  const A = world(11), B = world(11);
  // (hidden subtrees with depth, one holding an own updateMatrixWorld, shown and hidden again as the frames go)
  const hide = [1, 4, 7, 10, 25];
  let stale = 0;
  for (let f = 1; f <= 48; f++) {
    step(A, f); step(B, f);
    for (const w of [A, B]) {
      for (let k = 0; k < hide.length; k++) w.all[hide[k]].visible = ((f >> 2) + k) % 3 !== 0;
      if (f % 5 === 0) w.all[0].position.z += 0.5;   // (a parent moving while what is under it is hidden)
    }
    updateSceneMatrices(A.scene, true);
    B.scene.updateMatrixWorld();
    assert.deepEqual(shownMatrices(A.scene), shownMatrices(B.scene), `frame ${f}`);
    assert.equal(A.hooked.ticks, B.hooked.ticks, `frame ${f}: an own updateMatrixWorld called as often`);
    // a hidden one's place, read as the game reads it
    for (const k of hide) {
      const a = A.all[k].children[0] ?? A.all[k], b = B.all[k].children[0] ?? B.all[k];
      if (a.parent?.visible === false || !A.all[k].visible) {
        if (a.matrixWorld.elements.some((x, i) => x !== b.matrixWorld.elements[i])) stale++;   // (left as it was: skipped)
        const pa = a.getWorldPosition(new THREE.Vector3()), pb = b.getWorldPosition(new THREE.Vector3());
        assert.deepEqual(pa.toArray(), pb.toArray(), `frame ${f}: hidden ${k} read`);
      }
    }
  }
  assert.ok(stale > 5, `hidden subtrees stepped over (${stale} reads found a matrix left as it was)`);
  // (and once all is shown again, every matrix is the walk's)
  for (const w of [A, B]) for (const k of hide) w.all[k].visible = true;
  updateSceneMatrices(A.scene, true); B.scene.updateMatrixWorld();
  assert.deepEqual(matrices(A.scene), matrices(B.scene), 'all shown');
});

test('edits frame after frame: the walk alone until they stop, then the list again, the same matrices', () => {
  const A = world(5), B = world(5);
  const built = () => A.scene.__sceneList?.built ?? 0;
  updateSceneMatrices(A.scene); B.scene.updateMatrixWorld();
  const b0 = built();
  const ran = [];
  for (let f = 0; f < 20; f++) {
    // (a burst: something added to both every frame for ten frames)
    if (f < 10) { A.scene.add(new THREE.Group()); B.scene.add(new THREE.Group()); }
    for (const w of [A, B]) w.all[f % w.all.length].position.z += 0.25;
    ran.push(updateSceneMatrices(A.scene));
    B.scene.updateMatrixWorld();
    assert.deepEqual(matrices(A.scene), matrices(B.scene), `frame ${f}`);
  }
  assert.ok(built() - b0 <= 3, `the list made ${built() - b0} times over ten frames of edits`);
  assert.equal(ran[19], true, 'from the list again once the edits stopped');
});
