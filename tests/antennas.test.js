// The Forest of Antennas: its shapes (src/levels/antennas-kit.js) and its four References views
// (src/levels/reference-antennas.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { latticeTower, dish, saucer, aimAt, dome, egg, vineCable, trussStair, deck, bird, ANTENNAS_LOOK, ANTENNAS_DAY } from '../src/levels/antennas-kit.js';
import { sheetAt, sheetGround, FAR_MIN_R } from '../src/levels/reference-antennas.js';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createAntennas, ANTENNAS_CONTENT, PATH, BRANCH, OBS, RECEIVER, SETTLEMENT, SHIP, FALLEN, forestLayout, clear } from '../src/levels/antennas.js';

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
    assert.match(S.url, /The%20Forest%20of%20Antennas\/environment\/reference-\d\.jpeg$|The Forest of Antennas\/environment\/reference-\d\.jpeg$/);
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

// ------------------------------------------------------------------ the world (src/levels/antennas.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn, e = console.error, errors = []; console.warn = () => {}; console.error = (...a) => errors.push(a.join(' '));
  try { const level = createAntennas(scene); return { scene, level, physics: new Physics(scene, level.ground), errors }; } finally { console.warn = w; console.error = e; }
})();
const along = (pts, step = 1.5) => {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'), L = c.getLength(), out = [];
  for (let s = 0; s <= L; s += step) out.push(c.getPointAt(s / L));
  return out;
};

test('the Forest of Antennas: off the route, on the map from the start, reached by ?level=antennas', () => {
  const L = LEVELS.find((l) => l.id === 'antennas');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('antennas') && !ORDER.includes('antennas'));
  assert.equal(CONTENT.antennas, ANTENNAS_CONTENT);
  assert.ok(ANTENNAS_CONTENT.story.manual, 'no story to follow: no beacon, never in the way home');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'antennas');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
  const named = ANTENNAS_CONTENT.npcs.filter((p) => p.id && p.world).map((p) => p.id).sort();
  assert.deepEqual(named, ['lune', 'ottla', 'teb'], 'Lune and Ottla of the Sealed Hangar, Teb of the Signal Market');
  for (const p of ANTENNAS_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes, `${p.id}: only words for the forest, no errands`);
});

test('the forest\'s layout keeps the paths, the settlement and the ship clear, and stands in the walked land', () => {
  const L = forestLayout();
  assert.ok(L.filter((o) => o.kind === 'mast').length > 40 && L.filter((o) => o.kind === 'dish').length > 15, 'masts and dishes');
  for (const o of L) {
    assert.ok(!clear(o.x, o.z, o.r), `${o.kind} at ${o.x.toFixed(0)}, ${o.z.toFixed(0)} is off the paths`);
    assert.ok(Math.hypot(o.x, o.z) < 320);
  }
  for (const p of along(PATH)) assert.ok(clear(p.x, p.z), 'the path is open ground');
});

test('the Forest of Antennas builds: the ship\'s rise, the path walkable to the plaza, nothing in the way', () => {
  const { level, physics } = built();
  assert.equal(level.id, 'antennas');
  assert.deepEqual(built().errors, [], 'no errors building it');
  const g = (x, z) => level.ground.heightAt(x, z);
  assert.ok(Math.abs(level.spawn.y - g(level.spawn.x, level.spawn.z)) < 0.2, 'the traveller starts on the ground');
  // the ship's site is level enough to land on
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 6.3; a += 0.4) for (const r of [0, 6, 12]) { const h = g(SHIP.x + Math.cos(a) * r, SHIP.z + Math.sin(a) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(hi - lo < 2, `the ship's rise is gentle (${(hi - lo).toFixed(2)} m)`);
  let n = 0;
  for (const p of [...along(PATH, 1.2), ...along(BRANCH, 1.2)]) {
    const y = g(p.x, p.z);
    assert.equal(physics.pushCapsule(new THREE.Vector3(p.x, y + 0.05, p.z), 0.4, 0.6, 2.0), null, `nothing in the way on the path at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    n++;
  }
  assert.ok(n > 150);
  assert.ok(level.lights.length > 40, 'windows, beacons and the bridge\'s lamps');
});

test('the observation stair climbs to the deck, the bridge crosses to the receiver\'s balcony, solid all the way', () => {
  const { physics, level } = built();
  const g = (x, z) => level.ground.heightAt(x, z);
  let gmin = Infinity; for (let k = 0; k <= 8; k++) gmin = Math.min(gmin, g(OBS.x + (k ? Math.cos(k * 0.785) * 3 : 0), OBS.z + (k ? Math.sin(k * 0.785) * 3 : 0)));
  const top = gmin - 0.2 + OBS.top;
  // the deck
  for (const [dx, dz] of [[0, 0], [2, 2], [-2, 1.5], [1.5, -2.2]]) assert.ok(Math.abs(physics.groundAt(OBS.x + dx + 0.07, top + 2, OBS.z + dz + 0.05, 5) - top) < 0.12, 'the deck');
  // up the stair from the grass: each step a little higher
  const run = OBS.top / 0.68, z0 = OBS.z + 3 + run;
  let last = -Infinity, rises = 0;
  for (let t = 0.04; t < 0.97; t += 0.03) {
    const z = z0 + (OBS.z + 3 - z0) * t, x = OBS.x - 1.4 + 0.07, y = physics.groundAt(x, top + 3, z, top + 8);
    assert.ok(Number.isFinite(y) && y >= last - 0.05, `the stair climbs at ${t.toFixed(2)} (${y?.toFixed(2)} after ${last.toFixed(2)})`);
    if (y > last + 0.01) rises++;
    last = y;
  }
  assert.ok(rises > 15 && last > top - 1, 'step by step up to the deck');
  // across the bridge
  const a = new THREE.Vector3(OBS.x + 3.5, 0, OBS.z), b = new THREE.Vector3(RECEIVER.x - 8, 0, RECEIVER.z);
  for (let t = 0.02; t < 0.99; t += 0.04) {
    const p = a.clone().lerp(b, t), y = physics.groundAt(p.x + 0.07, top + 3, p.z + 0.05, 8);
    assert.ok(Number.isFinite(y) && y > top - 1.5, `the bridge holds at ${t.toFixed(2)}`);
    assert.equal(physics.pushCapsule(new THREE.Vector3(p.x, y + 0.05, p.z), 0.35, 0.6, 1.9), null, `the way across is clear at ${t.toFixed(2)}`);
  }
  // the receiver's balcony, round its turret
  const by = physics.groundAt(RECEIVER.x - 6, top + 3, RECEIVER.z + 0.05, 8);
  assert.ok(Number.isFinite(by), 'the balcony at the bridge\'s far end');
  for (let k = 0; k < 12; k++) { const a2 = (k / 12) * Math.PI * 2; assert.ok(Number.isFinite(physics.groundAt(RECEIVER.x + Math.cos(a2) * 6 + 0.05, by + 2, RECEIVER.z + Math.sin(a2) * 6 + 0.03, 4)), 'all round the turret'); }
});

test('the masts are drawn only, their feet kept clear by stand-ins; the workshops, the fallen dish solid as drawn', () => {
  const { scene, level, physics } = built();
  const m = level.layout.find((o) => o.kind === 'mast');
  const x = m.x + m.r + 0.2, y = level.ground.heightAt(x, m.z);
  assert.ok(physics.pushCapsule(new THREE.Vector3(x, y + 0.05, m.z), 0.4, 0.6, 2.0) !== null, 'you cannot walk into a mast\'s leg');
  assert.equal(physics.pushCapsule(new THREE.Vector3(m.x, level.ground.heightAt(m.x, m.z) + 0.3, m.z), 0.35, 0.6, 1.9), null, 'but you walk in under it, between its legs');
  // the domes stop you; you can stand in the fallen dish
  const dy = physics.groundAt(SETTLEMENT.x - 3, 40, SETTLEMENT.z - 19, 60);
  assert.ok(dy > level.ground.heightAt(SETTLEMENT.x - 4, SETTLEMENT.z - 20) + 3, 'the dome\'s top is solid');
  const fy = physics.groundAt(FALLEN.x + 1.5, 30, FALLEN.z + 1, 40);
  assert.ok(Number.isFinite(fy) && fy > level.ground.heightAt(FALLEN.x, FALLEN.z) - 3, 'the fallen dish is stood in');
  // the far forest: instanced, never thinner than ~1.5 px seen from the walked land
  const poles = level.far.find((o) => o.name === 'far masts'), mx = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  assert.ok(poles.count > 2000, 'masts by the thousand');
  for (let i = 0; i < poles.count; i += 37) { poles.getMatrixAt(i, mx); mx.decompose(p, q, s); assert.ok(s.x >= Math.max(0.3, FAR_MIN_R * Math.hypot(p.x, p.z + 10) * 0.85) * 0.99, 'thick enough not to crawl'); }
  // draws: a few meshes a cell, everything static merged or instanced
  let meshes = 0;
  scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
  assert.ok(meshes < 260, `meshes ${meshes}`);
  assert.ok(physics.triangles < 300000, `collision triangles ${physics.triangles}`);
  // the hum: strongest under the receiver, faint out on the open plain
  const under = level.hum(new THREE.Vector3(RECEIVER.x, 14, RECEIVER.z + 6)), open = level.hum(new THREE.Vector3(SHIP.x, 2, SHIP.z));
  assert.ok(under > 0.8 && open < 0.5 && open >= 0, `hum ${under.toFixed(2)} under the receiver, ${open.toFixed(2)} by the ship`);
});
