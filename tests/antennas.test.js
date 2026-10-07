// The Forest of Antennas: its shapes (src/levels/antennas-kit.js) and its four References views
// (src/levels/reference-antennas.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { latticeTower, dish, saucer, aimAt, dome, egg, vineCable, trussStair, deck, bird, ANTENNAS_LOOK, ANTENNAS_DAY } from '../src/levels/antennas-kit.js';
import { sheetAt, sheetGround, FAR_MIN_R } from '../src/levels/reference-antennas.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const box = (list) => { const b = new THREE.Box3(); for (const g of list) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };
const tris = (list) => list.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);

test('the Forest of Antennas\' pictures: four views, one per sheet, in the References', async () => {
  const k = worldIndex('antennas');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Forest of Antennas');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['antennas-1', 'antennas-2', 'antennas-3', 'antennas-4']);
  assert.equal(new Set(w.views.map((v) => v.id)).size, 4);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Forest of Antennas / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.match(S.url, /The%20Forest%20of%20Antennas\/reference-\d\.jpeg$|The Forest of Antennas\/reference-\d\.jpeg$/);
  }
  assert.equal(ANTENNAS_DAY.length, 5);
  assert.equal(ANTENNAS_LOOK.uClouds, 0);
  assert.ok(ANTENNAS_LOOK.uHazeLayers[3] > 0, 'the far masts fade into stepped haze');
});

test('the views are placed off the sheets\' pixels: a point drawn at (px, py) d m away is seen there', () => {
  const cam = { eye: [0, 2, 0], yaw: 0, fov: 50, horizon: 0.78 };
  const pitch = Math.atan((cam.horizon - 0.5) * 2 * Math.tan((25 * Math.PI) / 180));
  const camera = new THREE.PerspectiveCamera(50, 1456 / 816, 0.1, 5000);
  camera.position.set(...cam.eye); camera.rotation.set(pitch, 0, 0, 'YXZ'); camera.updateMatrixWorld();
  for (const [px, py, d] of [[1110, 230, 88], [148, 92, 27], [728, 408, 50], [20, 700, 12]]) {
    const p = sheetAt(cam, px, py, d).project(camera);
    assert.ok(Math.abs((p.x + 1) * 728 - px) < 0.5 && Math.abs((1 - p.y) * 408 - py) < 0.5, `${px}, ${py}`);
    assert.ok(Math.abs(-sheetAt(cam, px, py, d).z - d) < 1e-9);
  }
  const g = sheetGround(cam, 1200, 790);
  assert.ok(Math.abs(g.y) < 1e-9 && g.z < -5 && g.z > -20, 'the traveller\'s feet on the ground ahead');
  assert.ok(FAR_MIN_R > 0.001 && FAR_MIN_R * 500 >= 0.5, 'a mast 500 m off is drawn at least a metre wide: no crawl of pixels');
});

test('the antennas kit: a lattice mast, its dishes, its workshops, its stairs', () => {
  const L = latticeTower({ h: 30, w0: 2, w1: 0.5, legs: 4, bay: 3, vines: 0.8, hang: 0.8, seed: 2 });
  assert.equal(L.top.y, 30);
  assert.ok(L.iron.length >= 4 + 10 * 4 * 2, 'four legs and X-braced bays');
  assert.ok(L.vine.length > 2 && L.leaf.length > 4, 'vines climbing it, leaves on them, strands hanging');
  const b = box(L.iron);
  assert.ok(b.max.y >= 30 && b.min.y < 0 && b.max.x < 2.3 && b.max.x > 1.5, 'its legs from the ground to its top, tapering');
  const thin = latticeTower({ h: 30, legs: 3, bay: 3, detail: 0.5, vines: 0, hang: 0 });
  assert.ok(tris(thin.iron) < tris(latticeTower({ h: 30, legs: 3, bay: 3, vines: 0, hang: 0 }).iron) * 0.7, 'thinner bracing at low detail');
  for (const g of [...L.iron, ...L.vine, ...L.leaf]) assert.ok(finite(g));
  // a dish turned to face a direction: its rim's centre lies along it from the pivot
  const D = dish({ R: 6, depth: 0.3, feed: 'quad', back: true });
  assert.ok(D.dish.length === 1 && D.under.length === 1 && D.frame.length > 8);
  const dir = new THREE.Vector3(1, 1, 0).normalize();
  aimAt(D, dir, new THREE.Vector3(10, 20, 0));
  const c = box(D.dish).getCenter(new THREE.Vector3());
  assert.ok(c.clone().sub(new THREE.Vector3(10, 20, 0)).normalize().dot(dir) > 0.95, 'the bowl opens toward dir');
  const S = saucer({ R: 5 });
  assert.ok(S.dish.length && S.under.length && box(S.under).min.y < -1, 'a bowl on a conical underside');
  const W = dome({ R: 4, windows: 5, lit: 1 });
  assert.ok(W.shell.length && W.glow.length >= 5 && W.windows.length >= 5, 'lit windows and the door');
  const E = egg({ R: 6, H: 14, windows: 4, lit: 1 });
  assert.ok(box(E.shell).max.y > 13 && E.glow.length === 4);
  const V = vineCable(new THREE.Vector3(0, 10, 0), new THREE.Vector3(30, 12, 0), { sag: 4 });
  assert.ok(V.vine.length > 1 && V.leaf.length > 3 && box(V.vine).min.y < 8, 'sagging, leaves along it, strands hanging');
  const T = trussStair([0, 0, 0], [6, 4, 0]);
  assert.ok(T.plank.length >= 18 && T.frame.length > 6);
  const P = deck(0, 5, 0, 4, 4, { gaps: [[0, 0, 1.4]] });
  assert.ok(P.plank.length >= 8 && P.frame.length > 8);
  assert.ok(bird().attributes.position.count / 3 < 80, 'a bird is a few dozen faces');
});
