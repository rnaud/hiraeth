// The Fallen Ring: its shapes (src/levels/fallen-ring-kit.js) and its four References views
// (src/levels/reference-fallenring.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { ringSegment, arcThrough, placeRing, ringPose, tree, village, grazer, cloudBank, puff, RING_LOOK, RING_DAY } from '../src/levels/fallen-ring-kit.js';
import { sheetAt } from '../src/levels/reference-fallenring.js';
import { mulberry32 } from '../src/noise.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const tris = (list) => list.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);

test('the Fallen Ring\'s pictures: four views, one per sheet, in the References', async () => {
  const k = worldIndex('fallenring');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Fallen Ring');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['fallenring-1', 'fallenring-2', 'fallenring-3', 'fallenring-4']);
  assert.equal(new Set(w.views.map((v) => v.id)).size, 4);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Fallen Ring / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
  }
  assert.equal(RING_DAY.length, 5);
  assert.equal(RING_LOOK.uCumulus, 0, 'the great cumulus are geometry, not the horizon bank');
  assert.ok(RING_LOOK.uHazeLayers[3] > 0, 'the far ring pales into stepped haze');
});

test('a length of the ring: its skin faces out, an opening shows the inside, a broken end its wall', () => {
  const R = 300, S = ringSegment({ R, a0: 0.2, a1: 1.4, w: 40, h: 30, round: 3, seg: 6, sseg: 28, bands: [{ t: [0, 0.2], s: [0, 1] }], open: [{ t: [0.4, 0.6], s: [0.4, 0.6], ribs: 6 }], ends: { 0: { rag: 6, deep: 20 } }, joints: 30 });
  for (const k of ['hull', 'red', 'cut', 'inner', 'floor', 'frame', 'joint']) assert.ok(S[k].length > 0 && S[k].every(finite), k);
  const g = S.hull[0], P = g.attributes.position, N = g.attributes.normal;
  let out = 0, n = 0;
  for (let i = 0; i < P.count; i += 5) {
    const a = Math.atan2(P.getY(i), P.getX(i)), d = new THREE.Vector3(P.getX(i) - Math.cos(a) * R, P.getY(i) - Math.sin(a) * R, P.getZ(i));
    if (d.dot(new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i))) > 0) out++;
    n++;
  }
  assert.ok(out / n > 0.99, `the skin faces out (${out}/${n})`);
  const closed = ringSegment({ R, a0: 0.2, a1: 1.4, w: 40, h: 30, seg: 6, sseg: 28 });
  assert.ok(tris(S.hull) < tris(closed.hull), 'the opening and the band take their faces from the ivory skin');
  // its at(): a point on the outer face, its normal out from the centre line
  const q = S.at(0.5, 0);
  assert.ok(Math.abs(Math.hypot(q.p.x, q.p.y) - (R + 15)) < 0.5 && q.n.dot(q.p.clone().setZ(0).normalize()) > 0.95);
  // placed: the parts and at() move with the matrix
  placeRing(S, ringPose({ at: [0, -250, -400] }));
  assert.ok(Math.abs(S.at(0.5, 0).p.y - (q.p.y - 250)) < 1e-6);
});

test('an arc through three points: the sheets place the arches by three points of their centre line', () => {
  const A = new THREE.Vector3(-100, 0, -300), M = new THREE.Vector3(10, 180, -320), B = new THREE.Vector3(140, 20, -360);
  const C = arcThrough(A, M, B);
  for (const [P, a] of [[A, 0], [M, C.a[1]], [B, C.a[2]]]) {
    const p = new THREE.Vector3(Math.cos(a) * C.R, Math.sin(a) * C.R, 0).applyMatrix4(C.matrix);
    assert.ok(p.distanceTo(P) < 1e-6, 'on the circle, at its angle');
  }
  assert.ok(C.a[1] > 0 && C.a[2] > C.a[1], 'A, then M, then B');
  const L = arcThrough(new THREE.Vector3(0, 5, 0), new THREE.Vector3(50, 5, -10), new THREE.Vector3(100, 5, 0), { up: true });
  assert.ok(L.normal.y > 0.99, 'a ring lying down: its section\'s z the world\'s up');
  const ys = C.yAt(0);
  assert.equal(ys.length, 2);
  for (const a of ys) assert.ok(Math.abs(new THREE.Vector3(Math.cos(a) * C.R, Math.sin(a) * C.R, 0).applyMatrix4(C.matrix).y) < 1e-6, 'where it meets the ground');
});

test('the kit\'s small things: trees, the village, the grazers, the cumulus', () => {
  const T = tree({ h: 9, r: 4 });
  assert.ok(T.bark.length && T.green.length && T.green.every(finite));
  const Vg = village({ x0: -30, x1: 30, seed: 2 });
  assert.ok(Vg.glow.length > 4 && Vg.cloth.length + Vg.cloth2.length > 2 && Vg.fronts.length > 4, 'lit windows, awnings, house fronts');
  for (const [x0, x1, d] of Vg.fronts) assert.ok(x0 >= -30.01 && x1 <= 30.01 && d > 0, 'along the wall, out from it');
  const G = grazer(1);
  assert.ok(tris(G.wool) + tris(G.dark) < 400, 'a beast is a couple of hundred faces');
  const C = cloudBank(mulberry32(3), { n: 4 });
  assert.ok(C.length >= 4 * 8 && C.every((p) => p.s > 0 && p.y > 0), 'banks of puffs above the ground');
  assert.ok(puff(2).index, 'a puff is welded (smooth, not faceted)');
});

test('the views are placed off the sheets\' pixels: a point drawn at (px, py) d m away is seen there', () => {
  const cam = { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.8 };
  const pitch = Math.atan((cam.horizon - 0.5) * 2 * Math.tan((25 * Math.PI) / 180));
  const camera = new THREE.PerspectiveCamera(50, 1456 / 816, 0.1, 5000);
  camera.position.set(...cam.eye); camera.rotation.set(pitch, 0, 0, 'YXZ'); camera.updateMatrixWorld();
  for (const [px, py, d] of [[1150, 262, 185], [40, 640, 480], [728, 408, 50]]) {
    const p = sheetAt(cam, px, py, d).project(camera);
    assert.ok(Math.abs((p.x + 1) * 728 - px) < 0.5 && Math.abs((1 - p.y) * 408 - py) < 0.5, `${px}, ${py}`);
  }
});
