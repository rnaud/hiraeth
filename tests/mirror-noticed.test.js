// engine/mirror.js `noticed` with engine/mirror-notices.js (issue #455): a drawable looked at in full only when the notices
// say something of it was rewritten, its matrix compared only when the scene's list or a walk says it may have moved,
// its materials read every frame. The backend must hear exactly what it hears from the mirror that looks at everything
// and compares every matrix every frame: the same calls, in the same order, every frame, through moves made without any
// flag, owners writing their matrices, hides, geometries swapped and rewritten, attributes added, materials swapped and
// their colours, glows and live vectors moved, hooks put on late, shape keys, instances, bones, reparenting, things
// streaming in and going. And it must not hear it by looking at everything: most drawables are not looked at, most
// matrices not compared.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installNotices } from '../engine/mirror-notices.js';
import { installMatrixCache } from '../src/matrix-cache.js';
import { watchSceneEdits } from '../engine/scene-matrices.js';
import { SceneMirror } from '../engine/mirror.js';
import { makeMaterial } from '../src/materials.js';

installNotices();
installMatrixCache();
watchSceneEdits();
THREE.ColorManagement.enabled = false;

/** A backend writing down every call (arrays copied: the mirror hands its own). */
function recorder() {
  const log = [];
  const copy = (a) => (ArrayBuffer.isView(a) ? Array.from(a) : a?.isObject3D || a?.isBufferGeometry || a?.isMaterial ? '[ref]' : a && typeof a === 'object' ? JSON.stringify(a, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v?.isObject3D || v?.isBufferGeometry || v?.isMaterial ? '[ref]' : v)) : a);
  const B = {};
  for (const name of ['geometry', 'material', 'create', 'transforms', 'visible', 'geometryOf', 'vertices', 'instances', 'materialLive', 'materialVec', 'keyWeights', 'skeleton', 'remove', 'camera']) {
    B[name] = (...args) => {
      if (name === 'transforms') { const [ids, mats, n] = args; log.push([name, Array.from(ids.subarray(0, n)), Array.from(mats.subarray(0, n * 16))]); return; }
      if (name === 'geometry') { log.push([name, args[0], copy(args[1])]); return; }
      log.push([name, ...args.map(copy)]);
    };
  }
  return { B, log };
}

/** A world with a bit of everything the mirror sends. Deterministic by its seed. */
function world(seed) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const scene = new THREE.Scene(), meshes = [], groups = [];
  // (each world its own materials: makeMaterial shares one between equal options, and a mirror keeps what it read on it)
  const mats = [0, 1, 2, 3].map((i) => makeMaterial({ color: ['#808080', '#a05030', '#3070a0', '#e0d0b0'][i] }).clone());
  const geos = [new THREE.BoxGeometry(), new THREE.SphereGeometry(1, 6, 4), new THREE.PlaneGeometry(1, 1, 2, 2)];
  const put = (o, p) => { o.position.set(r() * 8, r() * 2, r() * 8); p.add(o); if (o.isMesh) meshes.push(o); return o; };
  for (let g = 0; g < 6; g++) {
    const grp = put(new THREE.Group(), g === 5 ? groups[0] : scene); groups.push(grp);
    for (let k = 0; k < 7; k++) put(new THREE.Mesh(geos[k % 3], mats[(g + k) % 4]), grp);
  }
  // an owner writing its matrix and flagging it; one writing its world matrix straight, no flag (veil.js's wash)
  const owned = put(new THREE.Mesh(geos[0], mats[0]), groups[1]); owned.matrixAutoUpdate = false;
  const direct = put(new THREE.Mesh(geos[0], mats[1]), scene); direct.matrixAutoUpdate = false;
  const ownWorld = put(new THREE.Mesh(geos[1], mats[2]), scene); ownWorld.matrixAutoUpdate = false; ownWorld.matrixWorldAutoUpdate = false;
  // a group with its own updateMatrixWorld that shows and hides its children (the part batches)
  const parts = put(new THREE.Group(), scene);
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(geos[2], mats[3]); c.matrixAutoUpdate = false; c.matrix.makeTranslation(k, 0, 0); parts.add(c); }
  parts.tick = 0;
  parts.updateMatrixWorld = function () { this.tick++; for (const c of this.children) { c.matrixWorld.copy(c.matrix); } this.children[1].visible = this.tick % 5 !== 0; };
  // a rig and its skin, a prop in its hand
  const bones = [put(new THREE.Bone(), scene)];
  for (let i = 1; i < 8; i++) bones.push(put(new THREE.Bone(), bones[i - 1]));
  const skinned = put(new THREE.SkinnedMesh(new THREE.BoxGeometry(), mats[1]), scene);
  scene.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));
  const prop = put(new THREE.Mesh(geos[0], mats[2]), bones[5]);
  // instances; a face with shape keys and its hook (face-keys.js); a geometry of its own to rewrite (cloth)
  const inst = put(new THREE.InstancedMesh(geos[0], mats[0], 6), scene);
  const face = put(new THREE.Mesh(geos[1], makeMaterial({ color: '#c09070' }).clone()), groups[2]);
  face.userData.keyWeights = new Float32Array(3);
  face.onBeforeRender = () => {};
  const cloth = put(new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 3, 3), mats[3]), groups[3]);
  return { scene, meshes, groups, r, owned, direct, ownWorld, parts, bones, skinned, prop, inst, face, cloth, mats, geos };
}

/** One frame of changes, the same on both copies (their own random numbers). */
function step(w, f) {
  const { r, meshes } = w;
  const pick = () => meshes[Math.floor(r() * meshes.length)];
  // moves with no flag of any kind: a position, a turn, a scale, a group carrying its children
  for (let k = 0; k < 3; k++) pick().position.y += 0.1;
  if (f % 3 === 0) pick().rotation.y += 0.3;
  if (f % 4 === 0) pick().scale.x *= 1.1;
  if (f % 5 === 1) w.groups[Math.floor(r() * w.groups.length)].position.x += 0.2;
  // reads and walks of the game's own between frames (stamped for the mirror: src/matrix-cache.js)
  if (f % 6 === 2) { const g = w.groups[4]; g.position.z -= 0.3; g.updateMatrixWorld(true); }
  if (f % 7 === 3) { const m = pick(); m.position.x += 0.2; m.getWorldPosition(new THREE.Vector3()); }
  // owners' matrices: flagged, and written straight with no flag
  if (f % 2 === 0) { w.owned.matrix.makeTranslation(f * 0.1, 0, 0); w.owned.matrixWorldNeedsUpdate = true; }
  if (f % 3 === 1) w.direct.matrixWorld.makeTranslation(0, f * 0.1, 0);
  if (f % 4 === 2) w.ownWorld.matrixWorld.makeTranslation(f * 0.2, 1, 0);
  // hides and shows, of a mesh and of a group
  if (f % 9 === 4) { const m = pick(); m.visible = !m.visible; }
  if (f === 11) w.groups[2].visible = false;
  if (f === 15) w.groups[2].visible = true;
  // a geometry swapped, a shared geometry rewritten, an attribute added, another index
  if (f % 8 === 5) pick().geometry = w.geos[Math.floor(r() * 3)];
  if (f === 13) { const p = w.geos[2].attributes.position; p.array[1] += 0.5; p.needsUpdate = true; }
  if (f === 17) w.geos[1].setAttribute('aExtra', new THREE.BufferAttribute(new Float32Array(w.geos[1].attributes.position.count), 1));
  if (f === 21) w.geos[0].setIndex(Array.from(w.geos[0].index.array).reverse());
  if (f % 2 === 1) { const p = w.cloth.geometry.attributes.position; p.array[4] = Math.sin(f); p.needsUpdate = true; w.cloth.geometry.attributes.normal.needsUpdate = true; }
  // materials: one swapped on a quiet mesh, colours and glows moved, a live vector (a face's mood)
  if (f % 10 === 6) pick().material = w.mats[Math.floor(r() * 4)];
  if (f % 6 === 1) w.mats[Math.floor(r() * 4)].uniforms.uColor.value.setRGB(r(), r(), r());
  if (f % 7 === 0) w.mats[Math.floor(r() * 4)].uniforms.uGlow.value = r();
  if (f % 5 === 3) w.face.material.uniforms.uMood.value.set(r(), r(), 0, 0);
  // a hook put on late, on a quiet mesh: it sets its glow for the draw and gives it back after
  if (f === 19) {
    const m = w.meshes[3], mat = m.material.clone();
    m.material = mat;
    m.onBeforeRender = () => { mat.uniforms.uGlow.value = 0.9; };
    m.onAfterRender = () => { mat.uniforms.uGlow.value = 0; };
  }
  // a face's shape keys, instances, bones
  w.face.userData.keyWeights[f % 3] = (f % 7) / 7;
  if (f % 4 === 0) { w.inst.setMatrixAt(f % 6, new THREE.Matrix4().makeTranslation(f, 0, 0)); w.inst.instanceMatrix.needsUpdate = true; }
  w.bones[2].rotation.z = f * 0.1;
  // reparenting (a thing changing hands), streaming in, going
  if (f === 14) w.groups[3].attach(w.groups[0].children[3]);
  if (f === 18) w.bones[6].add(new THREE.Mesh(w.geos[0], w.mats[1]));
  if (f === 23) { const m = new THREE.Mesh(w.geos[1], w.mats[2]); m.position.set(1, 2, 3); w.groups[1].add(m); w.meshes.push(m); }
  if (f === 27) w.prop.removeFromParent();
}

const cam = () => { const c = new THREE.PerspectiveCamera(); c.position.set(0, 2, 10); return c; };
const noticed = (B) => new SceneMirror(B, { quietWalk: true, listMatrices: true, stillMatrices: true, skipHidden: true, noticed: true });
const everything = (B) => new SceneMirror(B, { quietWalk: false, listMatrices: true, stillMatrices: false, skipHidden: true });

/** Both mirrors over the same changes for `frames`: the first frame they differ, or 0. sabotage(world, f, which) runs on both copies before each sync ('noticed', 'everything'). */
function race(frames, { seed = 5, sabotage = null } = {}) {
  const A = world(seed), B = world(seed), a = recorder(), b = recorder(), cA = cam(), cB = cam();
  const mA = noticed(a.B), mB = everything(b.B), ops = new Set();
  for (let f = 1; f <= frames; f++) {
    step(A, f); step(B, f);
    sabotage?.(A, f, 'noticed'); sabotage?.(B, f, 'everything');
    mA.sync(A.scene, cA); mB.sync(B.scene, cB);
    if (JSON.stringify(a.log) !== JSON.stringify(b.log)) return { at: f, a: a.log, b: b.log, mA };
    for (const x of a.log) ops.add(x[0]);
    a.log.length = 0; b.log.length = 0;
  }
  return { at: 0, mA, mB, ops };
}

test('the noticed mirror tells the backend what the mirror looking at everything does, call for call, frame for frame', () => {
  for (const seed of [5, 11, 23]) {
    const r = race(60, { seed });
    assert.equal(r.at, 0, `seed ${seed}, frame ${r.at}: ${JSON.stringify(r.a?.slice(0, 6))}\n  against ${JSON.stringify(r.b?.slice(0, 6))}`);
    // (and every kind of news was in it)
    for (const op of ['create', 'transforms', 'visible', 'geometry', 'geometryOf', 'vertices', 'materialLive', 'materialVec', 'keyWeights', 'instances', 'skeleton']) assert.ok(r.ops.has(op), `seed ${seed}: no ${op} in ${[...r.ops]}`);
  }
});

test('…without looking at everything: most drawables not looked at, most matrices not compared', () => {
  const r = race(40);
  const { census: c } = r.mA.profile();
  assert.ok(c.looked < c.drawn * 0.5, `looked at ${c.looked} of ${c.drawn} a frame`);
  assert.ok(c.compared < c.drawn * 0.6, `compared ${c.compared} of ${c.drawn} a frame`);
  assert.ok(c.sent > 3, `sent ${c.sent} a frame`);
});

test('the check has teeth: a move the list does not report, or an attribute rewritten behind the notices, is caught', () => {
  // (the list's word on what moved made "nothing": the moves made with no flag are then missed, and the race says so)
  const blind = race(30, { sabotage: (w, f, which) => { if (which !== 'noticed') return; const L = w.scene.__sceneList; if (L && !L.__blind) { const u = L.update.bind(L); L.update = (...a) => { const ok = u(...a); L.changed.fill(0); return ok; }; L.__blind = true; } } });
  assert.ok(blind.at > 0, 'a mirror told nothing moved must differ');
  // (an attribute's version moved by hand, not by needsUpdate: what the notices rule out, and the race sees it)
  const behind = race(30, { sabotage: (w, f) => { if (f === 12) { const p = w.geos[1].attributes.position; p.array[2] += 1; p.version++; } } });
  assert.equal(behind.at, 12, `an attribute rewritten behind the notices: caught at frame ${behind.at}`);
});

test('a hook put on an object before the notices (a data property of its own) is still called, every frame', () => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(), makeMaterial({ color: '#808080' }).clone());
  let calls = 0;
  Object.defineProperty(m, 'onBeforeRender', { value: () => { calls++; }, writable: true, configurable: true, enumerable: true });
  const scene = new THREE.Scene(); scene.add(m);
  const mirror = noticed(recorder().B), c = cam();
  for (let f = 0; f < 5; f++) mirror.sync(scene, c);
  assert.equal(calls, 5);
});
