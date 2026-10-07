// The Fallen Ring: its shapes (src/levels/fallen-ring-kit.js) and its four References views
// (src/levels/reference-fallenring.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { ringSegment, arcThrough, placeRing, ringPose, tree, village, grazer, cloudBank, puff, RING_LOOK, RING_DAY } from '../src/levels/fallen-ring-kit.js';
import { sheetAt } from '../src/levels/reference-fallenring.js';
import { mulberry32 } from '../src/noise.js';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createFallenRing, RING_CONTENT, PATH, WEST, EAST, SHIP, HERDS, STAIR_S, STAIR_RUN } from '../src/levels/fallen-ring.js';

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

// ------------------------------------------------------------------ the world (src/levels/fallen-ring.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn, e = console.error, errors = []; console.warn = () => {}; console.error = (...a) => errors.push(a.join(' '));
  try { const level = createFallenRing(scene); return { scene, level, physics: new Physics(scene, level.ground), errors }; } finally { console.warn = w; console.error = e; }
})();
const along = (pts, step = 1.5) => {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'), L = c.getLength(), out = [];
  for (let s = 0; s <= L; s += step) out.push(c.getPointAt(s / L));
  return out;
};

test('the Fallen Ring: off the route, on the map from the start, reached by ?level=fallenring', () => {
  const L = LEVELS.find((l) => l.id === 'fallenring');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('fallenring') && !ORDER.includes('fallenring'));
  assert.equal(CONTENT.fallenring, RING_CONTENT);
  assert.ok(RING_CONTENT.story.manual, 'no story to follow: no beacon, never in the way home');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'fallenring');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
  assert.deepEqual(RING_CONTENT.npcs.filter((p) => p.id).map((p) => p.id).sort(), ['ivo', 'oro'], 'Oro of Viridel and Emrys of the Garden of Spheres');
  for (const p of RING_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes && !p.talk.entry, `${p.id}: only words for the ring, no errands`);
});

test('the Fallen Ring builds: the path clear from the ship to the tube\'s village, the branches too', () => {
  const { level, physics, errors } = built();
  assert.equal(level.id, 'fallenring');
  assert.deepEqual(errors, [], 'no errors building it');
  const g = (x, z) => level.ground.heightAt(x, z);
  assert.ok(Math.abs(level.spawn.y - g(level.spawn.x, level.spawn.z)) < 0.2, 'the traveller starts on the ground');
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 6.3; a += 0.4) for (const r of [0, 6, 12]) { const h = g(SHIP.x + Math.cos(a) * r, SHIP.z + Math.sin(a) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(hi - lo < 1.5, `the ship's ground is level (${(hi - lo).toFixed(2)} m)`);
  let n = 0;
  for (const p of [...along(PATH, 1.2), ...along(WEST, 1.2), ...along(EAST, 1.2)]) {
    assert.equal(physics.pushCapsule(new THREE.Vector3(p.x, g(p.x, p.z) + 0.05, p.z), 0.4, 0.6, 2.0), null, `nothing in the way on the path at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    n++;
  }
  assert.ok(n > 200);
  assert.ok(level.lights.length > 60, 'windows, lanterns and the lamps in the broken end');
});

test('the long tube is solid as drawn: its crest stood on, its stairs climbed, its broken end walked into', () => {
  const { level, physics } = built();
  const crest = level.parts.tube.at(0.5, 0.25);
  const y = physics.groundAt(crest.p.x, crest.p.y + 3, crest.p.z, 8);
  assert.ok(Number.isFinite(y) && Math.abs(y - crest.p.y) < 0.3, `the crest is stood on (${y?.toFixed(2)} by ${crest.p.y.toFixed(2)})`);
  assert.ok(crest.p.y > 15, 'the crest is high over the grass');
  // the stairs: step by step from the grass to the crest's flank
  for (const t of [0.2, 0.47, 0.72]) {
    const top = level.parts.tube.at(t, STAIR_S, 0.05), n = top.n.clone().setY(0).normalize(), foot = top.p.clone().addScaledVector(n, (top.p.y - level.ground.heightAt(top.p.x, top.p.z)) * STAIR_RUN);
    foot.y = level.ground.heightAt(foot.x, foot.z);
    let last = -Infinity, rises = 0;
    for (let k = 0.06; k < 0.95; k += 0.04) {
      const p = foot.clone().lerp(top.p, k), yy = physics.groundAt(p.x + 0.05, p.y + 2, p.z + 0.03, 5);
      assert.ok(Number.isFinite(yy) && yy >= last - 0.1, `the stair at ${t} climbs at ${k.toFixed(2)} (${yy} after ${last})`);
      if (yy > last + 0.01) rises++;
      last = yy;
    }
    assert.ok(rises > 12 && last > top.p.y - 2.5, `step by step up (${t}: ${rises} rises, to ${last.toFixed(2)} of ${top.p.y.toFixed(2)})`);
  }
  // the floor in the broken end
  const e = level.parts.tube.at(0.95, 0.75), fy = physics.groundAt(e.p.x, e.p.y + 6, e.p.z, 10);
  assert.ok(Number.isFinite(fy) && fy > level.ground.heightAt(e.p.x, e.p.z) + 0.5, 'the old street inside the broken end is a floor');
});

test('the beasts graze in their herds and shy from the traveller; the far ring is one or two draws', () => {
  const { level, scene, physics } = built();
  const H = level.herds;
  assert.equal(H.beasts.length, HERDS.reduce((s, h) => s + h[3], 0));
  const b = H.beasts[0], [x0, z0] = H.at(0), eye = new THREE.Vector3(x0 + 2, 0, z0);
  for (let i = 0; i < 40; i++) H.update(0.1, eye);
  assert.ok(Math.hypot(b.x - eye.x, b.z - eye.z) > 6, 'it trots off from you');
  for (let i = 0; i < 400; i++) H.update(0.5, null);
  for (const q of H.beasts) assert.ok(Math.hypot(q.x - q.home[0], q.z - q.home[1]) < q.home[2] + 25, 'and grazes back near its herd');
  let meshes = 0;
  scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
  assert.ok(meshes < 200, `meshes ${meshes}`);
  assert.ok(level.far.filter((m) => m.name.startsWith('the far ring')).length <= 2, 'the far ring: one or two draws');
  assert.ok(physics.triangles < 160000, `collision triangles ${physics.triangles}`);
});
