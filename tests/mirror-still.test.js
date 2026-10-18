// engine/mirror.js stillMatrices (issue #113): a still drawable's world matrix is not compared again with the one last
// sent, only when the scene's list changed it, a walk outside the list did (src/matrix-cache.js WORLD_STAMP) or every 8th
// frame. The backend must hear exactly what it hears when every matrix is compared: the same calls in the same order,
// through moves, the game's own walks and reads between frames (updateWorldMatrix, updateMatrixWorld(true),
// getWorldPosition), owners writing matrices themselves, an object with its own updateMatrixWorld, reparenting, hiding
// and a render hook that moves something later in the list.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache, updateChain } from '../src/matrix-cache.js';
import { watchSceneEdits } from '../engine/scene-matrices.js';
import { SceneMirror } from '../engine/mirror.js';
import { makeMaterial } from '../src/materials.js';

installMatrixCache();
watchSceneEdits();

function recorder() {
  const log = [];
  const B = {};
  for (const name of ['geometry', 'material', 'create', 'transforms', 'visible', 'geometryOf', 'vertices', 'instances', 'materialLive', 'keyWeights', 'skeleton', 'remove', 'camera']) {
    B[name] = (...args) => {
      if (name === 'transforms') { const [ids, mats, n] = args; log.push([name, Array.from(ids.subarray(0, n)), Array.from(mats.subarray(0, n * 16))]); return; }
      if (name === 'skeleton') { log.push([name, args[0], Array.from(args[1]), args[2]]); return; }
      if (name === 'camera') { log.push([name, Array.from(args[0].world)]); return; }
      log.push([name, args[0]]);
    };
  }
  return { B, log };
}

function world(seed) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const scene = new THREE.Scene(), all = [], meshes = [];
  const mat = makeMaterial({ color: '#808080' });
  const box = new THREE.BoxGeometry();
  const put = (o, p) => { o.position.set(r() * 8, r() * 2, r() * 8); p.add(o); all.push(o); if (o.isMesh) meshes.push(o); return o; };
  const groups = [];
  for (let g = 0; g < 5; g++) { const grp = put(new THREE.Group(), scene); groups.push(grp); for (let k = 0; k < 6; k++) put(new THREE.Mesh(box, mat), grp); }
  // an owner writing a matrix itself and flagging it; another writing its world matrix straight (veil.js's wash)
  const owned = put(new THREE.Mesh(box, mat), groups[1]); owned.matrixAutoUpdate = false;
  const direct = put(new THREE.Mesh(box, mat), scene); direct.matrixAutoUpdate = false;
  const ownWorld = put(new THREE.Mesh(box, mat), scene); ownWorld.matrixAutoUpdate = false; ownWorld.matrixWorldAutoUpdate = false;
  // a group with its own updateMatrixWorld (gadgets/hidden.js): its children's world matrices its own
  const parts = put(new THREE.Group(), scene);
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(box, mat); c.matrixAutoUpdate = false; c.matrix.makeTranslation(k, 0, 0); parts.add(c); }
  parts.updateMatrixWorld = function () { for (const c of this.children) c.matrixWorld.copy(c.matrix); };
  const bones = [put(new THREE.Bone(), scene)];
  for (let i = 1; i < 8; i++) bones.push(put(new THREE.Bone(), bones[i - 1]));
  const skinned = put(new THREE.SkinnedMesh(box, mat), scene);
  scene.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));
  // a render hook moving a mesh further down the list (the walk calls it as the renderer would)
  const hooked = put(new THREE.Mesh(box, mat), groups[0]);
  const late = put(new THREE.Mesh(box, mat), groups[4]);
  hooked.onBeforeRender = () => { late.position.z += 0.01; };
  return { scene, all, meshes, groups, r, owned, direct, ownWorld, parts, bones, mat, box, late };
}

function step(w, f) {
  const m = w.meshes;
  for (let k = 0; k < 3; k++) m[Math.floor(w.r() * m.length)].position.y += 0.1;
  if (f % 3 === 0) w.groups[2].rotation.y += 0.2;
  // the game's own walks and reads between frames
  if (f % 4 === 1) { w.groups[3].position.x += 0.3; w.groups[3].children[2].getWorldPosition(new THREE.Vector3()); }
  if (f % 5 === 2) { w.groups[4].position.z -= 0.2; w.groups[4].updateMatrixWorld(true); }
  if (f % 6 === 3) { w.groups[0].position.y += 0.05; updateChain(w.groups[0].children[1]); }
  if (f % 7 === 4) { w.groups[1].children[0].position.x += 0.4; w.groups[1].children[0].updateWorldMatrix(true, false); }
  if (f % 2 === 0) { w.owned.matrix.makeTranslation(f * 0.1, 0, 0); w.owned.matrixWorldNeedsUpdate = true; }
  if (f % 3 === 1) w.direct.matrixWorld.makeTranslation(0, f * 0.1, 0);
  if (f % 4 === 2) w.ownWorld.matrixWorld.makeTranslation(f * 0.2, 1, 0);
  if (f % 5 === 0) w.parts.children[1].matrix.makeTranslation(1, f * 0.1, 0);
  w.bones[2].rotation.z = f * 0.1;
  if (f === 9) w.groups[2].visible = false;
  if (f === 12) w.groups[2].visible = true;
  if (f === 14) w.groups[3].attach(w.groups[0].children[3]);   // (a thing changing hands: its world matrix kept)
  if (f === 18) { w.groups[0].children[2].position.x += 1; w.groups[0].children[2].updateMatrixWorld(); }
  if (f === 20) w.bones[5].add(new THREE.Mesh(w.box, w.mat));
}

for (const skipHidden of [false, true]) {
  test(`the mirror's still matrices${skipHidden ? ' and hidden subtrees stepped over' : ''} tell the backend what comparing every matrix does, call for call`, () => {
    const A = world(7), B = world(7);
    const a = recorder(), b = recorder();
    const mA = new SceneMirror(a.B, { quietWalk: true, listMatrices: true, stillMatrices: true, skipHidden });
    const mB = new SceneMirror(b.B, { quietWalk: true, listMatrices: true, stillMatrices: false });
    const cam = new THREE.PerspectiveCamera();
    let moved = 0;
    for (let f = 1; f <= 40; f++) {
      step(A, f); step(B, f);
      mA.sync(A.scene, cam); mB.sync(B.scene, cam);
      assert.deepEqual(a.log, b.log, `frame ${f}`);
      moved += a.log.filter((x) => x[0] === 'transforms').reduce((n, x) => n + x[1].length, 0);
      a.log.length = 0; b.log.length = 0;
    }
    assert.ok(moved > 100, `matrices sent: ${moved}`);
  });
}

test('a still drawable is not compared again: the list and the stamps say it did not move', () => {
  // (counted through the floats compared: a still frame reads none of a skipped drawable's 16; every 8th frame each one
  // is compared anyway, and what its owner or a hook moves always is)
  const reads = (still) => {
    const A = world(3), m = new SceneMirror(recorder().B, { quietWalk: true, listMatrices: true, stillMatrices: still });
    const cam = new THREE.PerspectiveCamera(), plain = Math.fround;
    for (let f = 1; f <= 3; f++) m.sync(A.scene, cam);
    let n = 0;
    Math.fround = (x) => { n++; return plain(x); };
    try { m.sync(A.scene, cam); } finally { Math.fround = plain; }
    return n;
  };
  const still = reads(true), all = reads(false);
  assert.ok(still < all * 0.4, `${still} floats compared, against ${all}`);
});

test('a shape whose object frames move with it (the banners: aObjP, aObjN) goes by vertices() when the backend allows it, whole when it says no', () => {
  for (const allow of [true, false]) {
    const calls = [];
    const B = { geometry: (gid) => calls.push(['geometry', gid]), vertices: (gid, p, n, count, a, c, moved) => { calls.push(['vertices', gid, moved]); return allow; }, create() {}, transforms() {}, visible() {}, geometryOf() {} };
    B.shapeAttrs = ['aObjP', 'aObjN'];
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry();
    const n = geo.attributes.position.count;
    geo.setAttribute('aObjP', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aObjN', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    scene.add(new THREE.Mesh(geo, makeMaterial({ color: '#808080' })));
    const m = new SceneMirror(B, { listMatrices: true });
    m.sync(scene, null);
    calls.length = 0;
    geo.attributes.position.array[0] += 1; geo.attributes.position.needsUpdate = true;
    geo.attributes.aObjP.array[0] += 1; geo.attributes.aObjP.needsUpdate = true;
    m.sync(scene, null);
    assert.deepEqual(calls.map((c) => c[0]), allow ? ['vertices'] : ['vertices', 'geometry'], `allowed ${allow}`);
    assert.deepEqual(calls[0][2], ['aObjP']);
    calls.length = 0;
    m.sync(scene, null);
    assert.deepEqual(calls, [], 'nothing again when nothing moved');
  }
});

test('the mirror\'s census (the bench\'s -split, issue #455): the frame\'s work against what changed', () => {
  const A = world(11), m = new SceneMirror(recorder().B, { quietWalk: true, listMatrices: true, stillMatrices: true, skipHidden: true });
  const cam = new THREE.PerspectiveCamera();
  for (let f = 1; f <= 6; f++) m.sync(A.scene, cam);
  m.profile();
  for (let f = 1; f <= 4; f++) { A.meshes[0].position.x += 1; m.sync(A.scene, cam); }
  const { census: c } = m.profile();
  assert.equal(c.listed, A.scene.__sceneList.n, 'every object of the list');
  assert.ok(c.drawn >= A.meshes.length && c.drawn <= c.visited, JSON.stringify(c));
  assert.ok(c.sent >= 1 && c.sent <= c.compared && c.compared < c.drawn, `one moved a frame, a few compared, not all: ${JSON.stringify(c)}`);
  assert.ok(c.listChanged >= 1 && c.listChanged < c.listed, JSON.stringify(c));
  assert.equal(m.profile().census.drawn, 0, 'read once: the next profile starts again');
});
