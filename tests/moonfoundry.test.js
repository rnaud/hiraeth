// The Moon Foundry: its shapes (src/levels/moon-foundry-kit.js) and its four References views
// (src/levels/reference-moonfoundry.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { lensShift, frameBox, viewCamera } from '../src/levels/references.js';
import { moon, craterSpots, courtyard, bowl, cradle, hangRig, pillar, roof, gantry, house, jibCrane, pourStream, MF_LOOK, MF_DAY } from '../src/levels/moon-foundry-kit.js';
import { sheetAt } from '../src/levels/reference-moonfoundry.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const box = (list) => { const b = new THREE.Box3(); for (const g of list) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('the Moon Foundry\'s pictures: four views, one per sheet, in the References', async () => {
  const k = worldIndex('moonfoundry');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Moon Foundry');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['moonfoundry-1', 'moonfoundry-2', 'moonfoundry-3', 'moonfoundry-4']);
  assert.equal(new Set(w.views.map((v) => v.id)).size, 4);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Moon Foundry / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.ok(v.camera.shift, `${v.id}: a shifted lens (the sheets keep their verticals upright)`);
  }
  assert.equal(MF_DAY.length, 5);
  assert.equal(MF_LOOK.uClouds, 0);
  assert.ok(MF_LOOK.uHazeLayers[3] > 0, 'the far moons step into a pale haze');
});

test('a shifted lens: the camera looks level, eye level crosses the frame at the horizon, a sheet pixel lands where it is drawn', () => {
  const cam = { eye: [0, 1.25, 0], yaw: 0, fov: 60, horizon: 0.9, shift: true };
  const c = viewCamera(cam);
  assert.ok(Math.abs(c.pitch) < 1e-9, 'level');
  const camera = new THREE.PerspectiveCamera(60, 1456 / 816, 0.1, 5000);
  camera.position.copy(c.eye); camera.lookAt(c.target); camera.updateMatrixWorld();
  lensShift(camera, cam, 1456, 816, frameBox(1456, 816, 1456 / 816, 60));
  assert.ok(camera.view?.enabled && camera.fov > 60, 'a window of a taller frame');
  for (const [px, py, d] of [[497, 455, 56], [1125, 470, 52], [20, 700, 12], [1400, 60, 90]]) {
    const p = sheetAt(cam, px, py, d).project(camera);
    assert.ok(Math.abs((p.x + 1) * 728 - px) < 0.5 && Math.abs((1 - p.y) * 408 - py) < 0.5, `${px}, ${py}`);
  }
  // a vertical stays vertical: a pillar's foot and top project to the same column
  const a = V(10, 0, -40).project(camera), b = V(10, 60, -40).project(camera);
  assert.ok(Math.abs(a.x - b.x) < 1e-9, 'no converging verticals');
  // and the lens is let go for a view without it
  lensShift(camera, { eye: [0, 2, 0], fov: 50, horizon: 0.6 }, 1456, 816, frameBox(1456, 816, 1456 / 816, 50));
  assert.ok(!camera.view?.enabled && Math.abs(camera.fov - 50) < 1e-9);
});

test('the foundry kit: a moon broken open, its craters, its courtyard at the lip, the cradle, the rig, the pillar, the roof, the gantry', () => {
  const R = 18, dir = V(0.3, 0.1, 1).normalize();
  const M = moon({ R, craters: 40, seed: 3, cut: { dir, angle: 0.8, ragged: 0.3 } });
  assert.ok(M.shell.length && M.inner.length && M.edge.length && M.crater.length, 'its shell, inside, edge and craters');
  for (const g of [...M.shell, ...M.inner, ...M.edge, ...M.crater]) assert.ok(finite(g));
  // nothing of the shell where the hole is
  const P = M.shell[0].attributes.position, q = V();
  for (let i = 0; i < P.count; i++) { q.fromBufferAttribute(P, i); assert.ok(q.angleTo(dir) > 0.8 * 0.5, 'the hole stays open'); }
  // the craters avoid the hole and don't overlap
  const spots = craterSpots(R, 40, 3, M.hole);
  assert.ok(spots.length >= 30);
  for (const s of spots) assert.ok(s.c.angleTo(dir) > 0.8, 'no crater in the hole');
  // the courtyard's floor sits just over the hole's lip: the lip hides its front edge
  const C = courtyard({ R, thick: 0.6, hole: M.hole, toward: dir, houses: 6, trees: 5, seed: 2 });
  const lip = (R - 0.6) * Math.sin(Math.asin(dir.y) - 0.8);
  assert.ok(C.fy > lip - 0.5 && C.fy < lip + 2.5, `the floor at ${C.fy.toFixed(1)}, the lip at ${lip.toFixed(1)}`);
  assert.ok(C.wall.length + C.wall2.length >= 3 && C.leaf.length >= 3 && C.glow.length > 0, 'houses with lit windows, trees');
  const hb = box([...C.wall, ...C.wall2, ...C.roofing]);
  assert.ok(hb.max.length() < R, 'the houses stay inside the shell');
  const Bw = bowl({ R: 12, cutY: 4 });
  assert.ok(Bw.deckY < 4 && Bw.shell.length && Bw.floor.length);
  const Cr = cradle({ R, yc: R * 1.15, arms: 4 });
  assert.ok(Cr.rust.length >= 12 && Cr.dark.length > 4, 'four claw arms, their knuckles and pistons');
  assert.ok(box(Cr.rust).max.y < R * 1.15 + 1 && box(Cr.rust).max.y > R * 0.9, 'gripping the moon below its middle');
  const Hr = hangRig({ R: 14, top: 40 });
  assert.ok(box(Hr.strut).max.y > 38 && box(Hr.rust).min.y > 10, 'the rig on its crown, the cables to the girder');
  const Pl = pillar({ h: 60, r: 3 });
  assert.ok(box(Pl.rust).max.y >= 60 && Pl.strut.length > 4 && Pl.dark.length > 2);
  const Rf = roof({ x0: -40, x1: 40, z0: -40, z1: 40, y: 50, bay: 20, cables: 6 });
  assert.ok(Rf.steel.length >= 20 && Rf.ceiling.length === 1 && Rf.strut.length > 40);
  const G = gantry([[0, 8, 0], [30, 8, 0], [30, 8, -20]], { ground: () => 0 });
  assert.ok(G.plank.length === 2 && G.rust.length > 6 && G.strut.length > 30, 'decks, chords and legs, the web and rails');
  const H = house({ floors: 2, lit: 1, seed: 4 });
  assert.ok(H.windows.length > 0 && H.top > 5);
  assert.ok(jibCrane({ h: 30, jib: 15 }).strut.length > 20);
  const S = pourStream({ drop: 8, rings: 16 });
  assert.equal(S.segs.length, 16);
});
