// The Moon Foundry: its shapes (src/levels/moon-foundry-kit.js) and its four References views
// (src/levels/reference-moonfoundry.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { lensShift, frameBox, viewCamera } from '../src/levels/references.js';
import { moon, craterSpots, courtyard, bowl, cradle, hangRig, pillar, roof, gantry, house, jibCrane, pourStream, MF_LOOK, MF_DAY } from '../src/levels/moon-foundry-kit.js';
import { sheetAt } from '../src/levels/reference-moonfoundry.js';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createMoonFoundry, MOONFOUNDRY_CONTENT, SHIP, MOUTH, HALL, STAIR, G, COURT, COURT_Y, BOWL, FURNACE, CRADLE, HUNG } from '../src/levels/moon-foundry.js';

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
  // a resize puts the screen's aspect back on the camera: the next frame sets the taller frame's again (it stretched the views)
  camera.aspect = 1456 / 816; camera.updateProjectionMatrix();
  lensShift(camera, cam, 1456, 816, frameBox(1456, 816, 1456 / 816, 60));
  for (const [px, py, d] of [[20, 700, 12], [1400, 60, 90]]) {
    const p = sheetAt(cam, px, py, d).project(camera);
    assert.ok(Math.abs((p.x + 1) * 728 - px) < 0.5 && Math.abs((1 - p.y) * 408 - py) < 0.5, `after a resize: ${px}, ${py}`);
  }
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

// ------------------------------------------------------------------ the world (src/levels/moon-foundry.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn, e = console.error, errors = [], warns = []; console.warn = (...a) => warns.push(a.join(' ')); console.error = (...a) => errors.push(a.join(' '));
  try { const level = createMoonFoundry(scene); return { scene, level, physics: new Physics(scene, level.ground), errors, warns }; } finally { console.warn = w; console.error = e; }
})();
const clearAt = (physics, p, y) => physics.pushCapsule(new THREE.Vector3(p.x, y + 0.05, p.z), 0.35, 0.6, 1.9) === null;
const line = (a, b, step = 1) => { const A = V(...a), B = V(...b), n = Math.max(1, Math.ceil(A.distanceTo(B) / step)); return Array.from({ length: n + 1 }, (_, i) => A.clone().lerp(B, i / n)); };

test('the Moon Foundry: on the route since v1.40, after the Buried Machine, reached by ?level=moonfoundry', () => {
  const L = LEVELS.find((l) => l.id === 'moonfoundry');
  assert.ok(L && !L.hidden && !L.dev, 'a world on the route');
  assert.ok(!SIDE.includes('moonfoundry') && ORDER.indexOf('moonfoundry') === ORDER.indexOf('buried') + 1, 'right after the Buried Machine');
  assert.equal(CONTENT.moonfoundry, MOONFOUNDRY_CONTENT);
  assert.ok(MOONFOUNDRY_CONTENT.story.manual, 'its page closes when the Casting-House is quiet (src/story/moonfoundry.js)');
  assert.equal(MOONFOUNDRY_CONTENT.relics.spots.length, 5, 'five relics, as every route world');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'moonfoundry');
  assert.ok(e && !e.side, 'on the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
  const named = MOONFOUNDRY_CONTENT.npcs.filter((p) => p.id && p.world).map((p) => p.id).sort();
  assert.deepEqual(named, ['dun', 'ivo', 'wen'], 'Dun and Wen of the Buried Machine, Emrys of the Garden of Spheres');
  for (const id of ['bertil', 'ottilie']) assert.ok(MOONFOUNDRY_CONTENT.npcs.some((p) => p.id === id && p.talk?.nodes), `${id}: an errand of the foundry's own`);
  for (const p of MOONFOUNDRY_CONTENT.npcs) for (const l of p.lines) assert.match(l, /^~[a-z]+~ /, 'every line toned');
});

test('the Moon Foundry builds: the apron flat by the ship, the way in clear, the people where they stand', () => {
  const { level, physics, errors, warns } = built();
  assert.equal(level.id, 'moonfoundry');
  assert.deepEqual(errors, [], 'no errors building it');
  assert.deepEqual(warns.filter((w) => /moon foundry/.test(w)), [], 'the courtyard\'s floor and the gantry meet');
  const g = (x, z) => level.ground.heightAt(x, z);
  assert.ok(Math.abs(level.spawn.y - g(level.spawn.x, level.spawn.z)) < 0.2, 'the traveller starts on the ground');
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 6.3; a += 0.4) for (const r of [0, 8, 16]) { const h = g(SHIP.x + Math.cos(a) * r, SHIP.z + Math.sin(a) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(hi - lo < 0.5, `the apron is flat (${(hi - lo).toFixed(2)} m)`);
  assert.ok(SHIP.z - 20 > MOUTH, 'the ship lands outside the hangar: nothing over it');
  // from the spawn in through the mouth and up the aisle to the stair's foot: nothing in the way
  for (const p of [...line([0, 0, level.spawn.z], [0, 0, MOUTH - 10]), ...line([0, 0, MOUTH - 10], [STAIR.x - 3, 0, STAIR.z0 + 3])]) assert.ok(clearAt(physics, p, g(p.x, p.z)), `the way in is clear at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  // the named people stand on something: Wen on the courtyard's floor, Emrys on the bowl's deck, Dun on the floor
  for (const p of MOONFOUNDRY_CONTENT.npcs.filter((q) => q.id)) {
    const y = p.y ?? g(p.at[0], p.at[1]), top = physics.groundAt(p.at[0] + 0.03, y + 2, p.at[1] + 0.02, 6);
    assert.ok(Math.abs(top - y) < 0.3, `${p.id} stands on it (${top?.toFixed(2)} for ${y.toFixed(2)})`);
  }
  assert.ok(level.lights.length > 30, 'windows, lamps, the furnace');
});

test('the stair climbs to the gantry, the gantry crosses into the broken moon over its lip, the branch reaches the bowl', () => {
  const { level, physics } = built();
  assert.ok(Math.abs(G - COURT_Y) < 1e-9 && Math.abs(level.court.y - G) < 1e-6, 'the gantry at the courtyard\'s floor');
  // up the stair: each step a little higher
  let last = -Infinity, rises = 0;
  for (let t = 0.03; t < 0.98; t += 0.02) {
    const z = STAIR.z0 + (level.ways.top - STAIR.z0) * t, y = physics.groundAt(STAIR.x + 0.07, G + 3, z, G + 6);
    assert.ok(Number.isFinite(y) && y >= last - 0.05, `the stair climbs at ${t.toFixed(2)}`);
    if (y > last + 0.01) rises++;
    last = y;
  }
  assert.ok(rises > 25 && last > G - 1, 'step by step up to the deck');
  // along the gantry and the branch: a deck under foot, the way clear
  for (const way of [level.ways.main, level.ways.branch]) for (let i = 1; i < way.length; i++) for (const p of line(way[i - 1], way[i], 1.5)) {
    const y = physics.groundAt(p.x + 0.07, G + 3, p.z + 0.05, 5);
    assert.ok(Math.abs(y - G) < 0.05, `the deck holds at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} (${y?.toFixed(2)})`);
    assert.ok(clearAt(physics, p, y), `the way along the gantry is clear at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  }
  // over the lip and into the courtyard, toward its middle
  const end = level.ways.main.at(-1), mid = [COURT.x, G, COURT.z];
  for (const p of line(end, [level.court.lip.x, G, level.court.lip.z], 0.5)) {
    const y = physics.groundAt(p.x + 0.05, G + 3, p.z + 0.04, 4);
    assert.ok(Math.abs(y - G) < 0.4, `over the lip at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} (${y?.toFixed(2)})`);
    assert.ok(clearAt(physics, p, y), `nothing in the way over the lip at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  }
  let walked = 0;
  for (const p of line([level.court.lip.x, G, level.court.lip.z], mid, 1).slice(0, -6)) {
    const y = physics.groundAt(p.x + 0.05, G + 3, p.z + 0.04, 4);
    assert.ok(Math.abs(y - G) < 0.4 || y > G, `the courtyard's floor at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    if (clearAt(physics, p, y)) walked++;
  }
  assert.ok(walked >= 10, `the courtyard's front is open ground (${walked} m)`);
  // the bowl's deck, round its garden
  const b = level.bowlDeck;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, y = physics.groundAt(b.x + Math.cos(a) * b.rim * 0.6, G + 3, b.z + Math.sin(a) * b.rim * 0.6, 5); assert.ok(Math.abs(y - G) < 0.4 || y > G, 'the bowl\'s deck all round'); }
});

test('solid as drawn: the pillars, the moons, the furnace; drawn only overhead; within the handheld\'s budget', () => {
  const { scene, level, physics } = built();
  const [px, pz] = level.pillars[0];
  assert.ok(!clearAt(physics, V(px + 3.9, 0, pz), 0) && !clearAt(physics, V(px, 0, pz + 3.9), 0), 'you cannot walk into a pillar');
  assert.ok(physics.groundAt(CRADLE.x + 0.1, 60, CRADLE.z + 0.1, 30) > CRADLE.yc + CRADLE.R - 1, 'the cradled moon\'s crown is solid');
  assert.ok(physics.groundAt(HUNG.x + 0.1, HUNG.y + HUNG.R + 2, HUNG.z + 0.1, 4) > HUNG.y + HUNG.R - 1, 'the hung moon is solid');
  assert.ok(!clearAt(physics, V(FURNACE.x + FURNACE.r + 0.2, 0, FURNACE.z), 0), "the furnace stops you");
  assert.ok(!(physics.groundAt(0.1, HALL.roof + 5, 0.1, 10) > HALL.roof - 6), 'the roof is out of reach: drawn only');
  // (the Casting-House's rooms hang far overhead, out of the frustum: counted apart, src/temples/moonfoundry.js)
  let meshes = 0, temple = 0;
  const T = level.temple?.root;
  const under = (o) => { for (let q = o; q; q = q.parent) if (q === T) return true; return false; };
  scene.traverse((o) => { if (o.isMesh && o.visible) { if (T && under(o)) temple++; else meshes++; } });
  assert.ok(meshes < 260, `meshes ${meshes}`);
  assert.ok(temple < 180, `the temple's meshes ${temple}`);
  assert.ok(physics.triangles < 200000, `collision triangles ${physics.triangles}`);
  // the furnace drones by its mouth; the pour's bands march down it
  assert.ok(level.hum(V(FURNACE.x - 8, 1, FURNACE.z)) > 0.5 && level.hum(V(0, 1, 60)) === 0);
  const stream = scene.getObjectByName('the pour'), C = stream.geometry.attributes.color;
  level.update(0.016, 1); const a = C.array.slice(); level.update(0.016, 1.4);
  assert.ok(C.array.some((v, i) => Math.abs(v - a[i]) > 1e-3), 'the bands move');
  assert.ok(BOWL.R > 0 && level.far.every((m) => m.userData.floats), 'the far moons are out of reach');
});
