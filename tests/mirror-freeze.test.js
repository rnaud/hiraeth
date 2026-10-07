// The scene mirror's frozen subtrees (engine/mirror-freeze.js): a still subtree is taken whole, and whatever
// changes in it is still sent the frame it changes. Checked against a mirror that walks everything, on the same
// scene, through moves, turns, scales, hides, children added, removed and moved elsewhere, and colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SceneMirror } from '../engine/mirror.js';
import { STILL_FRAMES, SURVEY_EVERY, CHECK_ROUND } from '../engine/mirror-freeze.js';
import { makeMaterial } from '../src/materials.js';

THREE.ColorManagement.enabled = false;

/** What a backend believes: each id's world matrix and visibility, each material's live colour, geometry uploads. */
function believer() {
  const S = { mat: new Map(), vis: new Map(), live: new Map(), geometries: 0, vertices: 0 };
  S.backend = {
    geometry: () => { S.geometries++; }, material: () => {}, create: () => {},
    visible: (id, on) => S.vis.set(id, on),
    remove: (id) => { S.vis.delete(id); S.mat.delete(id); },
    transforms: (ids, mats, n) => { for (let i = 0; i < n; i++) S.mat.set(ids[i], Array.from(mats.subarray(i * 16, i * 16 + 16))); },
    materialLive: (mid, c, g) => S.live.set(mid, [c && [...c], g]),
  };
  return S;
}

/** A small world: nested groups of still meshes, a few loose ones. Deterministic. */
function world(seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = [0, 1, 2, 3].map((i) => { const m = makeMaterial({ color: '#c0a080' }).clone(); m.uniforms = { ...m.uniforms, uColor: { value: new THREE.Color(0.2 * i, 0.5, 0.4) } }; return m; });
  const meshes = [], groups = [];
  const mesh = () => { const m = new THREE.Mesh(geo, mats[Math.floor(rnd() * 4)]); m.position.set(rnd() * 10, rnd() * 3, rnd() * 10); m.rotation.y = rnd() * 3; meshes.push(m); return m; };
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.position.set(i * 3, 0, 0); groups.push(g); scene.add(g);
    for (let k = 0; k < 4; k++) g.add(mesh());
    const sub = new THREE.Group(); sub.rotation.x = 0.3 * i; groups.push(sub); g.add(sub);
    for (let k = 0; k < 3; k++) sub.add(mesh());
  }
  for (let k = 0; k < 4; k++) scene.add(mesh());
  return { scene, meshes, groups, mats, rnd, mesh };
}

test('frozen subtrees: taken whole when still, and every change still sent the frame it happens', () => {
  // (two copies of one world, the same changes made to both: one mirrored with freezing, one walked whole)
  const W = [world(7), world(7)];
  for (const w of W) w.meshes.forEach((m, i) => { m.name = `mesh ${i}`; });
  const camera = new THREE.PerspectiveCamera();
  const A = believer(), B = believer();
  const mA = new SceneMirror(A.backend, { freeze: true }), mB = new SceneMirror(B.backend, { freeze: false });
  let f = 0;
  const removed = [new Set(), new Set()];
  const frame = () => {
    f++; mA.sync(W[0].scene, camera); mB.sync(W[1].scene, camera);
    const objs = (w, i) => { const L = []; w.scene.traverse((o) => { if (o.isMesh) L.push(o); }); for (const o of removed[i]) if (!L.includes(o)) L.push(o); return L; };
    const a = objs(W[0], 0), b = objs(W[1], 1);
    // (the same objects in the same order)
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      const ia = mA.idOf(a[i]), ib = mB.idOf(b[i]);
      const va = !!(ia && A.vis.get(ia)), vb = !!(ib && B.vis.get(ib));
      assert.equal(va, vb, `frame ${f}: ${a[i].name} shown ${va} with freezing, ${vb} without`);
      if (!va) continue;
      const ma = A.mat.get(ia), mb = B.mat.get(ib);
      for (let k = 0; k < 16; k++) assert.ok(Math.abs(ma[k] - mb[k]) < 1e-6, `frame ${f}: ${a[i].name}'s matrix [${k}] ${ma[k]} against ${mb[k]}`);
    }
    for (let i = 0; i < 4; i++) assert.deepEqual(A.live.get(mA.mats.get(W[0].mats[i])), B.live.get(mB.mats.get(W[1].mats[i])), `frame ${f}: a material's colour`);
  };
  for (let i = 0; i < STILL_FRAMES + 2 * SURVEY_EVERY; i++) frame();
  assert.ok(mA.stats.frozen >= 1, `still subtrees frozen: ${mA.stats.frozen}`);
  assert.ok(mA.stats.visited < mB.stats.visited / 2, `the walk goes into fewer: ${mA.stats.visited} against ${mB.stats.visited}`);
  assert.equal(mA.stats.drawn, mB.stats.drawn, 'and draws as many');
  // changes, one every few frames, with stills between (subtrees freeze again); r: the change's random numbers, the same for both
  const all = (w) => { const L = []; w.scene.traverse((o) => { if (o !== w.scene) L.push(o); }); return L; };
  const at = (L, x) => L[Math.floor(x * L.length) % L.length];
  const changes = [
    (w, r) => { at(w.meshes, r[0]).position.x += 0.5; },
    (w, r) => { at(w.groups, r[0]).position.y += 0.25; },
    (w, r) => { at(w.meshes, r[0]).rotation.y += 0.3; },
    (w, r) => { at(w.groups, r[0]).quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r[1] * 6); },
    (w, r) => { at(w.meshes, r[0]).scale.set(1 + r[1], 1, 1); },
    (w, r) => { const o = at(all(w), r[0]); if (o) o.visible = !o.visible; },
    (w, r, i) => { const m = at(w.meshes, r[0]); if (m.parent) { m.parent.remove(m); removed[i].add(m); } },
    (w, r) => { const g = at(w.groups, r[0]); const m = new THREE.Mesh(w.meshes[0].geometry, w.mats[0]); m.name = `new ${f}`; m.position.set(r[1], 0, r[2]); w.meshes.push(m); g.add(m); },
    (w, r) => { const m = at(w.meshes, r[0]), g = at(w.groups, r[1]); if (m.parent && m.parent !== g && !m.children.includes(g)) g.attach(m); },
    (w, r) => { const m = at(w.meshes, r[0]); m.position.copy(m.position); m.rotation.y = m.rotation.y; m.visible = m.visible; },   // (the same values: nothing)
    (w, r) => { at(w.mats, r[0]).uniforms.uColor.value.setRGB(r[1], r[2], r[3]); },
    (w, r) => { const m = at(w.meshes, r[0]); m.position.set(m.position.x, m.position.y + 0.1, m.position.z); m.updateMatrix(); },
    (w, r) => { at(w.meshes, r[0]).lookAt(r[1] * 10, 0, r[2] * 10); },
  ];
  const rnd = W[0].rnd;
  let frozeAgain = 0;
  for (let round = 0; round < 400; round++) {
    const quiet = round % 50 > 30;
    if (!quiet && rnd() < 0.5) { const c = changes[Math.floor(rnd() * changes.length)], r = [rnd(), rnd(), rnd(), rnd()]; c(W[0], r, 0); c(W[1], r, 1); }
    frame();
    if (quiet && mA.stats.frozen > 0) frozeAgain++;
  }
  assert.ok(frozeAgain > 0, 'subtrees froze again after changes');
  assert.ok(mA.stats.thaws > 20, `changes inside frozen subtrees thawed them: ${mA.stats.thaws}`);
  // thawed, everything is as it was
  mA.thawAll();
  for (const o of all(W[0])) {
    assert.ok(!Object.getOwnPropertyDescriptor(o.position, 'x').get, 'positions plain again');
    assert.ok(!Object.getOwnPropertyDescriptor(o, 'visible').get, 'visible plain again');
    assert.ok(!Object.prototype.hasOwnProperty.call(o, 'updateMatrixWorld'), 'three\'s own matrix update again');
  }
  frame();
});

test('frozen subtrees: a geometry rewritten in place inside one is sent within a round of checks', () => {
  const { scene, meshes } = world(3);
  const A = believer(), mA = new SceneMirror(A.backend, { freeze: true });
  for (let i = 0; i < STILL_FRAMES + 2 * SURVEY_EVERY; i++) mA.sync(scene, null);
  assert.ok(mA.stats.frozen >= 1);
  const own = new THREE.BoxGeometry(2, 2, 2);
  meshes[0].geometry = own;   // (swapped: no hook on .geometry)
  const g0 = A.geometries;
  let k = 0;
  while (A.geometries === g0 && k < CHECK_ROUND + 2) { mA.sync(scene, null); k++; }
  assert.ok(A.geometries > g0, `sent after ${k} frames`);
  assert.ok(k <= CHECK_ROUND + 1, `within a round (${k})`);
});

test('frozen subtrees: the root\'s parent moving (a ship flying off) moves what is in it at once', () => {
  const scene = new THREE.Scene(), ship = new THREE.Group(), hull = new THREE.Group();
  const geo = new THREE.BoxGeometry(), mat = makeMaterial({ color: '#808080' });
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(geo, mat); m.position.x = i; hull.add(m); }
  ship.add(hull); scene.add(ship);
  // (the ship itself a mover the survey never takes: it has its own render hook)
  const marker = new THREE.Mesh(geo, mat); marker.onBeforeRender = () => {}; ship.add(marker);
  const A = believer(), mA = new SceneMirror(A.backend, { freeze: true });
  for (let i = 0; i < STILL_FRAMES + 2 * SURVEY_EVERY; i++) mA.sync(scene, null);
  assert.ok(mA.stats.frozen >= 1, 'the hull frozen');
  ship.position.z = 40;
  mA.sync(scene, null);
  const id = mA.idOf(hull.children[3]);
  assert.equal(A.mat.get(id)[14], 40, 'the hull\'s meshes moved with it the same frame');
  assert.equal(A.mat.get(id)[12], 3);
});

test('a skeleton\'s bones are walked only down to what hangs on them, and a prop put in a hand is seen at once', () => {
  const scene = new THREE.Scene(), root = new THREE.Bone();
  let b = root;
  const bones = [root];
  for (let i = 0; i < 30; i++) { const c = new THREE.Bone(); c.position.y = 0.1; b.add(c); bones.push(c); b = c; }
  scene.add(root);
  const A = believer(), mA = new SceneMirror(A.backend, { freeze: true });
  mA.sync(scene, null);
  const bare = mA.stats.visited;
  assert.ok(bare <= 3, `bare bones not walked: ${bare}`);
  const hand = bones[25], prop = new THREE.Mesh(new THREE.BoxGeometry(), makeMaterial({ color: '#808080' }));
  hand.add(prop);
  mA.sync(scene, null);
  const id = mA.idOf(prop);
  assert.ok(id && A.vis.get(id), 'the prop in the hand drawn the next frame');
  assert.ok(Math.abs(A.mat.get(id)[13] - 2.5) < 1e-5, 'where the hand is');
  hand.remove(prop);
  mA.sync(scene, null);
  assert.equal(A.vis.get(id), false, 'and hidden when taken out');
});
